import { redirect } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { SERVICE_ROLES, getAuthContext } from "@/lib/auth";
import ServerPOSClient from "./ServerPOSClient";

export const dynamic = "force-dynamic";

export default async function ServerPage() {
  const supabase = await createSupabaseServerClient();
  const { user, membership } = await getAuthContext(supabase);

  if (!user) redirect("/login");
  if (!membership || !SERVICE_ROLES.includes(membership.role)) redirect("/");

  const results = await Promise.all([
    supabase
      .from("tables")
      .select("id, table_number, name, capacity, status")
      .eq("restaurant_id", membership.restaurant_id)
      .order("table_number", { ascending: true }),
    supabase
      .from("categories")
      .select("id, name")
      .eq("restaurant_id", membership.restaurant_id)
      .order("name", { ascending: true }),
    supabase
      .from("menu_items")
      .select("id, name, description, price, image_url, station, is_available, category_id")
      .eq("restaurant_id", membership.restaurant_id)
      .eq("is_available", true)
      .order("name", { ascending: true }),
    supabase
      .from("payment_accounts")
      .select("id, type, name, account_name, account_number, branch, is_active")
      .eq("restaurant_id", membership.restaurant_id)
      .eq("is_active", true)
      .order("created_at", { ascending: false }),
  ]);

  const queryError = results.find((result) => result.error)?.error;
  if (queryError) throw queryError;

  const [{ data: tables }, { data: categories }, { data: menuItems }, { data: paymentAccounts }] = results;

  const restaurant = Array.isArray(membership.restaurants)
    ? membership.restaurants[0]
    : membership.restaurants;

  return (
    <main className="workspace-page">
      <ServerPOSClient
        restaurantName={restaurant?.name || "Restaurant"}
        tables={tables || []}
        categories={categories || []}
        menuItems={menuItems || []}
        paymentAccounts={paymentAccounts || []}
      />
    </main>
  );
}
