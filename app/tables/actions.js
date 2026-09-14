"use server";

import { revalidatePath } from "next/cache";
import { createSupabaseServerClient } from "@/lib/supabase/server";

const managerRoles = ["ADMIN", "OWNER", "MANAGER"];
const tableEditorRoles = ["ADMIN", "OWNER", "MANAGER", "SERVER"];
const validStatuses = ["AVAILABLE", "OCCUPIED", "RESERVED", "CLEANING"];

async function getMembership() {
  const supabase = await createSupabaseServerClient();

  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError) throw authError;
  if (!user) throw new Error("You must be signed in.");

  const { data: membership, error } = await supabase
    .from("restaurant_users")
    .select("restaurant_id, role")
    .eq("user_id", user.id)
    .limit(1)
    .maybeSingle();

  if (error) throw error;
  if (!membership) throw new Error("Restaurant membership not found.");

  return { supabase, user, membership };
}

export async function createTable(formData) {
  const { supabase, membership } = await getMembership();

  if (!managerRoles.includes(membership.role)) {
    throw new Error("You do not have permission to create tables.");
  }

  const tableNumber = Number(formData.get("table_number"));
  const name = String(formData.get("name") || "").trim();
  const capacity = Number(formData.get("capacity"));

  if (!Number.isInteger(tableNumber) || tableNumber <= 0) {
    throw new Error("Table number must be a positive whole number.");
  }

  if (!Number.isInteger(capacity) || capacity <= 0) {
    throw new Error("Capacity must be a positive whole number.");
  }

  const { error } = await supabase.from("tables").insert({
    restaurant_id: membership.restaurant_id,
    table_number: tableNumber,
    name: name || null,
    capacity,
    status: "AVAILABLE",
  });

  if (error) throw error;

  revalidatePath("/tables");
  revalidatePath("/");
}

export async function updateTableStatus(formData) {
  const { supabase, membership } = await getMembership();

  if (!tableEditorRoles.includes(membership.role)) {
    throw new Error("You do not have permission to update table status.");
  }

  const id = String(formData.get("id") || "");
  const status = String(formData.get("status") || "");

  if (!id || !validStatuses.includes(status)) {
    throw new Error("Invalid table update.");
  }

  const { error } = await supabase
    .from("tables")
    .update({
      status,
      updated_at: new Date().toISOString(),
    })
    .eq("id", id)
    .eq("restaurant_id", membership.restaurant_id);

  if (error) throw error;

  revalidatePath("/tables");
  revalidatePath("/");
}

export async function updateTable(formData) {
  const { supabase, membership } = await getMembership();

  if (!managerRoles.includes(membership.role)) {
    throw new Error("You do not have permission to edit tables.");
  }

  const id = String(formData.get("id") || "");
  const tableNumber = Number(formData.get("table_number"));
  const name = String(formData.get("name") || "").trim();
  const capacity = Number(formData.get("capacity"));

  if (!id || !Number.isInteger(tableNumber) || tableNumber <= 0) {
    throw new Error("Table number must be a positive whole number.");
  }
  if (!Number.isInteger(capacity) || capacity <= 0) {
    throw new Error("Capacity must be a positive whole number.");
  }

  const { error } = await supabase
    .from("tables")
    .update({ table_number: tableNumber, name: name || null, capacity, updated_at: new Date().toISOString() })
    .eq("id", id)
    .eq("restaurant_id", membership.restaurant_id);

  if (error) throw error;
  revalidatePath("/tables");
}

export async function deleteTable(formData) {
  const { supabase, membership } = await getMembership();

  if (!managerRoles.includes(membership.role)) {
    throw new Error("You do not have permission to delete tables.");
  }

  const id = String(formData.get("id") || "");

  if (!id) throw new Error("Table ID is required.");

  const { error } = await supabase
    .from("tables")
    .delete()
    .eq("id", id)
    .eq("restaurant_id", membership.restaurant_id);

  if (error) throw error;

  revalidatePath("/tables");
  revalidatePath("/");
}
