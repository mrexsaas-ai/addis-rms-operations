import { redirect } from "next/navigation";
import { isActiveRestaurantStatus } from "./restaurant-lifecycle.mjs";

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

export function assertActiveRestaurantMembership(membership) {
  const restaurant = Array.isArray(membership?.restaurants)
    ? membership.restaurants[0]
    : membership?.restaurants;

  if (!membership) throw new Error("Restaurant membership not found.");
  if (!isActiveRestaurantStatus(restaurant?.status)) {
    throw new Error("This restaurant is inactive.");
  }

  return membership;
}

export async function getMembership(supabase, userId) {
  const { data, error } = await supabase
    .from("restaurant_users")
    .select("restaurant_id, role")
    .eq("user_id", userId)
    .order("created_at", { ascending: true })
    .limit(2);

  if (error) throw error;

  if (!data?.length) return null;
  if (data.length > 1) {
    throw new Error("Multiple restaurant memberships require an explicit restaurant selection.");
  }

  const membership = data[0];

  const {
    data: restaurant,
    error: restaurantError,
  } = await supabase
    .from("restaurants")
    .select("id, name, status")
    .eq("id", membership.restaurant_id)
    .maybeSingle();

  if (restaurantError) throw restaurantError;

  return {
    ...membership,
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

  const membership = await getMembership(supabase, user.id);
  const restaurantInactive = Boolean(
    membership && !isActiveRestaurantStatus(membership.restaurants?.status)
  );

  return {
    user,
    membership: restaurantInactive ? null : membership,
    restaurantInactive,
  };
}

export async function requireActiveRestaurantAccess(supabase) {
  const context = await getAuthContext(supabase);

  if (!context.user) throw new Error("You must be signed in.");
  if (context.restaurantInactive) throw new Error("This restaurant is inactive.");
  assertActiveRestaurantMembership(context.membership);

  return context;
}

export async function requirePlatformAdmin(supabase) {
  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();

  if (userError) throw userError;
  if (!user) redirect("/login");

  const { data: platformAdmin, error: platformAdminError } = await supabase
    .from("platform_admins")
    .select("user_id")
    .eq("user_id", user.id)
    .maybeSingle();

  if (platformAdminError) throw platformAdminError;
  if (!platformAdmin) redirect("/");

  return { supabase, user, platformAdmin };
}

export async function requireRoles(supabase, allowedRoles, fallback = "/") {
  const context = await getAuthContext(supabase);

  if (!context.user) redirect("/login");
  if (!context.membership || !allowedRoles.includes(context.membership.role)) {
    redirect(fallback);
  }

  return context;
}