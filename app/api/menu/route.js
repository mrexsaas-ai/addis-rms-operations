import { NextResponse } from "next/server";
import { randomUUID } from "node:crypto";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { assertActiveRestaurantMembership, getMembership as getAuthMembership } from "@/lib/auth";
import { getStoragePath, removeMenuImage, uploadMenuImage } from "@/lib/menu-images";

const managerRoles = ["ADMIN", "OWNER", "MANAGER"];

function describeError(error) {
  if (!error) return null;
  const status = error.status ?? error.statusCode ?? error.context?.status ?? null;
  const numericStatus = status === null ? null : Number(status);

  return {
    name: error.name || null,
    message: error.message ?? null,
    code: error.code ?? null,
    details: error.details ?? null,
    hint: error.hint ?? null,
    httpStatus: numericStatus !== null && Number.isFinite(numericStatus) ? numericStatus : status,
    statusText: error.statusText ?? error.context?.statusText ?? null,
  };
}

function getSafeErrorFields(error) {
  return {
    code: error?.code ?? null,
    message: error?.message ?? null,
    details: error?.details ?? null,
    hint: error?.hint ?? null,
  };
}

function getErrorHttpStatus(error) {
  const status = error?.status ?? error?.statusCode ?? error?.context?.status;
  const numericStatus = Number(status);
  return Number.isInteger(numericStatus) && numericStatus >= 400 && numericStatus <= 599
    ? numericStatus
    : 500;
}

function createDiagnosticLogger(requestId) {
  return (stage, details = {}) => {
    if (process.env.NODE_ENV !== "development") return;
    console.info(`[menu-save diagnostic] ${JSON.stringify({ requestId, stage, ...details })}`);
  };
}

async function getMembership(diagnostic) {
  const supabase = await createSupabaseServerClient();

  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  diagnostic("auth.getUser.response", {
    userFound: Boolean(user),
    error: describeError(authError),
  });

  if (authError) throw authError;
  if (!user) throw new Error("You must be signed in.");

  diagnostic("membership.lookup.started");
  let membership;
  try {
    membership = await getAuthMembership(supabase, user.id);
  } catch (error) {
    const originalError = error;
    diagnostic("membership.lookup.failed", { error: getSafeErrorFields(originalError) });
    throw originalError;
  }
  assertActiveRestaurantMembership(membership);
  diagnostic("membership.lookup.response", {
    restaurantId: membership.restaurant_id,
    role: membership.role,
  });

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

async function discardFailedUpload(supabase, path, diagnostic) {
  if (!path) return;
  try {
    await removeMenuImage(supabase, path, diagnostic);
  } catch (error) {
    const originalError = error;
    diagnostic("storage.rollback.failed", {
      bucket: "menu-images",
      objectPath: path,
      error: getSafeErrorFields(originalError),
    });
  }
}

async function redirectBack(request, error = null, diagnostic = () => {}) {
  const url = new URL("/menu", request.url);

  if (error) {
    url.searchParams.set("error", error);
  }

  const response = NextResponse.redirect(url, 303);
  diagnostic("frontend.redirect", {
    location: `${url.pathname}${url.search}`,
    httpStatus: response.status,
    errorCode: error,
  });
  return response;
}

export async function POST(request) {
  const requestId = randomUUID();
  const diagnostic = createDiagnosticLogger(requestId);
  let stage = "supabase.client";
  let operation = "unknown";
  let itemId = null;
  let restaurantId = null;

  diagnostic("request.received", { method: request.method });

  try {
    stage = "auth.membership";
    const { supabase, membership } = await getMembership(diagnostic);
    restaurantId = membership.restaurant_id;

    if (!managerRoles.includes(membership.role)) {
      throw new Error(`Role ${membership.role} is not permitted to manage menu items.`);
    }

    stage = "request.formData";
    const formData = await request.formData();
    operation = String(formData.get("_action") || "create");
    const selectedFile = formData.get("image");
    diagnostic("request.parsed", {
      operation,
      restaurantId,
      role: membership.role,
      file: selectedFile && selectedFile.size > 0
        ? { name: selectedFile.name, type: selectedFile.type, size: selectedFile.size }
        : null,
    });

    if (operation === "create_category") {
      stage = "form.create_category.validate";
      const name = String(formData.get("name") || "").trim();

      if (!name) {
        throw new Error("Category name is required.");
      }

      stage = "db.categories.insert";
      const response = await supabase.from("categories").insert({
        restaurant_id: membership.restaurant_id,
        name,
      });
      diagnostic("db.categories.insert.response", {
        table: "categories",
        response: {
          data: response.data || null,
          error: describeError(response.error),
          httpStatus: response.status,
          statusText: response.statusText,
        },
      });

      if (response.error) throw response.error;

      return redirectBack(request, null, diagnostic);
    }

    if (operation === "create_item") {
      stage = "form.create_item.validate";
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
      if (!["KITCHEN", "BAR"].includes(station)) {
        throw new Error("Choose a valid preparation station.");
      }

      checkJpg(image);
      stage = "storage.upload";
      const imageUrl = image?.size
        ? await uploadMenuImage(supabase, membership.restaurant_id, image, diagnostic)
        : null;

      stage = "db.menu_items.insert";
      const response = await supabase.from("menu_items").insert({
        restaurant_id: membership.restaurant_id,
        category_id: categoryId || null,
        name,
        description: description || null,
        price,
        station,
        image_url: imageUrl,
        is_available: true,
      }).select("id, restaurant_id, image_url").single();
      const { data: inserted, error } = response;
      diagnostic("db.menu_items.insert.response", {
        table: "menu_items",
        restaurantId,
        objectPath: imageUrl,
        response: {
          data: inserted || null,
          error: describeError(error),
          httpStatus: response.status,
          statusText: response.statusText,
        },
      });

      if (error || !inserted) {
        await discardFailedUpload(supabase, imageUrl, diagnostic);
        throw error || new Error("Menu item was not created.");
      }

      return redirectBack(request, null, diagnostic);
    }

    if (operation === "update_item") {
      stage = "form.update_item.validate";
      const id = String(formData.get("id") || "");
      itemId = id;
      const name = String(formData.get("name") || "").trim();
      const description = String(formData.get("description") || "").trim();
      const categoryId = String(formData.get("category_id") || "").trim();
      const price = Number(formData.get("price"));
      const station = String(formData.get("station") || "KITCHEN").toUpperCase();
      const isAvailable = String(formData.get("is_available")) === "true";
      const image = formData.get("image");

      if (!id || !name) {
        throw new Error("Menu item and name are required.");
      }

      if (!Number.isFinite(price) || price < 0) {
        throw new Error("Price must be a valid amount.");
      }
      if (!["KITCHEN", "BAR"].includes(station)) {
        throw new Error("Choose a valid preparation station.");
      }

      stage = "db.menu_items.existing.select";
      const existingResponse = await supabase
        .from("menu_items")
        .select("id, restaurant_id, image_url")
        .eq("id", id)
        .eq("restaurant_id", membership.restaurant_id)
        .single();
      const { data: existing, error: existingError } = existingResponse;
      diagnostic("db.menu_items.existing.response", {
        table: "menu_items",
        itemId: id,
        restaurantId,
        filters: { id, restaurant_id: restaurantId },
        response: {
          data: existing
            ? {
                id: existing.id,
                restaurant_id: existing.restaurant_id,
                imagePath: getStoragePath(existing.image_url),
              }
            : null,
          error: describeError(existingError),
          httpStatus: existingResponse.status,
          statusText: existingResponse.statusText,
        },
      });

      if (existingError) throw existingError;

      checkJpg(image);
      let imageUrl = existing.image_url;
      let uploadedImagePath = null;

      if (image && image.size > 0) {
        stage = "storage.upload";
        uploadedImagePath = await uploadMenuImage(supabase, membership.restaurant_id, image, diagnostic);
        imageUrl = uploadedImagePath;
      }

      stage = "db.menu_items.update";
      const response = await supabase
        .from("menu_items")
        .update({
          name,
          description: description || null,
          category_id: categoryId || null,
          price,
          station,
          image_url: imageUrl,
          is_available: isAvailable,
          updated_at: new Date().toISOString(),
        })
        .eq("id", id)
        .eq("restaurant_id", membership.restaurant_id)
        .select("id, restaurant_id, image_url")
        .maybeSingle();
      const { data: updated, error } = response;
      diagnostic("db.menu_items.update.response", {
        table: "menu_items",
        itemId: id,
        restaurantId,
        filters: { id, restaurant_id: restaurantId },
        imagePath: imageUrl ? getStoragePath(imageUrl) : null,
        response: {
          data: updated || null,
          error: describeError(error),
          httpStatus: response.status,
          statusText: response.statusText,
        },
      });

      if (error || !updated) {
        await discardFailedUpload(supabase, uploadedImagePath, diagnostic);
        throw error || new Error("Menu item was not updated.");
      }

      if (image && image.size > 0 && existing.image_url) {
        const oldPath = getStoragePath(existing.image_url);

        if (oldPath) {
          try {
            await removeMenuImage(supabase, oldPath, diagnostic);
          } catch (cleanupError) {
            const originalError = cleanupError;
            diagnostic("storage.old-image.cleanup.failed", {
              bucket: "menu-images",
              objectPath: oldPath,
              error: getSafeErrorFields(originalError),
            });
          }
        }
      }

      return redirectBack(request, null, diagnostic);
    }

    if (operation === "delete_item") {
      stage = "form.delete_item.validate";
      const id = String(formData.get("id") || "");
      itemId = id;

      if (!id) throw new Error("Menu item ID is required.");

      stage = "db.menu_items.delete.preflight";
      const { data: existing, error: existingError } = await supabase
        .from("menu_items")
        .select("image_url")
        .eq("id", id)
        .eq("restaurant_id", membership.restaurant_id)
        .single();

      if (existingError) throw existingError;

      stage = "db.menu_items.delete";
      const { error } = await supabase
        .from("menu_items")
        .delete()
        .eq("id", id)
        .eq("restaurant_id", membership.restaurant_id);

      if (error) throw error;

      if (existing.image_url) {
        const oldPath = getStoragePath(existing.image_url);

        if (oldPath) {
          await supabase.storage
            .from("menu-images")
            .remove([oldPath]);
        }
      }

      return redirectBack(request, null, diagnostic);
    }

    throw new Error(`Unknown menu operation: ${operation}`);
  } catch (error) {
    const originalError = error;
    const errorFields = getSafeErrorFields(originalError);
    diagnostic("request.failed", {
      stage,
      operation,
      restaurantId,
      itemId,
      error: errorFields,
    });
    console.error(`[menu-save] request failed ${JSON.stringify({
      requestId,
      stage,
      operation,
      restaurantId,
      itemId,
      ...errorFields,
    })}`);
    if (process.env.NODE_ENV === "development") {
      return NextResponse.json({
        ok: false,
        requestId,
        stage,
        error: errorFields,
      }, { status: getErrorHttpStatus(originalError) });
    }
    return redirectBack(request, "menuSaveFailed", diagnostic);
  }
}
