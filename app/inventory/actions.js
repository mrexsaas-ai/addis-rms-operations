"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getAuthContext } from "@/lib/auth";
import { createSupabaseServerClient } from "@/lib/supabase/server";

const managerRoles = ["ADMIN", "OWNER", "MANAGER"];
const requestRoles = ["ADMIN", "OWNER", "MANAGER", "CHEF", "BARMAN"];

async function getRestaurantContext() {
  const supabase = await createSupabaseServerClient();
  const { user, membership } = await getAuthContext(supabase);

  if (!user) redirect("/login");
  if (!membership) throw new Error("Restaurant membership not found.");

  return { supabase, user, membership };
}

function parseNumber(value, fieldName) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) {
    throw new Error(`${fieldName} must be a valid number.`);
  }
  return parsed;
}

export async function createInventoryItem(formData) {
  const { supabase, membership, user } = await getRestaurantContext();

  if (!managerRoles.includes(membership.role)) {
    throw new Error("You do not have permission to create inventory items.");
  }

  const payload = {
    restaurant_id: membership.restaurant_id,
    category_id: String(formData.get("category_id") || "") || null,
    supplier_id: String(formData.get("supplier_id") || "") || null,
    name: String(formData.get("name") || "").trim(),
    sku: String(formData.get("sku") || "").trim() || null,
    description: String(formData.get("description") || "").trim() || null,
    unit: String(formData.get("unit") || "").trim() || "pcs",
    current_quantity: parseNumber(formData.get("current_quantity"), "Initial quantity"),
    minimum_stock_level: parseNumber(formData.get("minimum_stock_level"), "Minimum stock level"),
    cost_price: parseNumber(formData.get("cost_price"), "Cost price"),
    is_active: formData.get("is_active") !== "false",
  };

  if (!payload.name) throw new Error("Item name is required.");
  if (payload.current_quantity < 0) throw new Error("Initial quantity cannot be negative.");
  if (payload.minimum_stock_level < 0) throw new Error("Minimum stock level cannot be negative.");
  if (payload.cost_price < 0) throw new Error("Cost price cannot be negative.");

  const { data: createdItem, error } = await supabase
    .from("inventory_items")
    .insert(payload)
    .select("id")
    .single();

  if (error) throw error;

  await supabase.from("inventory_audit_logs").insert({
    restaurant_id: membership.restaurant_id,
    item_id: createdItem.id,
    action: "ITEM_CREATED",
    performed_by_user_id: user.id,
    previous_quantity: 0,
    new_quantity: payload.current_quantity,
    note: `Inventory item created: ${payload.name}`,
  });

  revalidatePath("/inventory");
}

export async function updateInventoryItem(formData) {
  const { supabase, membership, user } = await getRestaurantContext();

  if (!managerRoles.includes(membership.role)) {
    throw new Error("You do not have permission to update inventory items.");
  }

  const id = String(formData.get("id") || "");
  if (!id) throw new Error("Item ID is required.");

  const payload = {
    category_id: String(formData.get("category_id") || "") || null,
    supplier_id: String(formData.get("supplier_id") || "") || null,
    name: String(formData.get("name") || "").trim(),
    sku: String(formData.get("sku") || "").trim() || null,
    description: String(formData.get("description") || "").trim() || null,
    unit: String(formData.get("unit") || "").trim() || "pcs",
    minimum_stock_level: parseNumber(formData.get("minimum_stock_level"), "Minimum stock level"),
    cost_price: parseNumber(formData.get("cost_price"), "Cost price"),
    is_active: formData.get("is_active") !== "false",
  };

  if (!payload.name) throw new Error("Item name is required.");
  if (payload.minimum_stock_level < 0) throw new Error("Minimum stock level cannot be negative.");
  if (payload.cost_price < 0) throw new Error("Cost price cannot be negative.");

  const { error } = await supabase
    .from("inventory_items")
    .update(payload)
    .eq("id", id)
    .eq("restaurant_id", membership.restaurant_id);

  if (error) throw error;

  revalidatePath("/inventory");
}

export async function createSupplier(formData) {
  const { supabase, membership } = await getRestaurantContext();

  if (!managerRoles.includes(membership.role)) {
    throw new Error("You do not have permission to create suppliers.");
  }

  const name = String(formData.get("name") || "").trim();
  if (!name) throw new Error("Supplier name is required.");

  const { error } = await supabase.from("suppliers").insert({
    restaurant_id: membership.restaurant_id,
    name,
    phone: String(formData.get("phone") || "").trim() || null,
    email: String(formData.get("email") || "").trim() || null,
    address: String(formData.get("address") || "").trim() || null,
    notes: String(formData.get("notes") || "").trim() || null,
    is_active: formData.get("is_active") !== "false",
  });

  if (error) throw error;
  revalidatePath("/inventory");
}

export async function createInventoryCategory(formData) {
  const { supabase, membership } = await getRestaurantContext();

  if (!managerRoles.includes(membership.role)) {
    throw new Error("You do not have permission to create inventory categories.");
  }

  const name = String(formData.get("name") || "").trim();
  if (!name) throw new Error("Category name is required.");

  const { error } = await supabase.from("inventory_categories").insert({
    restaurant_id: membership.restaurant_id,
    name,
    is_active: true,
  });

  if (error) throw error;
  revalidatePath("/inventory");
}

export async function recordStockMovement(formData) {
  const { supabase, membership, user } = await getRestaurantContext();

  const itemId = String(formData.get("item_id") || "");
  const movementType = String(formData.get("movement_type") || "");
  const rawQuantity = Number(formData.get("quantity"));
  const reason = String(formData.get("reason") || "").trim() || "Inventory movement";
  const unit = String(formData.get("unit") || "").trim() || null;
  const unitCost = formData.get("unit_cost") === null || formData.get("unit_cost") === "" ? null : parseNumber(formData.get("unit_cost"), "Unit cost");

  if (!itemId) throw new Error("Item is required.");
  if (!movementType) throw new Error("Movement type is required.");
  if (!Number.isFinite(rawQuantity) || rawQuantity === 0) {
    throw new Error("Quantity must be a non-zero number.");
  }

  const allowedMovementTypes = ["ADD_STOCK", "USAGE", "ADJUSTMENT", "TRANSFER", "RETURN", "WASTE", "REJECTED"];
  if (!allowedMovementTypes.includes(movementType)) {
    throw new Error("Unsupported stock movement type.");
  }

  const { data: item, error: itemError } = await supabase
    .from("inventory_items")
    .select("id, unit")
    .eq("id", itemId)
    .eq("restaurant_id", membership.restaurant_id)
    .maybeSingle();

  if (itemError) throw itemError;
  if (!item) throw new Error("Inventory item not found in your restaurant.");

  const normalizedUnit = unit || item.unit;
  const { error } = await supabase.rpc("apply_stock_movement", {
    p_restaurant_id: membership.restaurant_id,
    p_item_id: itemId,
    p_movement_type: movementType,
    p_quantity_delta: Number(rawQuantity),
    p_unit: normalizedUnit,
    p_unit_cost: unitCost,
    p_reason: reason,
    p_performed_by: user.id,
  });

  if (error) throw error;
  revalidatePath("/inventory");
}

export async function createStockRequest(formData) {
  const { supabase, membership, user } = await getRestaurantContext();

  if (!requestRoles.includes(membership.role)) {
    throw new Error("You do not have permission to create stock requests.");
  }

  const itemId = String(formData.get("item_id") || "");
  const quantity = parseNumber(formData.get("quantity"), "Quantity");
  const unit = String(formData.get("unit") || "").trim() || "pcs";
  const note = String(formData.get("note") || "").trim();

  if (!itemId) throw new Error("Item is required.");
  if (quantity <= 0) throw new Error("Requested quantity must be greater than zero.");

  const { data: item, error: itemError } = await supabase
    .from("inventory_items")
    .select("id")
    .eq("id", itemId)
    .eq("restaurant_id", membership.restaurant_id)
    .maybeSingle();

  if (itemError) throw itemError;
  if (!item) throw new Error("Inventory item not found in this restaurant.");

  const { error } = await supabase.from("stock_requests").insert({
    restaurant_id: membership.restaurant_id,
    item_id: itemId,
    requested_by_user_id: user.id,
    quantity,
    unit,
    status: "PENDING",
    note: note || null,
  });

  if (error) throw error;
  revalidatePath("/inventory");
}

export async function updateStockRequestStatus(formData) {
  const { supabase, membership, user } = await getRestaurantContext();

  if (!managerRoles.includes(membership.role)) {
    throw new Error("You do not have permission to review stock requests.");
  }

  const requestId = String(formData.get("request_id") || "");
  const status = String(formData.get("status") || "");
  const note = String(formData.get("note") || "").trim() || null;

  if (!requestId) throw new Error("Request ID is required.");
  if (!["APPROVED", "REJECTED", "FULFILLED"].includes(status)) {
    throw new Error("Unsupported request status.");
  }

  const { data: request, error: requestError } = await supabase
    .from("stock_requests")
    .select("id, item_id, quantity, unit, restaurant_id")
    .eq("id", requestId)
    .eq("restaurant_id", membership.restaurant_id)
    .maybeSingle();

  if (requestError) throw requestError;
  if (!request) throw new Error("Stock request not found.");

  const { error: updateError } = await supabase
    .from("stock_requests")
    .update({
      status,
      approved_by_user_id: user.id,
      reviewed_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      note: note || null,
    })
    .eq("id", requestId)
    .eq("restaurant_id", membership.restaurant_id);

  if (updateError) throw updateError;

  if (status === "FULFILLED") {
    const { error: stockError } = await supabase.rpc("apply_stock_movement", {
      p_restaurant_id: membership.restaurant_id,
      p_item_id: request.item_id,
      p_movement_type: "ADD_STOCK",
      p_quantity_delta: Number(request.quantity),
      p_unit: request.unit,
      p_unit_cost: null,
      p_reason: "Stock request fulfilled",
      p_performed_by: user.id,
    });

    if (stockError) throw stockError;
  }

  revalidatePath("/inventory");
}
