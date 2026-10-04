import Link from "next/link";
import { redirect } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { createTable } from "./actions";
import TableFilters from "./TableFilters";
import TableCard from "./TableCard";
import { isActiveRestaurantStatus } from "@/lib/restaurant-lifecycle.mjs";
import { getMembership } from "@/lib/auth";

export const dynamic = "force-dynamic";

const roles = {
  ADMIN: "Admin",
  OWNER: "Owner",
  MANAGER: "Manager",
  SERVER: "Server",
  CHEF: "Chef",
  BARMAN: "Barman",
};

export default async function TablesPage() {
  const supabase = await createSupabaseServerClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  const membership = await getMembership(supabase, user.id);

  if (!membership) {
    return (
      <main className="state-page">
        <div className="state-panel">
          <span className="brand-mark">ADDIS RMS</span>
          <p className="eyebrow">TABLE MANAGEMENT</p>
          <h1>Access not granted.</h1>
          <p>Your account is not connected to a restaurant.</p>
        </div>
      </main>
    );
  }

  const membershipRestaurant = membership.restaurants;
  if (!isActiveRestaurantStatus(membershipRestaurant?.status)) {
    redirect("/login?restaurantInactive=1");
  }

  const { data: tables, error } = await supabase
    .from("tables")
    .select("id, table_number, name, capacity, status, created_at")
    .eq("restaurant_id", membership.restaurant_id)
    .order("table_number", { ascending: true });

  const restaurant = membershipRestaurant;

  const canManage = ["ADMIN", "OWNER", "MANAGER"].includes(membership.role);
  const canUpdate = ["ADMIN", "OWNER", "MANAGER", "SERVER"].includes(membership.role);

  const allTables = tables || [];
  const available = allTables.filter((table) => table.status === "AVAILABLE").length;
  const occupied = allTables.filter((table) => table.status === "OCCUPIED").length;
  const reserved = allTables.filter((table) => table.status === "RESERVED").length;
  const cleaning = allTables.filter((table) => table.status === "CLEANING").length;

  return (
    <main className="tables-page">
      <style>{`
        .tables-page {
          min-height: 100vh;
          padding: 28px;
          background: #0b0b0c;
          color: #f5f5f5;
        }
        .tables-wrap {
          max-width: 1200px;
          margin: 0 auto;
        }
        .tables-topbar {
          display: flex;
          justify-content: space-between;
          align-items: flex-start;
          gap: 20px;
          margin-bottom: 28px;
        }
        .brand-mark {
          font-weight: 800;
          letter-spacing: .12em;
        }
        .eyebrow {
          margin: 0 0 8px;
          font-size: 11px;
          letter-spacing: .14em;
          text-transform: uppercase;
          opacity: .55;
        }
        .tables-topbar h1 {
          margin: 0;
          font-size: clamp(30px, 5vw, 48px);
          letter-spacing: -0.04em;
        }
        .subtle {
          margin-top: 8px;
          color: #aaa;
        }

        .tables-actions {
          display: flex;
          gap: 10px;
          align-items: center;
        }

        .tables-cta {
          background: #d8ff45;
          color: #101010;
          border-radius: 10px;
          padding: 11px 15px;
          font-weight: 800;
        }

        .table-toolbar {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 16px;
          margin-bottom: 18px;
          padding: 16px;
          border: 1px solid #27272a;
          border-radius: 16px;
          background: #111113;
        }
        .filter-chips {
          display: flex;
          flex: 1 1 auto;
          flex-wrap: wrap;
          justify-content: flex-end;
          align-items: center;
          gap: 10px;
          min-width: 0;
        }
        .filter-chip {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          min-height: 42px;
          min-width: 72px;
          padding: 10px 14px;
          border: 1px solid #343438;
          border-radius: 10px;
          background: #09090a;
          color: #d8d8dc;
          cursor: pointer;
          white-space: nowrap;
          line-height: 1.2;
          transition: border-color .18s ease, background .18s ease, color .18s ease;
        }
        .filter-chip:hover,
        .filter-chip.active {
          border-color: #00e5ff;
          background: #00e5ff;
          color: #050505;
        }
        .back-link {
          color: #fff;
          text-decoration: none;
          border: 1px solid #303033;
          border-radius: 10px;
          padding: 10px 14px;
        }
        .stats {
          display: grid;
          grid-template-columns: repeat(4, 1fr);
          gap: 12px;
          margin-bottom: 24px;
        }
        .stat, .panel, .table-card {
          border: 1px solid #27272a;
          background: #111113;
          border-radius: 16px;
        }
        .stat {
          padding: 18px;
        }
        .stat span {
          display: block;
          color: #999;
          font-size: 13px;
        }
        .stat strong {
          display: block;
          margin-top: 8px;
          font-size: 30px;
        }
        .layout {
          display: grid;
          grid-template-columns: 320px 1fr;
          gap: 18px;
          align-items: start;
        }
        .panel {
          padding: 20px;
        }
        .panel h2 {
          margin: 0 0 16px;
          font-size: 18px;
        }
        .field {
          margin-bottom: 14px;
        }
        .field label {
          display: block;
          margin-bottom: 7px;
          color: #aaa;
          font-size: 12px;
        }
        .field input {
          width: 100%;
          box-sizing: border-box;
          padding: 12px;
          border-radius: 10px;
          border: 1px solid #303033;
          background: #09090a;
          color: #fff;
        }
        .primary-btn {
          width: 100%;
          border: 0;
          border-radius: 10px;
          padding: 12px;
          font-weight: 700;
          cursor: pointer;
          background: #f5f5f5;
          color: #0b0b0c;
        }
        .tables-grid {
          display: grid;
          grid-template-columns: repeat(3, minmax(0, 1fr));
          gap: 14px;
        }
        .table-card {
          padding: 18px;
        }
        .table-head {
          display: flex;
          justify-content: space-between;
          gap: 12px;
          align-items: flex-start;
        }
        .table-number {
          font-size: 28px;
          font-weight: 800;
        }
        .table-name {
          color: #999;
          font-size: 13px;
          margin-top: 3px;
        }
        .badge {
          border: 1px solid #333;
          border-radius: 999px;
          padding: 6px 9px;
          font-size: 11px;
          text-transform: uppercase;
          letter-spacing: .08em;
        }
        .badge.available {
  color: #22c55e;
  background: rgba(34, 197, 94, 0.12);
  border-color: rgba(34, 197, 94, 0.35);
}

.badge.occupied {
  color: #ef4444;
  background: rgba(239, 68, 68, 0.12);
  border-color: rgba(239, 68, 68, 0.35);
}

.badge.reserved {
  color: #eab308;
  background: rgba(234, 179, 8, 0.12);
  border-color: rgba(234, 179, 8, 0.35);
}

.badge.cleaning {
  color: #3b82f6;
  background: rgba(59, 130, 246, 0.12);
  border-color: rgba(59, 130, 246, 0.35);
}
        .capacity {
          margin: 18px 0;
          color: #aaa;
          font-size: 13px;
        }
        .status-row {
          display: grid;
          grid-template-columns: 1fr auto;
          gap: 8px;
        }
        .status-controls {
          display: grid;
          grid-template-columns: minmax(0, 1fr) auto;
          gap: 8px;
          margin-top: 14px;
          align-items: stretch;
        }
        .status-controls select {
          min-width: 0;
          min-height: 42px;
          padding: 10px 12px;
          border: 1px solid #343438;
          border-radius: 9px;
          background: #09090a;
          color: #fff;
        }
        .sr-only {
          position: absolute;
          width: 1px;
          height: 1px;
          padding: 0;
          margin: -1px;
          overflow: hidden;
          clip: rect(0, 0, 0, 0);
          white-space: nowrap;
          border: 0;
        }
        .status-row select {
          width: 100%;
          padding: 10px;
          border-radius: 9px;
          border: 1px solid #303033;
          background: #09090a;
          color: #fff;
        }
        .small-btn {
          border: 1px solid #303033;
          background: transparent;
          color: #fff;
          border-radius: 9px;
          min-height: 42px;
          padding: 10px 14px;
          cursor: pointer;
          white-space: nowrap;
        }
        .delete-btn {
          margin-top: 10px;
          width: 100%;
          color: #aaa;
        }
        .empty {
          padding: 40px 10px;
          text-align: center;
          color: #888;
          border: 1px dashed #2b2b2d;
          border-radius: 14px;
        }
        @media (max-width: 900px) {
          .layout { grid-template-columns: 1fr; }
          .tables-grid { grid-template-columns: repeat(2, minmax(0, 1fr)); }
        }
        @media (max-width: 620px) {
          .tables-page { padding: 16px; }
          .tables-topbar { flex-direction: column; }
          .stats { grid-template-columns: repeat(2, 1fr); }
          .tables-grid { grid-template-columns: 1fr; }
          .table-toolbar { align-items: stretch; flex-direction: column; }
          .filter-chips { justify-content: flex-start; gap: 8px; }
          .filter-chip { flex: 1 1 calc(50% - 8px); min-width: 0; }
          .status-controls { grid-template-columns: 1fr; }
        }
      `}</style>

      <div className="tables-wrap">
        <header className="tables-topbar">
          <div>
            <span className="brand-mark">ADDIS RMS</span>
            <p className="eyebrow" style={{ marginTop: 22 }}>TABLE MANAGEMENT</p>
            <h1>{restaurant?.name || "Restaurant"}</h1>
            <p className="subtle">
              <span>{roles[membership.role] || membership.role}</span> <span>access</span> · <span>Manage your dining floor.</span>
            </p>
          </div>

          <div className="tables-actions">
            {canManage && <a className="tables-cta" href="#add-table-form">Add table</a>}
            <Link href="/" className="back-link">← Overview</Link>
          </div>
        </header>

        <section className="stats">
          <div className="stat"><span>Total</span><strong>{allTables.length}</strong></div>
          <div className="stat"><span>Available</span><strong>{available}</strong></div>
          <div className="stat"><span>Occupied</span><strong>{occupied}</strong></div>
          <div className="stat"><span>Reserved</span><strong>{reserved}</strong></div>
          <div className="stat"><span>Cleaning</span><strong>{cleaning}</strong></div>
        </section>

        <div className="table-toolbar">
          <div>
            <p className="eyebrow">FLOOR VIEW</p>
            <strong>Live table status</strong>
          </div>
          <TableFilters />
        </div>

        <div className="layout">
          {canManage && (
            <section className="panel" id="add-table-form">
              <p className="eyebrow">SETUP</p>
              <h2>Add table</h2>

              <form action={createTable}>
                <div className="field">
                  <label htmlFor="table_number">Table number</label>
                  <input id="table_number" name="table_number" type="number" min="1" required />
                </div>

                <div className="field">
                  <label htmlFor="name">Display name</label>
                  <input id="name" name="name" type="text" placeholder="Main Hall 01" />
                </div>

                <div className="field">
                  <label htmlFor="capacity">Capacity</label>
                  <input id="capacity" name="capacity" type="number" min="1" defaultValue="2" required />
                </div>

                <button className="primary-btn" type="submit">
                  Add table
                </button>
              </form>
            </section>
          )}

          <section>
            <div className="tables-grid">
              {error ? (
                <div className="empty">
                  <span>Could not load tables:</span> {error.message}
                </div>
              ) : allTables.length === 0 ? (
                <div className="empty">
                  <span>No tables have been created yet.</span>
                  {canManage ? <span> Use the Add table form to create your first table.</span> : null}
                </div>
              ) : (
                allTables.map((table) => <TableCard key={table.id} table={table} canManage={canManage} canUpdate={canUpdate} role={membership.role} />)
              )}
            </div>
          </section>
        </div>
      </div>
    </main>
  );
}
