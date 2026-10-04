"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getAuthContext } from "@/lib/auth";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { convertRecipeQuantity, INVENTORY_UNITS } from "@/lib/inventory-units.mjs";

const managerRoles = ["ADMIN", "OWNER", "MANAGER"];
const requestRoles = ["ADMIN", "OWNER", "MANAGER", "CHEF", "BARMAN"];
const stockAdderRoles = managerRoles;
const requestUnits = ["kg", "g", "L", "ml", "pcs", "box"];
const inventoryUnits = ["kg", "g", "L", "ml", "pcs", "box"];

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

async function assertRestaurantReference(supabase, table, id, restaurantId, label) {
  if (!id) return null;
  const { data, error } = await supabase
    .from(table)
    .select("id")
    .eq("id", id)
    .eq("restaurant_id", restaurantId)
    .maybeSingle();
  if (error) throw error;
  if (!data) throw new Error(`${label} does not belong to this restaurant.`);
  return data.id;
}

async function recordLowStockAlert(supabase, membership, itemId) {
  const { error } = await supabase.rpc("record_low_stock_alert", {
    p_restaurant_id: membership.restaurant_id,
    p_item_id: itemId,
  });
  if (error) throw error;
}

export async function createInventoryItem(formData) {
  const { supabase, membership, user } = await getRestaurantContext();

  if (!managerRoles.includes(membership.role)) {
    throw new Error("You do not have permission to create inventory items.");
  }

  const categoryId = String(formData.get("category_id") || "").trim();
  const supplierId = String(formData.get("supplier_id") || "").trim();
  const initialQuantity = parseNumber(formData.get("current_quantity"), "Initial quantity");
  await assertRestaurantReference(supabase, "inventory_categories", categoryId, membership.restaurant_id, "Category");
  await assertRestaurantReference(supabase, "suppliers", supplierId, membership.restaurant_id, "Supplier");

  const payload = {
    restaurant_id: membership.restaurant_id,
    category_id: categoryId || null,
    supplier_id: supplierId || null,
    name: String(formData.get("name") || "").trim(),
    sku: String(formData.get("sku") || "").trim() || null,
    description: String(formData.get("description") || "").trim() || null,
    unit: String(formData.get("unit") || "").trim(),
    minimum_stock_level: parseNumber(formData.get("minimum_stock_level"), "Minimum stock level"),
    cost_price: parseNumber(formData.get("cost_price"), "Cost price"),
    station: String(formData.get("station") || "KITCHEN").toUpperCase(),
    is_active: formData.get("is_active") !== "false",
  };

  if (!payload.name) throw new Error("Item name is required.");
  if (!inventoryUnits.includes(payload.unit)) throw new Error("Choose a supported inventory unit.");
  if (initialQuantity < 0) throw new Error("Initial quantity cannot be negative.");
  if (payload.minimum_stock_level < 0) throw new Error("Minimum stock level cannot be negative.");
  if (payload.cost_price < 0) throw new Error("Cost price cannot be negative.");
  if (!["KITCHEN", "BAR"].includes(payload.station)) throw new Error("Choose a valid station.");

  const escapedName = payload.name.replace(/[\\%_]/g, "\\$&");
  const { data: duplicateItem, error: duplicateError } = await supabase
    .from("inventory_items")
    .select("id")
    .eq("restaurant_id", membership.restaurant_id)
    .ilike("name", escapedName)
    .limit(1)
    .maybeSingle();
  if (duplicateError) throw duplicateError;
  if (duplicateItem) throw new Error("An inventory item with this name already exists.");

  const { data: createdItem, error } = await supabase
    .from("inventory_items")
    .insert(payload)
    .select("id")
    .single();

  if (error) throw error;

  if (initialQuantity > 0) {
    const { error: movementError } = await supabase.rpc("apply_stock_movement", {
      p_restaurant_id: membership.restaurant_id,
      p_item_id: createdItem.id,
      p_movement_type: "ADD_STOCK",
      p_quantity_delta: initialQuantity,
      p_unit: payload.unit,
      p_unit_cost: payload.cost_price,
      p_reason: "Initial stock",
      p_performed_by: user.id,
      p_related_order_id: null,
    });
    if (movementError) throw movementError;
  }

  await recordLowStockAlert(supabase, membership, createdItem.id);

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
    category_id: String(formData.get("category_id") || "").trim() || null,
    supplier_id: String(formData.get("supplier_id") || "").trim() || null,
    name: String(formData.get("name") || "").trim(),
    sku: String(formData.get("sku") || "").trim() || null,
    description: String(formData.get("description") || "").trim() || null,
    unit: String(formData.get("unit") || "").trim() || "pcs",
    minimum_stock_level: parseNumber(formData.get("minimum_stock_level"), "Minimum stock level"),
    cost_price: parseNumber(formData.get("cost_price"), "Cost price"),
    station: String(formData.get("station") || "KITCHEN").toUpperCase(),
    is_active: formData.get("is_active") !== "false",
  };

  if (!payload.name) throw new Error("Item name is required.");
  if (!INVENTORY_UNITS.includes(payload.unit)) throw new Error("Choose a supported inventory unit.");
  if (payload.minimum_stock_level < 0) throw new Error("Minimum stock level cannot be negative.");
  if (payload.cost_price < 0) throw new Error("Cost price cannot be negative.");
  if (!["KITCHEN", "BAR"].includes(payload.station)) throw new Error("Choose a valid station.");
  await assertRestaurantReference(supabase, "inventory_categories", payload.category_id, membership.restaurant_id, "Category");
  await assertRestaurantReference(supabase, "suppliers", payload.supplier_id, membership.restaurant_id, "Supplier");

  const { error } = await supabase
    .from("inventory_items")
    .update(payload)
    .eq("id", id)
    .eq("restaurant_id", membership.restaurant_id);

  if (error?.code === "23514" && error.message?.includes("Inventory item unit cannot be changed")) {
    throw new Error("inventoryUnitInUse");
  }
  if (error) throw error;

  revalidatePath("/inventory");
}

export async function createOrUpdateLowStockAlert(formData) {
  const { supabase, membership, user } = await getRestaurantContext();

  if (!managerRoles.includes(membership.role)) {
    throw new Error("You do not have permission to manage low stock alerts.");
  }

  const itemId = String(formData.get("item_id") || "").trim();
  if (!itemId) throw new Error("Item ID is required.");

  await recordLowStockAlert(supabase, membership, itemId);

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

  if (!stockAdderRoles.includes(membership.role)) {
    throw new Error("You do not have permission to add stock.");
  }

  const itemId = String(formData.get("item_id") || "");
  const movementType = String(formData.get("movement_type") || "");
  const rawQuantity = Number(formData.get("quantity"));
  const reason = String(formData.get("reason") || "").trim() || "Inventory movement";
  const unit = String(formData.get("unit") || "").trim() || null;
  const unitCost = formData.get("unit_cost") === null || formData.get("unit_cost") === "" ? null : parseNumber(formData.get("unit_cost"), "Unit cost");

  if (!itemId) throw new Error("Item is required.");
  if (!movementType) throw new Error("Movement type is required.");
  if (!Number.isFinite(rawQuantity) || rawQuantity <= 0) {
    throw new Error("Stock quantity must be greater than zero.");
  }

  if (!["ADD_STOCK", "ADJUSTMENT"].includes(movementType)) {
    throw new Error("Unsupported stock movement type.");
  }
  const direction = String(formData.get("direction") || "INCREASE").toUpperCase();
  if (!["INCREASE", "DECREASE"].includes(direction)) throw new Error("Unsupported adjustment direction.");

  const { data: item, error: itemError } = await supabase
    .from("inventory_items")
    .select("id, unit")
    .eq("id", itemId)
    .eq("restaurant_id", membership.restaurant_id)
    .maybeSingle();

  if (itemError) throw itemError;
  if (!item) throw new Error("Inventory item not found in your restaurant.");

  const normalizedUnit = unit || item.unit;
  const quantityDelta = movementType === "ADJUSTMENT" && direction === "DECREASE"
    ? -rawQuantity
    : rawQuantity;
  const { error } = await supabase.rpc("apply_stock_movement", {
    p_restaurant_id: membership.restaurant_id,
    p_item_id: itemId,
    p_movement_type: movementType,
    p_quantity_delta: quantityDelta,
    p_unit: normalizedUnit,
    p_unit_cost: unitCost,
    p_reason: reason,
    p_performed_by: user.id,
  });

  if (error) throw error;
  await recordLowStockAlert(supabase, membership, itemId);
  revalidatePath("/inventory");
  return { success: true };
}

export async function createMenuInventoryRecipe(formData) {
  const { supabase, membership } = await getRestaurantContext();
  if (!managerRoles.includes(membership.role)) throw new Error("You do not have permission to manage recipes.");

  const menuItemId = String(formData.get("menu_item_id") || "").trim();
  const inventoryItemId = String(formData.get("inventory_item_id") || "").trim();
  const quantityRequired = parseNumber(formData.get("quantity_required"), "Recipe quantity");
  const unit = String(formData.get("unit") || "").trim();
  if (!menuItemId || !inventoryItemId || quantityRequired <= 0 || !unit) throw new Error("Complete all recipe fields.");
  if (!INVENTORY_UNITS.includes(unit)) throw new Error("Choose a supported recipe unit.");

  const [{ data: menuItem, error: menuError }, { data: inventoryItem, error: inventoryError }] = await Promise.all([
    supabase.from("menu_items").select("id, station").eq("id", menuItemId).eq("restaurant_id", membership.restaurant_id).maybeSingle(),
    supabase.from("inventory_items").select("id, station, unit").eq("id", inventoryItemId).eq("restaurant_id", membership.restaurant_id).maybeSingle(),
  ]);
  if (menuError) throw menuError;
  if (inventoryError) throw inventoryError;
  if (!menuItem || !inventoryItem) throw new Error("Menu item and inventory item must belong to this restaurant.");
  if (menuItem.station !== inventoryItem.station) throw new Error("Recipe station must match the menu item station.");
  const unitValidation = convertRecipeQuantity(quantityRequired, unit, inventoryItem.unit);
  if (!unitValidation.ok) {
    if (unitValidation.reason === "incompatible_units") {
      throw new Error(`Recipe unit ${unit} is incompatible with inventory unit ${inventoryItem.unit}.`);
    }
    if (unitValidation.reason === "stock_precision") {
      throw new Error(`Recipe quantity in ${unit} cannot be represented in ${inventoryItem.unit} stock precision.`);
    }
    throw new Error("Recipe quantity or unit is invalid.");
  }

  const { error } = await supabase.from("menu_item_inventory_items").upsert({
    restaurant_id: membership.restaurant_id,
    menu_item_id: menuItemId,
    inventory_item_id: inventoryItemId,
    quantity_required: quantityRequired,
    unit,
    updated_at: new Date().toISOString(),
  }, { onConflict: "restaurant_id,menu_item_id,inventory_item_id" });
  if (error) throw error;
  revalidatePath("/inventory");
  revalidatePath("/menu");
}

export async function deleteMenuInventoryRecipe(formData) {
  const { supabase, membership } = await getRestaurantContext();
  if (!managerRoles.includes(membership.role)) throw new Error("You do not have permission to manage recipes.");
  const id = String(formData.get("id") || "").trim();
  if (!id) throw new Error("Recipe ID is required.");
  const { error } = await supabase.from("menu_item_inventory_items")
    .delete().eq("id", id).eq("restaurant_id", membership.restaurant_id);
  if (error) throw error;
  revalidatePath("/inventory");
  revalidatePath("/menu");
}

export async function createStockRequest(formData) {
  const { supabase, membership, user } = await getRestaurantContext();

  if (!requestRoles.includes(membership.role)) {
    throw new Error("You do not have permission to create stock requests.");
  }

  const requestedItemName = String(formData.get("requested_item_name") || "").trim();
  const requestedStation = String(formData.get("station") || "").toUpperCase();
  const quantity = parseNumber(formData.get("quantity"), "Quantity");
  const unit = String(formData.get("unit") || "").trim();
  const note = String(formData.get("note") || "").trim();

  if (!requestedItemName) throw new Error("Item name is required.");
  if (!["KITCHEN", "BAR"].includes(requestedStation)) throw new Error("A valid station is required.");
  if (quantity <= 0) throw new Error("Requested quantity must be greater than zero.");
  if (!requestUnits.includes(unit)) throw new Error("Choose a supported request unit.");
  const expectedStation = membership.role === "CHEF" ? "KITCHEN" : membership.role === "BARMAN" ? "BAR" : requestedStation;
  if (requestedStation !== expectedStation) throw new Error("You can only request stock for your assigned station.");

  const escapedName = requestedItemName.replace(/[\\%_]/g, "\\$&");

  const { data: pendingRequest, error: pendingError } = await supabase
    .from("stock_requests")
    .select("id")
    .eq("restaurant_id", membership.restaurant_id)
    .ilike("requested_item_name", escapedName)
    .eq("station", requestedStation)
    .eq("requested_by_user_id", user.id)
    .eq("status", "PENDING")
    .maybeSingle();
  if (pendingError) throw pendingError;
  if (pendingRequest) throw new Error("You already have a pending request for this item.");

  const { error } = await supabase.from("stock_requests").insert({
    restaurant_id: membership.restaurant_id,
    item_id: null,
    requested_item_name: requestedItemName,
    requested_by_user_id: user.id,
    quantity,
    unit,
    station: requestedStation,
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
  const inventoryItemId = String(formData.get("inventory_item_id") || "").trim();
  const note = String(formData.get("note") || "").trim() || null;

  if (!requestId) throw new Error("Request ID is required.");
  if (!["APPROVED", "REJECTED", "FULFILLED"].includes(status)) {
    throw new Error("Unsupported request status.");
  }
  if (status === "FULFILLED" && !stockAdderRoles.includes(membership.role)) {
    throw new Error("You do not have permission to add stock.");
  }

  const { data: request, error: requestError } = await supabase
    .from("stock_requests")
    .select("id, item_id, requested_item_name, station, quantity, unit, restaurant_id, status, note")
    .eq("id", requestId)
    .eq("restaurant_id", membership.restaurant_id)
    .maybeSingle();

  if (requestError) throw requestError;
  if (!request) throw new Error("Stock request not found.");
  if (request.status === "FULFILLED" || request.status === "REJECTED") {
    throw new Error("This stock request has already been closed.");
  }

  if (status === "FULFILLED" && request.status !== "APPROVED") {
    throw new Error("Approve the request before fulfilling it.");
  }

  if (status === "FULFILLED") {
    let fulfillmentItemId = inventoryItemId;
    if (!fulfillmentItemId && !request.item_id) {
      const escapedName = String(request.requested_item_name || "").replace(/[\\%_]/g, "\\$&");
      const { data: matchingItem, error: matchingItemError } = await supabase
        .from("inventory_items")
        .select("id")
        .eq("restaurant_id", membership.restaurant_id)
        .eq("station", request.station)
        .eq("is_active", true)
        .ilike("name", escapedName)
        .maybeSingle();
      if (matchingItemError) throw matchingItemError;
      if (!matchingItem) throw new Error("Create or rename an active inventory item to match this request before fulfilling it.");
      fulfillmentItemId = matchingItem.id;
    }
    const { error: stockError } = fulfillmentItemId
      ? await supabase.rpc("fulfill_stock_request_with_item", {
        p_request_id: request.id,
        p_inventory_item_id: fulfillmentItemId,
        p_performed_by: user.id,
        p_reason: note || "Stock request fulfilled",
      })
      : await supabase.rpc("fulfill_stock_request", { p_request_id: request.id, p_performed_by: user.id, p_reason: note || "Stock request fulfilled" });
    if (stockError) throw stockError;
    revalidatePath("/inventory");
    return { success: true };
  }

  const { error: updateError } = await supabase
    .from("stock_requests")
    .update({
      status,
      approved_by_user_id: user.id,
      reviewed_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      note: note || request.note,
    })
    .eq("id", requestId)
    .eq("restaurant_id", membership.restaurant_id);

  if (updateError) throw updateError;

  revalidatePath("/inventory");
}
