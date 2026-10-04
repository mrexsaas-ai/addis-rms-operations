import { redirect } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getMembership } from "@/lib/auth";
import { isActiveRestaurantStatus } from "@/lib/restaurant-lifecycle.mjs";
import AdminAccessView from "./AdminAccessView";

export const dynamic = "force-dynamic";

export default async function AdminPage() {
  const supabase = await createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const membership = await getMembership(supabase, user.id);
  const restaurant = membership?.restaurants;
  if (!membership || !["ADMIN", "OWNER"].includes(membership.role) || !isActiveRestaurantStatus(restaurant?.status)) {
    return <AdminAccessView restricted />;
  }

  return <AdminAccessView restaurantName={restaurant?.name || ""} />;
}
