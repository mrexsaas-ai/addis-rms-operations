"use server";

import { revalidatePath } from "next/cache";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { SERVICE_ROLES, getAuthContext } from "@/lib/auth";

const ORDER_TYPES = ["DINE_IN", "TAKEAWAY", "DELIVERY"];
const VALID_TABLE_STATUSES = new Set(["AVAILABLE", "RESERVED"]);

function normalizeCart(cart) {
  const normalized = new Map();

  if (!Array.isArray(cart)) {
    return normalized;
  }

  for (const entry of cart) {
    if (!entry || typeof entry !== "object") continue;
    const itemId = String(entry.id || "").trim();
    const quantity = Number(entry.quantity || 0);
    if (!itemId || !Number.isInteger(quantity) || quantity < 1) continue;
    const current = normalized.get(itemId) || 0;
    normalized.set(itemId, current + quantity);
  }

  return normalized;
}

export async function createServerOrder(formData) {
  const supabase = await createSupabaseServerClient();
  const { user, membership } = await getAuthContext(supabase);

  if (!user) {
    throw new Error("You must be signed in.");
  }

  if (!membership || !SERVICE_ROLES.includes(membership.role)) {
    throw new Error("You do not have permission to create orders.");
  }

  const orderType = String(formData.get("order_type") || "DINE_IN");
  const tableId = String(formData.get("table_id") || "").trim();
  const notes = String(formData.get("notes") || "").trim();
  const rawCart = String(formData.get("items") || "[]");

  if (!ORDER_TYPES.includes(orderType)) {
    throw new Error("Choose a valid order type.");
  }

  let parsedCart = [];
  try {
    parsedCart = JSON.parse(rawCart);
  } catch {
    throw new Error("Invalid cart payload.");
  }

  const normalizedCart = normalizeCart(parsedCart);
  if (normalizedCart.size === 0) {
    throw new Error("Add at least one item to the cart.");
  }

  if (orderType === "DINE_IN") {
    if (!tableId) {
      throw new Error("Select a table for dine-in orders.");
    }

    const { data: table, error: tableError } = await supabase
      .from("tables")
      .select("id, status")
      .eq("id", tableId)
      .eq("restaurant_id", membership.restaurant_id)
      .maybeSingle();

    if (tableError) throw tableError;
    if (!table) {
      throw new Error("That table does not belong to this restaurant.");
    }
    if (!VALID_TABLE_STATUSES.has(table.status)) {
      throw new Error("Only available or reserved tables can be used for a new dine-in order.");
    }
  }

  const itemIds = [...normalizedCart.keys()];
  const { data: menuItems, error: menuItemsError } = await supabase
    .from("menu_items")
    .select("id, name, price, station")
    .in("id", itemIds)
    .eq("restaurant_id", membership.restaurant_id)
    .eq("is_available", true);

  if (menuItemsError) throw menuItemsError;
  if (!menuItems || menuItems.length !== itemIds.length) {
    throw new Error("One or more menu items are unavailable in this restaurant.");
  }

  const itemMap = new Map(menuItems.map((item) => [item.id, item]));
  let subtotal = 0;
  const orderItems = [];
  const stationSet = new Set();

  for (const [itemId, quantity] of normalizedCart.entries()) {
    const item = itemMap.get(itemId);
    if (!item) {
      throw new Error("One or more selected items are unavailable.");
    }
    const lineSubtotal = Number(item.price) * quantity;
    subtotal += lineSubtotal;
    orderItems.push({
      restaurant_id: membership.restaurant_id,
      menu_item_id: item.id,
      quantity,
      unit_price: Number(item.price),
      subtotal: lineSubtotal,
      notes: orderType,
    });

    if (item.station !== "KITCHEN" && item.station !== "BAR") {
      throw new Error(`Menu item "${item.name}" has an invalid station.`);
    }

    stationSet.add(item.station);
  }

  const orderNumber = `POS-${Date.now().toString(36).toUpperCase()}-${Math.random().toString(36).slice(2, 6).toUpperCase()}`;
  const orderNotes = orderType + (notes ? ` | ${notes}` : "");

  const { data: order, error: orderError } = await supabase
    .from("orders")
    .insert({
      restaurant_id: membership.restaurant_id,
      table_id: orderType === "DINE_IN" ? tableId : null,
      created_by: user.id,
      order_number: orderNumber,
      subtotal,
      total: subtotal,
      notes: orderNotes,
      status: "NEW",
    })
    .select("id")
    .single();

  if (orderError) throw orderError;

  const orderItemRows = orderItems.map((entry) => ({
    restaurant_id: membership.restaurant_id,
    order_id: order.id,
    menu_item_id: entry.menu_item_id,
    quantity: entry.quantity,
    unit_price: entry.unit_price,
    subtotal: entry.subtotal,
    notes: entry.notes,
  }));

  const { error: orderItemsError } = await supabase
    .from("order_items")
    .insert(orderItemRows);

  if (orderItemsError) throw orderItemsError;

  for (const station of stationSet) {
    const { error: routingError } = await supabase
      .from("kitchen_orders")
      .upsert(
        {
          restaurant_id: membership.restaurant_id,
          order_id: order.id,
          station,
          status: "NEW",
          updated_at: new Date().toISOString(),
        },
        { onConflict: "order_id,station" }
      );

    if (routingError) throw routingError;
  }

  if (orderType === "DINE_IN" && tableId) {
    const { error: tableUpdateError } = await supabase
      .from("tables")
      .update({
        status: "OCCUPIED",
        updated_at: new Date().toISOString(),
      })
      .eq("id", tableId)
      .eq("restaurant_id", membership.restaurant_id);

    if (tableUpdateError) throw tableUpdateError;
  }

  revalidatePath("/server");
  revalidatePath("/orders");
  revalidatePath("/kitchen");
  revalidatePath("/bar");

  return { success: true, orderId: order.id };
}
