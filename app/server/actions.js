"use server";

import { revalidatePath } from "next/cache";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { SERVICE_ROLES, getAuthContext } from "@/lib/auth";

const ORDER_TYPES = ["DINE_IN", "TAKEAWAY", "DELIVERY"];

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

  const orderNotes = orderType + (notes ? ` | ${notes}` : "");
  const { data: result, error } = await supabase.rpc("create_order_atomic", {
    p_order_type: orderType,
    p_order_number_prefix: "POS",
    p_creation_flow: "SERVER_POS",
    p_table_id: orderType === "DINE_IN" ? tableId : null,
    p_notes: orderNotes,
    p_item_notes: orderType,
    p_items: [...normalizedCart].map(([id, quantity]) => ({ id, quantity })),
  });
  if (error) throw error;

  revalidatePath("/server");
  revalidatePath("/orders");
  revalidatePath("/kitchen");
  revalidatePath("/bar");

  const orderId = result.order_id;
  const orderNumber = result.order_number;
  const orderTotal = Number(result.order_total || 0);
  return {
    success: true,
    orderId,
    orderNumber,
    orderTotal,
    existingOrder: result.existing_order
      ? { id: orderId, order_number: orderNumber, total: orderTotal }
      : null,
  };
}
