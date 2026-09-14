import Link from "next/link";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import StaffClient from "./StaffClient";

export const dynamic = "force-dynamic";

const roles = {
  ADMIN: "Admin",
  OWNER: "Owner",
  MANAGER: "Manager",
  SERVER: "Server",
  CHEF: "Chef",
  BARMAN: "Barman",
};

function getDutyStatus(shift) {
  if (!shift) return "OFF DUTY";

  const now = new Date();

  const today = [
    now.getFullYear(),
    String(now.getMonth() + 1).padStart(2, "0"),
    String(now.getDate()).padStart(2, "0"),
  ].join("-");

  if (shift.shift_date !== today) {
    return "OFF DUTY";
  }

  const current = [
    String(now.getHours()).padStart(2, "0"),
    String(now.getMinutes()).padStart(2, "0"),
    String(now.getSeconds()).padStart(2, "0"),
  ].join(":");

  if (
    current >= shift.start_time &&
    current <= shift.end_time
  ) {
    return "ON DUTY";
  }

  return "OFF DUTY";
}

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
      .select("restaurant_id, role")
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
  const { data: staff, error: staffError } =
    await supabase
      .from("restaurant_users")
      .select("user_id, role")
      .eq(
        "restaurant_id",
        membership.restaurant_id
      );

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

  // 6. Get today's shifts
  const now = new Date();

  const today = [
    now.getFullYear(),
    String(now.getMonth() + 1).padStart(2, "0"),
    String(now.getDate()).padStart(2, "0"),
  ].join("-");

  const {
    data: shifts,
    error: shiftsError,
  } = await supabase
    .from("staff_shifts")
    .select(
      "id, user_id, shift_date, start_time, end_time, status"
    )
    .eq(
      "restaurant_id",
      membership.restaurant_id
    )
    .eq("shift_date", today)
    .order("start_time");

  if (shiftsError) {
    throw shiftsError;
  }

  // 7. Build staff list
  const staffList = (staff || []).map(
    (member) => {
      const profile = (profiles || []).find(
        (item) =>
          item.id === member.user_id
      );

      const shift = (shifts || []).find(
        (item) =>
          item.user_id === member.user_id
      );

      return {
        userId: member.user_id,
        name:
          profile?.full_name ||
          roles[member.role] ||
          "Staff member",
        role: member.role,
        shift,
        dutyStatus: getDutyStatus(shift),
      };
    }
  );

  return {
    state: "ready",
    restaurantName:
      restaurant?.name || "Your restaurant",
    role: membership.role,
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

          <StaffClient />
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
            <strong>
              {
                data.staff.filter(
                  (person) =>
                    person.dutyStatus ===
                    "ON DUTY"
                ).length
              }
            </strong>
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
                    person.dutyStatus ===
                    "OFF DUTY"
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

                      <td>
                        {person.shift
                          ? `${person.shift.start_time.slice(
                              0,
                              5
                            )} – ${person.shift.end_time.slice(
                              0,
                              5
                            )}`
                          : "No shift"}
                      </td>

                      <td>
                        <span
                          className={`status-badge ${
                            person.dutyStatus ===
                            "ON DUTY"
                              ? "status-completed"
                              : "status-cancelled"
                          }`}
                        >
                          {person.dutyStatus}
                        </span>
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