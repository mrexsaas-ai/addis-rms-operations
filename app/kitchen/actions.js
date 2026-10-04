"use server";

import { revalidatePath } from "next/cache";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getAuthContext } from "@/lib/auth";

export async function updateKitchenOrder(formData) {
  const supabase = await createSupabaseServerClient();
  const { user, membership } = await getAuthContext(supabase);
  if (!user || !membership || !["ADMIN", "OWNER", "MANAGER", "CHEF"].includes(membership.role)) throw new Error("Kitchen access denied.");
  const id = String(formData.get("id") || "");
  const status = String(formData.get("status") || "");
  if (!id || !["NEW", "PREPARING", "COMPLETED"].includes(status)) throw new Error("Invalid kitchen status.");

  const { data: currentOrder, error: readError } = await supabase
    .from("kitchen_orders")
    .select("status")
    .eq("id", id)
    .eq("restaurant_id", membership.restaurant_id)
    .eq("station", "KITCHEN")
    .maybeSingle();

  if (readError) throw readError;
  if (!currentOrder) throw new Error("Kitchen order not found in this restaurant.");

  if (status === "COMPLETED") {
    const { error: completionError } = await supabase.rpc("complete_station_order", {
      p_kitchen_order_id: id,
    });
    if (completionError) throw completionError;
    revalidatePath("/kitchen");
    revalidatePath("/inventory");
    return { success: true, status };
  }

  const allowedTransitions = {
    NEW: "PREPARING",
    PREPARING: "COMPLETED",
    COMPLETED: null,
  };
  if (allowedTransitions[currentOrder.status] !== status) {
    throw new Error(`Kitchen order cannot move from ${currentOrder.status} to ${status}.`);
  }

  const { error } = await supabase.rpc("start_station_order", {
    p_kitchen_order_id: id,
  });
  if (error) throw error;
  revalidatePath("/kitchen");
  return { success: true, status };
}