import Link from "next/link";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export default async function AdminPage() {
  const { supabase, user } = await getCurrentUser();
  if (!user) redirect("/login");

  const { data: membership } = await supabase.from("restaurant_users").select("role, restaurant_id, restaurants(name)").eq("user_id", user.id).limit(1).maybeSingle();
  if (!membership || !["ADMIN", "OWNER"].includes(membership.role)) {
    return <main className="state-page"><div className="state-panel"><span className="brand-mark">ADDIS RMS</span><p className="eyebrow">ACCESS CONTROL</p><h1>Settings are restricted.</h1><p>Your account does not have Admin or Owner access to this area.</p><Link className="back-link" href="/">Return to dashboard</Link></div></main>;
  }

  const restaurant = Array.isArray(membership.restaurants) ? membership.restaurants[0] : membership.restaurants;
  return <main className="admin-page"><section className="admin-panel"><p className="eyebrow">ADMIN AREA</p><h1>{restaurant?.name || "Restaurant settings"}</h1><p>Admin and Owner settings are protected by the server-side role check and the restaurant membership RLS policies. Foundation settings will be added in later workflow steps.</p><Link className="back-link" href="/">Return to dashboard</Link></section></main>;
}
