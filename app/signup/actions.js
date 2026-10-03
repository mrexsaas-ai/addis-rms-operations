"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@supabase/supabase-js";
import { createSupabaseServerClient } from "@/lib/supabase/server";

const BUSINESS_TYPES = ["Restaurant", "Cafe", "Hotel", "Other food-service business"];

function getServiceClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !serviceKey) {
    throw new Error("Supabase service role configuration is missing.");
  }

  return createClient(url, serviceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}

export async function provisionRestaurant(formData) {
  const supabase = await createSupabaseServerClient();
  const { data: { user }, error: authError } = await supabase.auth.getUser();

  if (authError) throw authError;
  if (!user) throw new Error("Sign in before creating a restaurant.");
  if (!user.email_confirmed_at) throw new Error("Verify your email before creating a restaurant.");
  if (String(user.email || "").toLowerCase() === "you@gmail.com") {
    throw new Error("The sample owner email cannot be used.");
  }

  const restaurantName = String(formData.get("restaurant_name") || user.user_metadata?.business_name || "").trim();
  const businessLegalName = String(formData.get("business_legal_name") || user.user_metadata?.business_legal_name || user.user_metadata?.business_name || restaurantName).trim();
  const businessType = String(formData.get("business_type") || user.user_metadata?.business_type || "Restaurant").trim();
  const fullName = String(formData.get("full_name") || user.user_metadata?.full_name || "").trim();

  if (!businessLegalName) throw new Error("Business name is required.");
  if (businessLegalName.length > 160) throw new Error("Business name is too long.");
  if (!restaurantName) throw new Error("Restaurant name is required.");
  if (restaurantName.length > 160) throw new Error("Business display name is too long.");
  if (!BUSINESS_TYPES.includes(businessType)) throw new Error("Business category is not supported.");
  if (!fullName) throw new Error("Full name is required.");
  if (!user.email) throw new Error("An authenticated owner email is required.");

  const admin = getServiceClient();
  const { data: existingMembership, error: membershipLookupError } = await admin
    .from("restaurant_users")
    .select("restaurant_id, role")
    .eq("user_id", user.id)
    .limit(2);

  if (membershipLookupError) throw membershipLookupError;
  if (existingMembership?.length > 1) {
    throw new Error("Multiple restaurant memberships require an explicit restaurant selection.");
  }
  if (existingMembership?.[0]) return { success: true, restaurantId: existingMembership[0].restaurant_id, existing: true };

  const { data: restaurant, error: restaurantError } = await admin
    .from("restaurants")
    .insert({ name: restaurantName, business_legal_name: businessLegalName, description: businessType })
    .select("id")
    .single();

  if (restaurantError) throw restaurantError;

  let profileCreated = false;
  try {
    const { data: existingProfile, error: profileLookupError } = await admin
      .from("profiles")
      .select("id")
      .eq("id", user.id)
      .maybeSingle();
    if (profileLookupError) throw profileLookupError;

    if (existingProfile) {
      const { error: profileUpdateError } = await admin
        .from("profiles")
        .update({ full_name: fullName, updated_at: new Date().toISOString() })
        .eq("id", user.id);
      if (profileUpdateError) throw profileUpdateError;
    } else {
      const { error: profileError } = await admin
        .from("profiles")
        .insert({ id: user.id, full_name: fullName });
      if (profileError) throw profileError;
      profileCreated = true;
    }

    const { error: membershipError } = await admin
      .from("restaurant_users")
      .insert({ restaurant_id: restaurant.id, user_id: user.id, role: "OWNER", duty_status: "OFF_DUTY" });
    if (membershipError) throw membershipError;
  } catch (error) {
    await admin.from("restaurants").delete().eq("id", restaurant.id);
    if (profileCreated) {
      await admin.from("profiles").delete().eq("id", user.id);
    }
    throw error;
  }

  revalidatePath("/");
  return { success: true, restaurantId: restaurant.id, existing: false };
}
