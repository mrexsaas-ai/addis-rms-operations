import { redirect } from "next/navigation";

export const ROLE_HOME = {
  ADMIN: "/",
  OWNER: "/",
  MANAGER: "/",
  SERVER: "/server",
  CHEF: "/kitchen",
  BARMAN: "/bar",
};

export const ROLES = Object.keys(ROLE_HOME);
export const MANAGEMENT_ROLES = ["ADMIN", "OWNER", "MANAGER"];
export const BUSINESS_ADMIN_ROLES = ["ADMIN", "OWNER"];
export const SERVICE_ROLES = ["ADMIN", "OWNER", "MANAGER", "SERVER"];

export function getRoleHome(role) {
  return ROLE_HOME[role] || "/login";
}

export function isKnownRole(role) {
  return ROLES.includes(role);
}

export async function getMembership(supabase, userId) {
  const { data, error } = await supabase
    .from("restaurant_users")
    .select("restaurant_id, role")
    .eq("user_id", userId)
    .order("created_at", { ascending: true })
    .limit(1)
    .maybeSingle();

  if (error) throw error;

  if (!data) return null;

  const {
    data: restaurant,
    error: restaurantError,
  } = await supabase
    .from("restaurants")
    .select("id, name")
    .eq("id", data.restaurant_id)
    .maybeSingle();

  if (restaurantError) throw restaurantError;

  return {
    ...data,
    restaurants: restaurant,
  };
}

export async function getAuthContext(supabase) {
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();

  if (error) throw error;
  if (!user) return { user: null, membership: null };

  return { user, membership: await getMembership(supabase, user.id) };
}

export async function requireRoles(supabase, allowedRoles, fallback = "/") {
  const context = await getAuthContext(supabase);

  if (!context.user) redirect("/login");
  if (!context.membership || !allowedRoles.includes(context.membership.role)) {
    redirect(fallback);
  }

  return context;
}