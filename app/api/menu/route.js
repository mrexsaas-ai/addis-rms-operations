import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";

const managerRoles = ["ADMIN", "OWNER", "MANAGER"];

async function getMembership() {
  const supabase = await createSupabaseServerClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

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

function checkJpg(file) {
  if (!file || file.size === 0) return;

  if (file.type !== "image/jpeg" || !/\.(jpg|jpeg)$/i.test(file.name)) {
    throw new Error("Only JPG or JPEG images are allowed.");
  }

  if (file.size > 5 * 1024 * 1024) {
    throw new Error("Image must be 5MB or smaller.");
  }
}

async function uploadImage(supabase, restaurantId, file) {
  checkJpg(file);

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

function storagePath(url) {
  if (!url) return null;

  const marker = "/object/public/menu-images/";
  const index = url.indexOf(marker);

  if (index === -1) return null;

  return decodeURIComponent(url.slice(index + marker.length));
}

async function redirectBack(request, error = null) {
  const url = new URL("/menu", request.url);

  if (error) {
    url.searchParams.set("error", error);
  }

  return NextResponse.redirect(url, 303);
}

export async function POST(request) {
  try {
    const { supabase, membership } = await getMembership();

    if (!managerRoles.includes(membership.role)) {
      return redirectBack(request, "You do not have permission to manage the menu.");
    }

    const formData = await request.formData();
    const operation = String(formData.get("_action") || "create");

    if (operation === "create_category") {
      const name = String(formData.get("name") || "").trim();

      if (!name) {
        return redirectBack(request, "Category name is required.");
      }

      const { error } = await supabase.from("categories").insert({
        restaurant_id: membership.restaurant_id,
        name,
      });

      if (error) throw error;

      return redirectBack(request);
    }

    if (operation === "create_item") {
      const name = String(formData.get("name") || "").trim();
      const description = String(formData.get("description") || "").trim();
      const categoryId = String(formData.get("category_id") || "").trim();
      const price = Number(formData.get("price"));
      const image = formData.get("image");

      if (!name) return redirectBack(request, "Food name is required.");
      if (!Number.isFinite(price) || price < 0) {
        return redirectBack(request, "Price must be a valid amount.");
      }

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
        image_url: imageUrl,
        is_available: true,
      });

      if (error) throw error;

      return redirectBack(request);
    }

    if (operation === "update_item") {
      const id = String(formData.get("id") || "");
      const name = String(formData.get("name") || "").trim();
      const description = String(formData.get("description") || "").trim();
      const categoryId = String(formData.get("category_id") || "").trim();
      const price = Number(formData.get("price"));
      const isAvailable = String(formData.get("is_available")) === "true";
      const image = formData.get("image");

      if (!id || !name) {
        return redirectBack(request, "Menu item and name are required.");
      }

      if (!Number.isFinite(price) || price < 0) {
        return redirectBack(request, "Price must be a valid amount.");
      }

      const { data: existing, error: existingError } = await supabase
        .from("menu_items")
        .select("image_url")
        .eq("id", id)
        .eq("restaurant_id", membership.restaurant_id)
        .single();

      if (existingError) throw existingError;

      let imageUrl = existing.image_url;

      if (image && image.size > 0) {
        imageUrl = await uploadImage(
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
          image_url: imageUrl,
          is_available: isAvailable,
          updated_at: new Date().toISOString(),
        })
        .eq("id", id)
        .eq("restaurant_id", membership.restaurant_id);

      if (error) throw error;

      if (image && image.size > 0 && existing.image_url) {
        const oldPath = storagePath(existing.image_url);

        if (oldPath) {
          await supabase.storage
            .from("menu-images")
            .remove([oldPath]);
        }
      }

      return redirectBack(request);
    }

    if (operation === "delete_item") {
      const id = String(formData.get("id") || "");

      if (!id) return redirectBack(request, "Menu item ID is required.");

      const { data: existing, error: existingError } = await supabase
        .from("menu_items")
        .select("image_url")
        .eq("id", id)
        .eq("restaurant_id", membership.restaurant_id)
        .single();

      if (existingError) throw existingError;

      const { error } = await supabase
        .from("menu_items")
        .delete()
        .eq("id", id)
        .eq("restaurant_id", membership.restaurant_id);

      if (error) throw error;

      if (existing.image_url) {
        const oldPath = storagePath(existing.image_url);

        if (oldPath) {
          await supabase.storage
            .from("menu-images")
            .remove([oldPath]);
        }
      }

      return redirectBack(request);
    }

    return redirectBack(request, "Unknown menu operation.");
  } catch (error) {
    console.error("MENU API ERROR:", error);
    return redirectBack(
      request,
      error?.message || "Unexpected menu server error."
    );
  }
}
