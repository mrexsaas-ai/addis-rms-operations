import { redirect } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getAuthContext } from "@/lib/auth";
import SettingsClient from "./SettingsClient";

export const dynamic = "force-dynamic";

export default async function SettingsPage() {
  const supabase = await createSupabaseServerClient();
  const { user, membership } = await getAuthContext(supabase);
  if (!user) redirect("/login");

  if (!membership || !["ADMIN", "OWNER"].includes(membership.role)) {
    return <SettingsClient accessDenied />;
  }

  const { data: restaurant, error: restaurantError } = await supabase
    .from("restaurants")
    .select("id, name, business_legal_name, description, phone, address, logo_url, status")
    .eq("id", membership.restaurant_id)
    .maybeSingle();

  if (restaurantError) throw restaurantError;
  const [{ data: settings, error: settingsError }, { data: accounts, error: accountsError }] = await Promise.all([
    supabase.from("restaurant_settings").select("default_language, receipt_language, enabled_payment_methods").eq("restaurant_id", membership.restaurant_id).maybeSingle(),
    supabase.from("payment_accounts").select("id, type, name, account_name, account_number, branch, verify_et_provider, is_active").eq("restaurant_id", membership.restaurant_id).order("created_at", { ascending: false }),
  ]);

  if (settingsError) throw new Error(settingsError.message);
  if (accountsError) throw new Error(accountsError.message);

  return (
    <main className="settings-page">
      <SettingsClient restaurant={restaurant} settings={settings} accounts={accounts || []} />
    </main>
  );
}
