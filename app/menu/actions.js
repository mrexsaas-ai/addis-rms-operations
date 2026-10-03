"use server";

import { revalidatePath } from "next/cache";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { assertActiveRestaurantMembership, getAuthContext } from "@/lib/auth";
import { getSignedMenuImageUrl, getStoragePath, removeMenuImage, uploadMenuImage } from "@/lib/menu-images";

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
    .select("restaurant_id, role, restaurants(status)")
    .eq("user_id", user.id)
    .limit(1)
    .maybeSingle();

  if (error) throw error;
  assertActiveRestaurantMembership(membership);

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

async function uploadImage(supabase, restaurantId, file) {
  validateImage(file);

  if (!file || file.size === 0) return null;
  return uploadMenuImage(supabase, restaurantId, file);
}

export async function refreshMenuImageUrl(value) {
  const supabase = await createSupabaseServerClient();
  const { user, membership } = await getAuthContext(supabase);

  if (!user) throw new Error("You must be signed in.");
  if (!membership) throw new Error("Restaurant membership not found.");

  const path = getStoragePath(value);
  if (!path || !path.startsWith(`${membership.restaurant_id}/`)) {
    throw new Error("Menu image does not belong to this restaurant.");
  }

  return getSignedMenuImageUrl(supabase, path);
}

async function discardFailedUpload(supabase, path) {
  if (!path) return;
  try {
    await removeMenuImage(supabase, path);
  } catch (error) {
    console.error("MENU IMAGE CLEANUP ERROR:", error);
  }
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

  const imageUrl = await uploadImage(
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

  if (error) {
    await discardFailedUpload(supabase, imageUrl);
    throw error;
  }

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
    imageUrl = await uploadImage(
      supabase,
      membership.restaurant_id,
      image
    );
  }

  const { data: updated, error } = await supabase
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
    .eq("restaurant_id", membership.restaurant_id)
    .select("id")
    .maybeSingle();

  if (error || !updated) {
    await discardFailedUpload(supabase, image && image.size > 0 ? imageUrl : null);
    throw error || new Error("Menu item was not updated.");
  }

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
