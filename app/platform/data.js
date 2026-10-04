import { createClient } from "@supabase/supabase-js";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { requirePlatformAdmin } from "@/lib/auth";

function createPlatformDataClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceRoleKey) throw new Error("Platform management is not configured.");
  return createClient(url, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}

export async function getPlatformDashboardData() {
  const supabase = await createSupabaseServerClient();
  await requirePlatformAdmin(supabase);

  const admin = createPlatformDataClient();
  const [
    { data: restaurants, error: restaurantsError },
    { data: owners, error: ownersError },
  ] = await Promise.all([
    admin.from("restaurants")
      .select("id, name, business_legal_name, status, created_at")
      .order("created_at", { ascending: false }),
    admin.from("restaurant_users")
      .select("restaurant_id, user_id, created_at")
      .eq("role", "OWNER")
      .order("created_at", { ascending: true }),
  ]);

  if (restaurantsError) throw restaurantsError;
  if (ownersError) throw ownersError;

  const ownerByRestaurant = new Map();
  for (const owner of owners || []) {
    if (!ownerByRestaurant.has(owner.restaurant_id)) {
      ownerByRestaurant.set(owner.restaurant_id, owner.user_id);
    }
  }

  const ownerEntries = await Promise.all(
    [...ownerByRestaurant.entries()].map(async ([restaurantId, userId]) => {
      const { data, error } = await admin.auth.admin.getUserById(userId);
      if (error) return [restaurantId, null];
      return [restaurantId, data.user?.email || null];
    })
  );
  const ownerEmailByRestaurant = new Map(ownerEntries);

  return (restaurants || []).map((restaurant) => ({
    id: restaurant.id,
    name: restaurant.name,
    businessLegalName: restaurant.business_legal_name,
    status: restaurant.status,
    createdAt: restaurant.created_at,
    ownerEmail: ownerEmailByRestaurant.get(restaurant.id) || null,
  }));
}