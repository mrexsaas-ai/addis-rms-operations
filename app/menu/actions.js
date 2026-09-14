"use server";

import { revalidatePath } from "next/cache";
import { createSupabaseServerClient } from "@/lib/supabase/server";

const managerRoles = ["ADMIN", "OWNER", "MANAGER"];

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

  return { supabase, membership };
}

function validateImage(file) {
  if (!file || file.size === 0) return;

  if (file.type !== "image/jpeg" || !/\.(jpg|jpeg)$/i.test(file.name)) {
    throw new Error("Only JPG or JPEG images are allowed.");
  }

  if (file.size > 5 * 1024 * 1024) {
    throw new Error("Image must be 5MB or smaller.");
  }
}

async function uploadMenuImage(supabase, restaurantId, file) {
  validateImage(file);

  if (!file || file.size === 0) return null;

  const extension = file.name.toLowerCase().endsWith(".jpeg")
    ? "jpeg"
    : "jpg";

  const path = `${restaurantId}/${crypto.randomUUID()}.${extension}`;

  const { error } = await supabase.storage
    .from("menu-images")
    .upload(path, file, {
      contentType: "image/jpeg",
      cacheControl: "3600",
      upsert: false,
    });

  if (error) throw error;

  const { data } = supabase.storage
    .from("menu-images")
    .getPublicUrl(path);

  return data.publicUrl;
}

export async function createCategory(formData) {
  const { supabase, membership } = await getMembership();

  if (!managerRoles.includes(membership.role)) {
    throw new Error("You do not have permission to create categories.");
  }

  const name = String(formData.get("name") || "").trim();

  if (!name) throw new Error("Category name is required.");

  const { error } = await supabase.from("categories").insert({
    restaurant_id: membership.restaurant_id,
    name,
  });

  if (error) throw error;

  revalidatePath("/menu");
  revalidatePath("/");
}

export async function createMenuItem(formData) {
  const { supabase, membership } = await getMembership();

  if (!managerRoles.includes(membership.role)) {
    throw new Error("You do not have permission to create menu items.");
  }

  const name = String(formData.get("name") || "").trim();
  const description = String(formData.get("description") || "").trim();
  const categoryId = String(formData.get("category_id") || "").trim();
  const price = Number(formData.get("price"));
  const station = String(formData.get("station") || "KITCHEN").toUpperCase();
  const image = formData.get("image");

  if (!name) throw new Error("Food name is required.");
  if (!Number.isFinite(price) || price < 0) {
    throw new Error("Price must be a valid amount.");
  }
  if (!["KITCHEN", "BAR"].includes(station)) throw new Error("Choose a valid preparation station.");

  const imageUrl = await uploadMenuImage(
    supabase,
    membership.restaurant_id,
    image
  );

  const { error } = await supabase.from("menu_items").insert({
    restaurant_id: membership.restaurant_id,
    category_id: categoryId || null,
    name,
    description: description || null,
    price,
    station,
    image_url: imageUrl,
    is_available: true,
  });

  if (error) throw error;

  revalidatePath("/menu");
  revalidatePath("/");
}

export async function updateMenuItem(formData) {
  const { supabase, membership } = await getMembership();

  if (!managerRoles.includes(membership.role)) {
    throw new Error("You do not have permission to edit menu items.");
  }

  const id = String(formData.get("id") || "");
  const name = String(formData.get("name") || "").trim();
  const description = String(formData.get("description") || "").trim();
  const categoryId = String(formData.get("category_id") || "").trim();
  const price = Number(formData.get("price"));
  const station = String(formData.get("station") || "KITCHEN").toUpperCase();
  const available = formData.get("is_available") === "true";
  const image = formData.get("image");

  if (!id || !name) throw new Error("Menu item and name are required.");
  if (!Number.isFinite(price) || price < 0) {
    throw new Error("Price must be a valid amount.");
  }
  if (!["KITCHEN", "BAR"].includes(station)) throw new Error("Choose a valid preparation station.");

  let imageUrl = null;

  const { data: existing, error: existingError } = await supabase
    .from("menu_items")
    .select("image_url")
    .eq("id", id)
    .eq("restaurant_id", membership.restaurant_id)
    .single();

  if (existingError) throw existingError;

  imageUrl = existing.image_url;

  if (image && image.size > 0) {
    imageUrl = await uploadMenuImage(
      supabase,
      membership.restaurant_id,
      image
    );
  }

  const { error } = await supabase
    .from("menu_items")
    .update({
      name,
      description: description || null,
      category_id: categoryId || null,
      price,
      station,
      image_url: imageUrl,
      is_available: available,
      updated_at: new Date().toISOString(),
    })
    .eq("id", id)
    .eq("restaurant_id", membership.restaurant_id);

  if (error) throw error;

  revalidatePath("/menu");
  revalidatePath("/");
}

export async function deleteMenuItem(formData) {
  const { supabase, membership } = await getMembership();

  if (!managerRoles.includes(membership.role)) {
    throw new Error("You do not have permission to delete menu items.");
  }

  const id = String(formData.get("id") || "");

  if (!id) throw new Error("Menu item ID is required.");

  const { error } = await supabase
    .from("menu_items")
    .delete()
    .eq("id", id)
    .eq("restaurant_id", membership.restaurant_id);

  if (error) throw error;

  revalidatePath("/menu");
  revalidatePath("/");
}
