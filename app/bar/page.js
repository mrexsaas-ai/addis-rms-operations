import { redirect } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getAuthContext } from "@/lib/auth";
import { updateBarOrder } from "./actions";
import WorkspaceLiveAlerts from "../WorkspaceLiveAlerts";
import StationOrderBoard from "../StationOrderBoard";
import StationWorkspaceHeader from "../StationWorkspaceHeader";
import StockRequestForm from "../inventory/StockRequestForm";
import StockRequestResults from "../inventory/StockRequestResults";
import { getSignedMenuImageUrl } from "@/lib/menu-images";
import MenuItemsLiveRefresh from "../MenuItemsLiveRefresh";

export const dynamic = "force-dynamic";

export default async function BarPage({ searchParams = {} }) {
  const supabase = await createSupabaseServerClient();
  const { user, membership } = await getAuthContext(supabase);
  if (!user) redirect("/login");
  if (!membership || !["ADMIN", "OWNER", "MANAGER", "BARMAN"].includes(membership.role)) redirect("/");
  const resolvedSearchParams = await searchParams;
  const inventoryTab = resolvedSearchParams?.tab === "inventory";
  let stockRequestResults = [];
  if (inventoryTab) {
    const { data, error } = await supabase
      .from("stock_requests")
      .select("id, requested_item_name, status, quantity, unit, note")
      .eq("restaurant_id", membership.restaurant_id)
      .eq("requested_by_user_id", user.id)
      .eq("station", "BAR")
      .in("status", ["APPROVED", "REJECTED"])
      .order("updated_at", { ascending: false });
    if (error) throw error;
    stockRequestResults = data || [];
  }
  const { data: orders, error: ordersError } = await supabase
      .from("kitchen_orders")
      .select("id, status, created_at, orders(order_number, notes, tables(table_number, name), order_items(quantity, notes, menu_item_id, menu_items(name, image_url, station)))")
      .eq("restaurant_id", membership.restaurant_id)
      .eq("station", "BAR")
      .order("created_at", { ascending: true });
  if (ordersError) throw ordersError;
  const stationOrders = await Promise.all((orders || []).map(async (order) => ({
    ...order,
    orders: {
      ...order.orders,
      order_items: await Promise.all((order.orders?.order_items || [])
        .filter((item) => item.menu_items?.station === "BAR")
        .map(async (item) => ({ ...item, menu_items: { ...item.menu_items, image_url: await getSignedMenuImageUrl(supabase, item.menu_items.image_url) } }))),
    },
  })));
  return (
    <main className="workspace-page kds-shell kds-shell--bar">
      <MenuItemsLiveRefresh restaurantId={membership.restaurant_id} />
      <StationWorkspaceHeader station="BAR" inventoryTab={inventoryTab} />

      <WorkspaceLiveAlerts restaurantId={membership.restaurant_id} station="BAR" />
      {inventoryTab && (
        <>
          <StockRequestForm station="BAR" />
          <StockRequestResults requests={stockRequestResults} restaurantId={membership.restaurant_id} userId={user.id} />
        </>
      )}
      {!inventoryTab && <StationOrderBoard orders={stationOrders} updateAction={updateBarOrder} station="BAR" />}
    </main>
  );
}