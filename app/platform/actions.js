"use server";

import { revalidatePath } from "next/cache";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { requirePlatformAdmin } from "@/lib/auth";
import { isRestaurantStatus } from "@/lib/restaurant-lifecycle.mjs";

export async function getRestaurantStatusEvents(restaurantId) {
  const supabase = await createSupabaseServerClient();
  await requirePlatformAdmin(supabase);

  const normalizedRestaurantId = String(restaurantId || "").trim();
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(normalizedRestaurantId)) {
    throw new Error("Choose a valid restaurant.");
  }

  const { data, error } = await supabase
    .from("restaurant_status_events")
    .select("id, actor_user_id, previous_status, new_status, created_at")
    .eq("restaurant_id", normalizedRestaurantId)
    .order("created_at", { ascending: false })
    .limit(20);

  if (error) throw new Error("Restaurant status history could not be loaded.");
  return data || [];
}

export async function changeRestaurantStatus(restaurantId, status) {
  const supabase = await createSupabaseServerClient();
  await requirePlatformAdmin(supabase);

  const normalizedRestaurantId = String(restaurantId || "").trim();
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(normalizedRestaurantId)) {
    throw new Error("Choose a valid restaurant.");
  }
  if (!isRestaurantStatus(status)) {
    throw new Error("Choose a valid restaurant status.");
  }

  const { data, error } = await supabase.rpc("set_restaurant_status", {
    p_restaurant_id: normalizedRestaurantId,
    p_new_status: status,
  });

  if (error) throw new Error("Restaurant status could not be changed.");
  revalidatePath("/platform");
  return data;
}