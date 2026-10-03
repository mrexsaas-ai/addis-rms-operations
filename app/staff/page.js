import Link from "next/link";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import StaffClient from "./StaffClient";
import StaffEditButton from "./StaffEditButton";
import ClockInButton, { ClockOutButton } from "./ClockInButton";
import StaffShiftStatus from "./StaffShiftStatus";
import { getCurrentUserAttendanceShift } from "./actions";
import { getAttendanceStatus, getBusinessDateKey, selectAttendanceShift } from "./attendanceSelection";
import { isActiveRestaurantStatus } from "@/lib/restaurant-lifecycle.mjs";

export const dynamic = "force-dynamic";

const roles = {
  ADMIN: "Admin",
  OWNER: "Owner",
  MANAGER: "Manager",
  SERVER: "Server",
  CHEF: "Chef",
  BARMAN: "Barman",
};

async function loadStaff() {
  const supabase = await createSupabaseServerClient();

  // 1. Check current user
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return {
      state: "unauthenticated",
    };
  }

  // 2. Find restaurant membership
  const { data: membership, error: membershipError } =
    await supabase
      .from("restaurant_users")
      .select("restaurant_id, role, restaurants(status)")
      .eq("user_id", user.id)
      .limit(1)
      .maybeSingle();

  if (membershipError) {
    throw membershipError;
  }

  if (!membership) {
    return {
      state: "unauthorized",
    };
  }

  const membershipRestaurant = Array.isArray(membership.restaurants)
    ? membership.restaurants[0]
    : membership.restaurants;
  if (!isActiveRestaurantStatus(membershipRestaurant?.status)) {
    return { state: "unauthorized" };
  }
  const canManageStaff = ["ADMIN", "OWNER"].includes(membership.role);

  // 3. Get restaurant
  const { data: restaurant, error: restaurantError } =
    await supabase
      .from("restaurants")
      .select("id, name")
      .eq("id", membership.restaurant_id)
      .maybeSingle();

  if (restaurantError) {
    throw restaurantError;
  }

  // 4. Get restaurant staff
  const { data: staff, error: staffError } = await supabase
    .from("restaurant_users")
    .select("user_id, role, duty_status")
    .eq("restaurant_id", membership.restaurant_id);

  if (staffError) {
    throw staffError;
  }

  // 5. Get profiles separately
  const userIds = (staff || []).map(
    (member) => member.user_id
  );

  const { data: profiles, error: profilesError } =
    userIds.length
      ? await supabase
          .from("profiles")
          .select("id, full_name")
          .in("id", userIds)
      : { data: [], error: null };

  if (profilesError) {
    throw profilesError;
  }

  const profileMap = new Map(
    (profiles || []).map((profile) => [profile.id, profile])
  );

  // 6. Read all shifts for managers; other roles may only read their own shift.
  let shifts;
  if (["ADMIN", "OWNER"].includes(membership.role)) {
    const { data, error } = await supabase
      .from("staff_shifts")
      .select("id, user_id, shift_name, shift_date, start_time, end_time, status, clock_in_at, clock_out_at, late")
      .eq("restaurant_id", membership.restaurant_id)
      .or(`shift_date.eq.${getBusinessDateKey()},and(clock_in_at.not.is.null,clock_out_at.is.null)`)
      .order("start_time");
    if (error) throw error;
    shifts = data || [];
  } else {
    const shift = await getCurrentUserAttendanceShift();
    shifts = shift ? [shift] : [];
  }

  // 7. Build staff list
  const staffList = (staff || []).map(
    (member) => {
      const profile = profileMap.get(member.user_id);

      const personShifts = shifts.filter((item) => item.user_id === member.user_id);
      const shift = selectAttendanceShift(personShifts);
      const effectiveStatus = getAttendanceStatus(shift);

      return {
        userId: member.user_id,
        name: profile?.full_name || "Unknown staff member",
        role: member.role,
        shift,
        dutyStatus: effectiveStatus,
        isCurrentUser: member.user_id === user.id,
      };
    }
  );

  return {
    state: "ready",
    restaurantName:
      restaurant?.name || "Your restaurant",
    role: membership.role,
    canManageStaff,
    currentUserId: user.id,
    staff: staffList,
  };
}

function StateMessage({ title, message }) {
  return (
    <main className="state-page">
      <div className="state-panel">
        <span className="brand-mark">
          ADDIS RMS
        </span>

        <p className="eyebrow">
          RUN SMARTER. GROW FASTER.
        </p>

        <h1>{title}</h1>
        <p>{message}</p>
      </div>
    </main>
  );
}

export default async function StaffPage() {
  let data;

  try {
    data = await loadStaff();
  } catch (error) {
    return (
      <StateMessage
        title="Staff unavailable"
        message={
          error.message ||
          "Could not load staff data."
        }
      />
    );
  }

  if (data.state === "unauthenticated") {
    return (
      <StateMessage
        title="Sign in to continue"
        message="Your Supabase session is not active."
      />
    );
  }

  if (data.state === "unauthorized") {
    return (
      <StateMessage
        title="Access not granted"
        message="Your account is not connected to a restaurant."
      />
    );
  }

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <div className="sidebar-brand">
          <span className="brand-mark">
            ADDIS RMS
          </span>

          <span className="brand-tagline">
            RUN SMARTER. GROW FASTER.
          </span>
        </div>

        <nav aria-label="Main navigation">
          <Link className="nav-link" href="/">
            Overview
          </Link>

          <Link className="nav-link" href="/orders">
            Orders
          </Link>

          <Link className="nav-link" href="/tables">
            Tables
          </Link>

          <Link className="nav-link" href="/menu">
            Menu
          </Link>

          <Link
            className="nav-link nav-link-active"
            href="/staff"
          >
            Staff
          </Link>
        </nav>

        <div className="sidebar-footer">
          <span className="status-dot" />
          Supabase connected
        </div>
      </aside>

      <main className="dashboard-main staff-page">
        <header className="topbar">
          <div>
            <p className="eyebrow">
              Staff management
            </p>

            <h1>{data.restaurantName}</h1>
          </div>

          <div className="user-chip">
            <span className="avatar">
              {roles[data.role]?.slice(0, 1) ||
                "S"}
            </span>

            <span>
              <strong>
                {roles[data.role] ||
                  data.role}
              </strong>

              <small>
                Staff access
              </small>
            </span>
          </div>
        </header>

        <section className="welcome-row">
          <div>
            <p className="eyebrow">
              Team operations
            </p>

            <h2>
              Staff & shifts
            </h2>
          </div>

          {data.canManageStaff && <StaffClient staff={data.staff} />}
        </section>

        <section className="metric-grid">
          <article className="metric-card">
            <p>Total staff</p>
            <strong>
              {data.staff.length}
            </strong>
            <span>
              Restaurant team
            </span>
          </article>

          <article className="metric-card">
            <p>On duty</p>
                <strong>{data.staff.filter((person) => person.dutyStatus === "CLOCKED_IN").length}</strong>
            <span>
              Working right now
            </span>
          </article>

          <article className="metric-card">
            <p>Off duty</p>
            <strong>
              {
                data.staff.filter(
                  (person) =>
                    person.dutyStatus === "OFF_DUTY"
                ).length
              }
            </strong>
            <span>
              Not currently working
            </span>
          </article>
        </section>

        <section className="panel">
          <div className="panel-heading">
            <div>
              <p className="eyebrow">
                Today&apos;s team
              </p>

              <h2>Staff schedule</h2>
            </div>

            <span className="panel-note">
              {data.staff.length} staff
            </span>
          </div>

          {data.staff.length === 0 ? (
            <p className="empty-copy">
              No staff members found.
            </p>
          ) : (
            <div className="orders-table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>Staff</th>
                    <th>Role</th>
                    <th>Shift</th>
                    <th>Status</th>
                    <th>Actions</th>
                  </tr>
                </thead>

                <tbody>
                  {data.staff.map((person) => (
                    <tr key={person.userId}>
                      <td>
                        <strong>
                          {person.name}
                        </strong>
                      </td>

                      <td>
                        {roles[person.role] ||
                          person.role}
                      </td>

                      <StaffShiftStatus person={person} />

                      <td>
                        <div className="staff-row-actions">
                          {data.canManageStaff && (
                            <StaffEditButton
                              staff={person}
                              canRemoveStaff={["ADMIN", "OWNER"].includes(data.role)}
                            />
                          )}

                          {person.userId !== data.currentUserId ? null : person.dutyStatus === "ON_DUTY" ? (
                            <ClockOutButton />
                          ) : person.dutyStatus === "OFF_DUTY" && (!person.shift || (person.shift.status !== "COMPLETED" && person.shift.status !== "CANCELLED")) ? (
                            <ClockInButton shift={person.shift} />
                          ) : null}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      </main>
    </div>
  );
}