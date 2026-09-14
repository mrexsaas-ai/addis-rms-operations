import Link from "next/link";
import { redirect } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import SettingsClient from "./SettingsClient";

export const dynamic = "force-dynamic";

export default async function SettingsPage() {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();

  if (userError) throw userError;
  if (!user) redirect("/login");

  const { data: membership, error: membershipError } = await supabase
    .from("restaurant_users")
    .select("role, restaurant_id")
    .eq("user_id", user.id)
    .limit(1)
    .maybeSingle();

  if (membershipError) throw new Error(membershipError.message);

  if (!membership || !["ADMIN", "OWNER"].includes(membership.role)) {
    return (
      <main className="state-page">
        <div className="state-panel">
          <span className="brand-mark">ADDIS RMS</span>
          <p className="eyebrow">ACCESS CONTROL</p>
          <h1>Settings are restricted.</h1>
          <p>Your account does not have Admin or Owner access to this area.</p>
          <Link className="back-link" href="/">Return to dashboard</Link>
        </div>
      </main>
    );
  }

  const { data: restaurant, error: restaurantError } = await supabase
    .from("restaurants")
    .select("id, name, phone, address, logo_url")
    .eq("id", membership.restaurant_id)
    .maybeSingle();

  if (restaurantError) throw restaurantError;

  const [{ data: settings, error: settingsError }, { data: accounts, error: accountsError }] = await Promise.all([
    supabase.from("restaurant_settings").select("default_language, receipt_language, enabled_payment_methods").eq("restaurant_id", membership.restaurant_id).maybeSingle(),
    supabase.from("payment_accounts").select("id, type, name, account_name, account_number, branch, qr_code_url, is_active").eq("restaurant_id", membership.restaurant_id).order("created_at", { ascending: false }),
  ]);

  if (settingsError) throw new Error(settingsError.message);
  if (accountsError) throw new Error(accountsError.message);

  return (
    <main className="settings-page">
      <SettingsClient restaurant={restaurant} settings={settings} accounts={accounts || []} />
    </main>
  );
}
