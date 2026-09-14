"use server";

import { createSupabaseServerClient } from "@/lib/supabase/server";
import { createClient } from "@supabase/supabase-js";
import { revalidatePath } from "next/cache";

const ADMIN_ROLES = ["ADMIN", "OWNER"];

const VALID_ROLES = [
  "ADMIN",
  "OWNER",
  "MANAGER",
  "SERVER",
  "CHEF",
  "BARMAN",
];

function getServiceClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !serviceKey) {
    throw new Error(
      "Supabase service role configuration is missing."
    );
  }

  return createClient(url, serviceKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });
}

async function getCurrentMembership() {
  const supabase = await createSupabaseServerClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    throw new Error("You must be signed in.");
  }

  const { data: membership, error } = await supabase
    .from("restaurant_users")
    .select("restaurant_id, role")
    .eq("user_id", user.id)
    .limit(1)
    .maybeSingle();

  if (error) throw error;

  if (!membership) {
    throw new Error(
      "You are not connected to a restaurant."
    );
  }

  if (!ADMIN_ROLES.includes(membership.role)) {
    throw new Error(
      "You do not have permission to manage staff."
    );
  }

  return {
    user,
    membership,
  };
}

export async function createStaff(formData) {
  const { membership } =
    await getCurrentMembership();

  const fullName = String(
    formData.get("full_name") || ""
  ).trim();

  const email = String(
    formData.get("email") || ""
  )
    .trim()
    .toLowerCase();

  const password = String(
    formData.get("password") || ""
  );

  const role = String(
    formData.get("role") || "SERVER"
  ).toUpperCase();

  const shiftDate = String(
    formData.get("shift_date") || ""
  ).trim();

  const startTime = String(
    formData.get("start_time") || ""
  ).trim();

  const endTime = String(
    formData.get("end_time") || ""
  ).trim();

  if (!fullName) {
    throw new Error("Full name is required.");
  }

  if (!email) {
    throw new Error("Email is required.");
  }

  if (password.length < 6) {
    throw new Error(
      "Password must be at least 6 characters."
    );
  }

  if (!VALID_ROLES.includes(role)) {
    throw new Error("Invalid staff role.");
  }

  if (shiftDate || startTime || endTime) {
    if (!shiftDate || !startTime || !endTime) {
      throw new Error(
        "Shift date, start time and end time are all required."
      );
    }

    if (startTime >= endTime) {
      throw new Error(
        "Shift end time must be later than start time."
      );
    }
  }

  const admin = getServiceClient();

  // 1. Create Auth user
  const {
    data: authData,
    error: authError,
  } =
    await admin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: {
        full_name: fullName,
      },
    });

  if (authError) {
    throw new Error(authError.message);
  }

  const userId = authData.user.id;

  try {
    // 2. Create profile
    const {
      error: profileError,
    } = await admin
      .from("profiles")
      .upsert({
        id: userId,
        full_name: fullName,
      });

    if (profileError) {
      throw profileError;
    }

    // 3. Create restaurant membership
    const {
      error: membershipInsertError,
    } = await admin
      .from("restaurant_users")
      .insert({
        restaurant_id:
          membership.restaurant_id,
        user_id: userId,
        role,
      });

    if (membershipInsertError) {
      throw membershipInsertError;
    }

    // 4. Create shift
    if (shiftDate && startTime && endTime) {
      const {
        error: shiftError,
      } = await admin
        .from("staff_shifts")
        .insert({
          restaurant_id:
            membership.restaurant_id,
          user_id: userId,
          shift_date: shiftDate,
          start_time: startTime,
          end_time: endTime,
          status: "SCHEDULED",
        });

      if (shiftError) {
        throw shiftError;
      }
    }
  } catch (error) {
    // Roll back Auth user if database setup fails
    await admin.auth.admin.deleteUser(
      userId
    );

    throw new Error(
      error.message ||
        "Could not finish creating staff member."
    );
  }

  revalidatePath("/staff");

  return {
    success: true,
    message:
      "Staff member created successfully.",
  };
}

export async function deleteStaff(userId) {
  const { user, membership } =
    await getCurrentMembership();

  if (!userId) {
    throw new Error(
      "Staff user ID is required."
    );
  }

  if (userId === user.id) {
    throw new Error(
      "You cannot remove your own account."
    );
  }

  const admin = getServiceClient();

  const {
    data: staffMember,
    error: staffError,
  } = await admin
    .from("restaurant_users")
    .select("user_id, role")
    .eq(
      "restaurant_id",
      membership.restaurant_id
    )
    .eq("user_id", userId)
    .maybeSingle();

  if (staffError) throw staffError;

  if (!staffMember) {
    throw new Error(
      "Staff member was not found."
    );
  }

  const {
    error: membershipDeleteError,
  } = await admin
    .from("restaurant_users")
    .delete()
    .eq(
      "restaurant_id",
      membership.restaurant_id
    )
    .eq("user_id", userId);

  if (membershipDeleteError) {
    throw membershipDeleteError;
  }

  const {
    error: authError,
  } =
    await admin.auth.admin.deleteUser(userId);

  if (authError) {
    throw new Error(authError.message);
  }

  revalidatePath("/staff");

  return {
    success: true,
    message: "Staff member removed.",
  };
}