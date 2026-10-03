"use server";

import { createSupabaseServerClient } from "@/lib/supabase/server";
import { createClient } from "@supabase/supabase-js";
import { revalidatePath } from "next/cache";
import { assertActiveRestaurantMembership, getMembership } from "@/lib/auth";
import { getBusinessDateKey, selectAttendanceShift } from "./attendanceSelection";

const ADMIN_ROLES = ["ADMIN", "OWNER"];

const VALID_ROLES = [
  "ADMIN",
  "OWNER",
  "MANAGER",
  "SERVER",
  "CHEF",
  "BARMAN",
];

async function getAuthenticatedAttendanceShift() {
  const { supabase, user, membership } = await getAuthenticatedMembership();
  const admin = getServiceClient();
  const shiftDate = getBusinessDateKey();

  const [activeShiftResult, todayShiftResult] = await Promise.all([
    admin
      .from("staff_shifts")
      .select("id, restaurant_id, user_id, shift_date, start_time, end_time, status, clock_in_at, clock_out_at, late")
      .eq("restaurant_id", membership.restaurant_id)
      .eq("user_id", user.id)
      .not("clock_in_at", "is", null)
      .is("clock_out_at", null),
    admin
      .from("staff_shifts")
      .select("id, restaurant_id, user_id, shift_date, start_time, end_time, status, clock_in_at, clock_out_at, late")
      .eq("restaurant_id", membership.restaurant_id)
      .eq("user_id", user.id)
      .eq("shift_date", shiftDate)
      .order("start_time", { ascending: true }),
  ]);

  if (activeShiftResult.error) throw activeShiftResult.error;
  if (todayShiftResult.error) throw todayShiftResult.error;

  const shiftsById = new Map();
  for (const shift of [...(todayShiftResult.data || []), ...(activeShiftResult.data || [])]) {
    shiftsById.set(shift.id, shift);
  }

  const nextShift = selectAttendanceShift([...shiftsById.values()]);
  return { supabase, user, membership, shift: nextShift };
}

export async function getCurrentUserAttendanceShift() {
  const { shift } = await getAuthenticatedAttendanceShift();
  return shift;
}

function validateShift(shiftDate, startTime, endTime) {
  if (shiftDate || startTime || endTime) {
    if (!shiftDate || !startTime || !endTime) {
      throw new Error("Shift date, start time and end time are all required.");
    }
    if (startTime >= endTime) {
      throw new Error("Shift end time must be later than start time.");
    }
  }
}

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

async function requireAuthenticatedUser() {
  const supabase = await createSupabaseServerClient();

  try {
    const { data: { user }, error } = await supabase.auth.getUser();

    if (error) {
      if (error.name === "AuthSessionMissingError") {
        throw new Error("Your session has expired. Please sign in again.");
      }
      throw error;
    }

    if (!user) {
      throw new Error("You must be signed in.");
    }

    return { supabase, user };
  } catch (error) {
    if (error?.name === "AuthSessionMissingError") {
      throw new Error("Your session has expired. Please sign in again.");
    }
    throw error;
  }
}

async function getCurrentMembership() {
  const { supabase, user } = await requireAuthenticatedUser();

  const membership = await getMembership(supabase, user.id);

  if (!membership) {
    throw new Error(
      "You are not connected to a restaurant."
    );
  }

  assertActiveRestaurantMembership(membership);

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

async function getAuthenticatedMembership() {
  const { supabase, user } = await requireAuthenticatedUser();

  const membership = await getMembership(supabase, user.id);
  if (!membership) throw new Error("You are not connected to a restaurant.");
  assertActiveRestaurantMembership(membership);
  return { supabase, user, membership };
}

export async function markDutyStatus(status) {
  const { user, membership } = await getAuthenticatedMembership();
  if (!["ON_DUTY", "OFF_DUTY"].includes(status)) throw new Error("Invalid duty status.");

  const admin = getServiceClient();
  const { error } = await admin
    .from("restaurant_users")
    .update({ duty_status: status })
    .eq("restaurant_id", membership.restaurant_id)
    .eq("user_id", user.id);
  if (error) throw error;

  revalidatePath("/staff");
  return { success: true, changed: true, status };
}

async function setMemberDutyStatus({ actorMembership, actorUserId, targetUserId, status }) {
  if (!["ON_DUTY", "OFF_DUTY"].includes(status)) {
    throw new Error("Invalid duty status.");
  }

  if (!targetUserId) {
    throw new Error("A staff member must be selected.");
  }

  if (actorUserId !== targetUserId) {
    throw new Error("You can only update your own attendance status.");
  }

  const admin = getServiceClient();

  const { data: targetMembership, error: targetMembershipError } = await admin
    .from("restaurant_users")
    .select("user_id")
    .eq("restaurant_id", actorMembership.restaurant_id)
    .eq("user_id", targetUserId)
    .maybeSingle();

  if (targetMembershipError) {
    throw targetMembershipError;
  }

  if (!targetMembership) {
    throw new Error("Selected staff member was not found in this restaurant.");
  }

  const { error } = await admin
    .from("restaurant_users")
    .update({ duty_status: status })
    .eq("restaurant_id", actorMembership.restaurant_id)
    .eq("user_id", targetUserId);

  if (error) {
    throw error;
  }

  revalidatePath("/staff");
  return {
    success: true,
    changed: true,
    status,
    userId: targetUserId,
  };
}

export async function clockIn() {
  const { supabase, membership, shift } = await getAuthenticatedAttendanceShift();
  const { data: attendance, error } = await supabase.rpc("start_staff_attendance", {
    p_restaurant_id: membership.restaurant_id,
    p_shift_id: shift?.id || null,
  });

  if (error) throw error;

  revalidatePath("/staff");
  revalidatePath("/server");
  return {
    success: true,
    status: "ON_DUTY",
    clockInAt: attendance.clock_in_at,
    shiftId: attendance.shift_id,
  };
}

export async function clockOut() {
  const { supabase, membership, shift } = await getAuthenticatedAttendanceShift();
  const { data: attendance, error } = await supabase.rpc("end_staff_attendance", {
    p_restaurant_id: membership.restaurant_id,
    p_shift_id: shift?.id || null,
  });

  if (error) throw error;

  revalidatePath("/staff");
  revalidatePath("/server");
  return {
    success: true,
    status: "OFF_DUTY",
    clockOutAt: attendance.clock_out_at,
    shiftId: attendance.shift_id,
  };
}

export async function addShift(source) {
  const payload =
    source instanceof FormData
      ? Object.fromEntries(source.entries())
      : source || {};

  const {
    staff_user_id,
    shift_name,
    shift_date,
    start_time,
    end_time,
  } = payload;

  const { membership } = await getCurrentMembership();

  const userId = String(staff_user_id || "").trim();
  const shiftName = String(shift_name || "").trim();
  const shiftDate = String(shift_date || "").trim();
  const startTime = String(start_time || "").trim();
  const endTime = String(end_time || "").trim();

  if (!userId) {
    throw new Error("A staff member must be selected.");
  }

  if (!shiftDate || !startTime || !endTime) {
    throw new Error("Shift date, start time and end time are required.");
  }

  if (startTime >= endTime) {
    throw new Error("Shift end time must be later than start time.");
  }

  const admin = getServiceClient();

  const { data: staffMember, error: staffMemberError } = await admin
    .from("restaurant_users")
    .select("user_id")
    .eq("restaurant_id", membership.restaurant_id)
    .eq("user_id", userId)
    .maybeSingle();

  if (staffMemberError) throw staffMemberError;
  if (!staffMember) {
    throw new Error("Selected staff member was not found in this restaurant.");
  }

  const { error: shiftInsertError } = await admin
    .from("staff_shifts")
    .insert({
      restaurant_id: membership.restaurant_id,
      user_id: userId,
      shift_name: shiftName || null,
      shift_date: shiftDate,
      start_time: startTime,
      end_time: endTime,
      status: "SCHEDULED",
    });

  if (shiftInsertError) throw shiftInsertError;

  revalidatePath("/staff");

  return {
    success: true,
    message: "Shift added successfully.",
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

  validateShift(shiftDate, startTime, endTime);

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
      .upsert(
        {
          id: userId,
          full_name: fullName,
        },
        { onConflict: "id" }
      );

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

  revalidatePath("/staff");

  return {
    success: true,
    message: "Staff member removed.",
  };
}

export async function updateStaff(formData) {
  const { membership } = await getCurrentMembership();
  const userId = String(formData.get("user_id") || "").trim();
  const shiftId = String(formData.get("shift_id") || "").trim();
  const fullName = String(formData.get("full_name") || "").trim();
  const password = String(formData.get("password") || "");
  const role = String(formData.get("role") || "").toUpperCase();
  const shiftDate = String(formData.get("shift_date") || "").trim();
  const startTime = String(formData.get("start_time") || "").trim();
  const endTime = String(formData.get("end_time") || "").trim();

  if (!userId || !fullName || !VALID_ROLES.includes(role)) {
    throw new Error("Staff identity and a valid role are required.");
  }
  if (password && password.length < 6) {
    throw new Error("Password must be at least 6 characters.");
  }
  validateShift(shiftDate, startTime, endTime);

  const admin = getServiceClient();
  const { data: staffMember, error: staffError } = await admin
    .from("restaurant_users")
    .select("user_id")
    .eq("restaurant_id", membership.restaurant_id)
    .eq("user_id", userId)
    .maybeSingle();
  if (staffError) throw staffError;
  if (!staffMember) throw new Error("Staff member was not found in this restaurant.");

  if (password) {
    const { data: authData, error: authError } = await admin.auth.admin.updateUserById(
      userId,
      { password }
    );
    if (authError) throw new Error(authError.message);
    if (!authData?.user?.id) throw new Error("Supabase did not confirm the password update.");
  }

  const { error: profileError } = await admin
    .from("profiles")
    .upsert(
      {
        id: userId,
        full_name: fullName,
      },
      { onConflict: "id" }
    );
  if (profileError) throw profileError;

  const { error: authMetadataError } = await admin.auth.admin.updateUserById(userId, {
    user_metadata: { full_name: fullName },
  });
  if (authMetadataError) throw new Error(authMetadataError.message);

  const { error: roleError } = await admin
    .from("restaurant_users")
    .update({ role })
    .eq("restaurant_id", membership.restaurant_id)
    .eq("user_id", userId);
  if (roleError) throw roleError;

  if (shiftDate && startTime && endTime) {
    const shiftPayload = {
      restaurant_id: membership.restaurant_id,
      user_id: userId,
      shift_date: shiftDate,
      start_time: startTime,
      end_time: endTime,
      status: "SCHEDULED",
    };
    const shiftQuery = shiftId
      ? admin.from("staff_shifts").update(shiftPayload).eq("id", shiftId).eq("restaurant_id", membership.restaurant_id).eq("user_id", userId)
      : admin.from("staff_shifts").insert(shiftPayload);
    const { error: shiftError } = await shiftQuery;
    if (shiftError) throw shiftError;
  } else if (shiftId) {
    const { error: shiftError } = await admin
      .from("staff_shifts")
      .update({ status: "COMPLETED" })
      .eq("id", shiftId)
      .eq("restaurant_id", membership.restaurant_id)
      .eq("user_id", userId);
    if (shiftError) throw shiftError;
  }

  revalidatePath("/staff");
  return { success: true, message: "Staff member updated successfully." };
}