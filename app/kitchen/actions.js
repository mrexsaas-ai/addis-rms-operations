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
  if (!id || !["NEW", "PREPARING", "READY", "COMPLETED"].includes(status)) throw new Error("Invalid kitchen status.");
  const { error } = await supabase.from("kitchen_orders").update({ status, updated_at: new Date().toISOString() }).eq("id", id).eq("restaurant_id", membership.restaurant_id).eq("station", "KITCHEN");
  if (error) throw error;
  revalidatePath("/kitchen");
}