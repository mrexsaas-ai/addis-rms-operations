"use server";

import { revalidatePath } from "next/cache";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { SERVICE_ROLES, getAuthContext } from "@/lib/auth";

export async function createOrder(formData) {
  const supabase = await createSupabaseServerClient();
  const { user, membership } = await getAuthContext(supabase);

  if (!user) throw new Error("You must be signed in.");
  if (!membership || !SERVICE_ROLES.includes(membership.role)) {
    throw new Error("You do not have permission to create orders.");
  }

  const menuItemId = String(formData.get("menu_item_id") || "");
  const quantity = Number(formData.get("quantity"));
  const tableId = String(formData.get("table_id") || "") || null;
  const notes = String(formData.get("notes") || "").trim() || null;

  if (!menuItemId || !Number.isInteger(quantity) || quantity < 1) {
    throw new Error("Choose a menu item and a positive quantity.");
  }

  const { data: item, error: itemError } = await supabase
    .from("menu_items")
    .select("id, name, price, station")
    .eq("id", menuItemId)
    .eq("restaurant_id", membership.restaurant_id)
    .eq("is_available", true)
    .maybeSingle();

  if (itemError) throw itemError;
  if (!item) throw new Error("That menu item is not available.");
  if (item.station !== "KITCHEN" && item.station !== "BAR") {
    throw new Error(`Menu item "${item.name}" has an invalid station.`);
  }

  if (tableId) {
    const { data: table, error: tableError } = await supabase
      .from("tables")
      .select("id")
      .eq("id", tableId)
      .eq("restaurant_id", membership.restaurant_id)
      .maybeSingle();

    if (tableError) throw tableError;
    if (!table) throw new Error("That table does not belong to this restaurant.");
  }

  const subtotal = Number(item.price) * quantity;
  const orderNumber = `ORD-${Date.now().toString(36).toUpperCase()}`;
  const { data: order, error: orderError } = await supabase
    .from("orders")
    .insert({
      restaurant_id: membership.restaurant_id,
      table_id: tableId,
      created_by: user.id,
      order_number: orderNumber,
      subtotal,
      total: subtotal,
      notes,
    })
    .select("id")
    .single();

  if (orderError) throw orderError;

  const { data: orderItem, error: orderItemError } = await supabase
    .from("order_items")
    .insert({
      restaurant_id: membership.restaurant_id,
      order_id: order.id,
      menu_item_id: item.id,
      quantity,
      unit_price: item.price,
      subtotal,
      notes,
    })
    .select("id")
    .single();

  if (orderItemError) throw orderItemError;

  const { error: routingError } = await supabase.from("kitchen_orders").insert({
    restaurant_id: membership.restaurant_id,
    order_id: order.id,
    station: item.station,
    status: "NEW",
  });

  if (routingError) throw routingError;

  if (tableId) {
    const { error: tableUpdateError } = await supabase
      .from("tables")
      .update({ status: "OCCUPIED", updated_at: new Date().toISOString() })
      .eq("id", tableId)
      .eq("restaurant_id", membership.restaurant_id);

    if (tableUpdateError) throw tableUpdateError;
  }

  revalidatePath("/");
  revalidatePath("/orders");
  revalidatePath("/server");
  revalidatePath("/kitchen");
  revalidatePath("/bar");
  return { orderId: order.id, orderItemId: orderItem.id };
}

export async function recordPayment(formData) {
  const supabase = await createSupabaseServerClient();
  const { user, membership } = await getAuthContext(supabase);

  if (!user) throw new Error("You must be signed in.");
  if (!membership || !SERVICE_ROLES.includes(membership.role)) {
    throw new Error("You do not have permission to record payments.");
  }

  const orderId = String(formData.get("order_id") || "");
  const amount = Number(formData.get("amount"));
  const cashReceived = Number(formData.get("cash_received"));
  const method = String(formData.get("method") || "");
  const referenceNumber = String(formData.get("reference_number") || "").trim() || null;

  if (!orderId || !Number.isFinite(amount) || amount <= 0 || !["CASH", "TELEBIRR", "BANK_TRANSFER"].includes(method)) {
    throw new Error("Enter a valid amount and payment method.");
  }

  const { data: order, error: orderError } = await supabase
    .from("orders")
    .select("id, total, status")
    .eq("id", orderId)
    .eq("restaurant_id", membership.restaurant_id)
    .maybeSingle();

  if (orderError) throw orderError;
  if (!order) throw new Error("Order not found.");

  if (method !== "CASH" && !referenceNumber) {
    throw new Error("A transaction reference is required for this payment method.");
  }
  if (method === "CASH" && (!Number.isFinite(cashReceived) || cashReceived < Number(order.total))) {
    throw new Error("Cash received must be at least the order total.");
  }
  if (order.status === "PAID") throw new Error("This order has already been paid.");

  const { error } = await supabase.from("payments").insert({
    restaurant_id: membership.restaurant_id,
    order_id: order.id,
    amount: Number(order.total),
    method,
    status: "COMPLETED",
    received_by: user.id,
    reference_number: referenceNumber,
    cash_received: method === "CASH" ? cashReceived : null,
    change_amount: method === "CASH" ? cashReceived - Number(order.total) : null,
  });

  if (error) throw error;
  const { error: statusError } = await supabase
    .from("orders")
    .update({ status: "PAID", updated_at: new Date().toISOString() })
    .eq("id", order.id)
    .eq("restaurant_id", membership.restaurant_id)
    .neq("status", "PAID");
  if (statusError) throw statusError;
  revalidatePath("/");
  revalidatePath("/orders");
  revalidatePath(`/receipts/${order.id}`);
  return { orderId: order.id };
}