import { redirect } from "next/navigation";
import { getAuthContext } from "@/lib/auth";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import AuthenticatedSidebar from "@/app/admin/AuthenticatedSidebar";
import "./inventory.css";
import {
  createInventoryCategory,
  createInventoryItem,
  createSupplier,
  updateInventoryItem,
} from "./actions";
import AddStockForm from "./AddStockForm";
import InventoryItemForm from "./InventoryItemForm";
import InventoryLiveAlerts from "./InventoryLiveAlerts";
import InventoryRequests from "./InventoryRequests";
import StockRequestForm from "./StockRequestForm";

export const dynamic = "force-dynamic";

function formatMoney(value) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "ETB",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(Number(value || 0));
}

function formatNumber(value) {
  return Number(value || 0).toLocaleString("en-US", {
    maximumFractionDigits: 2,
  });
}

function formatDate(value) {
  if (!value) return "—";
  return new Date(value).toLocaleString("en-US", {
    dateStyle: "medium",
    timeStyle: "short",
  });
}

function statusBadgeClass(status) {
  if (status === "PENDING") return "status status-pending";
  if (status === "APPROVED") return "status status-approved";
  if (status === "FULFILLED") return "status status-fulfilled";
  return "status status-rejected";
}

export default async function InventoryPage({ searchParams }) {
  const supabase = await createSupabaseServerClient();
  const { user, membership } = await getAuthContext(supabase);

  if (!user) redirect("/login");
  if (!membership) {
    return (
      <main className="inventory-page state-page">
        <div className="state-panel">
          <span className="brand-mark">ADDIS RMS</span>
          <p className="eyebrow">INVENTORY</p>
          <h1>Access not granted.</h1>
          <p>Your account is not connected to a restaurant.</p>
        </div>
      </main>
    );
  }

  const canManage = ["ADMIN", "OWNER", "MANAGER"].includes(membership.role);
  const resolvedSearchParams = await searchParams;
  const categoryFilter = typeof resolvedSearchParams?.category === "string" ? resolvedSearchParams.category : "all";
  const supplierFilter = typeof resolvedSearchParams?.supplier === "string" ? resolvedSearchParams.supplier : "all";
  const searchTerm = typeof resolvedSearchParams?.q === "string" ? resolvedSearchParams.q : "";

  const [
    itemsResult,
    categoriesResult,
    suppliersResult,
    movementsResult,
    requestsResult,
    auditResult,
  ] = await Promise.all([
    supabase
      .from("inventory_items")
      .select("id, name, sku, unit, current_quantity, minimum_stock_level, cost_price, is_active, description, category_id, supplier_id, station, inventory_categories(name), suppliers(name)")
      .eq("restaurant_id", membership.restaurant_id)
      .order("name", { ascending: true }),
    supabase
      .from("inventory_categories")
      .select("id, name")
      .eq("restaurant_id", membership.restaurant_id)
      .order("name", { ascending: true }),
    supabase
      .from("suppliers")
      .select("id, name, is_active")
      .eq("restaurant_id", membership.restaurant_id)
      .order("name", { ascending: true }),
    supabase
      .from("stock_movements")
      .select("id, movement_type, quantity_delta, previous_quantity, new_quantity, reason, created_at, inventory_items(name)")
      .eq("restaurant_id", membership.restaurant_id)
      .order("created_at", { ascending: false })
      .limit(20),
    supabase
      .from("stock_requests")
      .select("id, status, quantity, unit, note, created_at, requested_by_user_id, approved_by_user_id, station, requested_item_name, inventory_items(name)")
      .eq("restaurant_id", membership.restaurant_id)
      .order("created_at", { ascending: false })
      .limit(30),
    supabase
      .from("inventory_audit_logs")
      .select("id, action, previous_quantity, new_quantity, note, created_at, inventory_items(name)")
      .eq("restaurant_id", membership.restaurant_id)
      .order("created_at", { ascending: false })
      .limit(20),
  ]);

  if (itemsResult.error) throw new Error(itemsResult.error.message);
  if (categoriesResult.error) throw new Error(categoriesResult.error.message);
  if (suppliersResult.error) throw new Error(suppliersResult.error.message);
  if (movementsResult.error) throw new Error(movementsResult.error.message);
  if (requestsResult.error) throw new Error(requestsResult.error.message);
  if (auditResult.error) throw new Error(auditResult.error.message);

  const allItems = itemsResult.data || [];
  const categories = categoriesResult.data || [];
  const suppliers = suppliersResult.data || [];
  const movements = movementsResult.data || [];
  const requests = requestsResult.data || [];
  const auditLogs = auditResult.data || [];

  const normalizedSearch = searchTerm.trim().toLowerCase();
  const items = allItems.filter((item) => {
    const matchesSearch = !normalizedSearch || `${item.name} ${item.sku || ""}`.toLowerCase().includes(normalizedSearch);
    const matchesCategory = categoryFilter === "all" || item.category_id === categoryFilter;
    const matchesSupplier = supplierFilter === "all" || item.supplier_id === supplierFilter;
    return matchesSearch && matchesCategory && matchesSupplier;
  });
  const lowStockItems = items.filter((item) => item.is_active && Number(item.current_quantity) <= Number(item.minimum_stock_level));
  const outOfStock = items.filter((item) => Number(item.current_quantity) <= 0).length;
  const totalStockValue = items.reduce((sum, item) => sum + Number(item.current_quantity || 0) * Number(item.cost_price || 0), 0);
  const pendingRequests = requests.filter((request) => request.status === "PENDING");
  const requestHistory = requests.filter((request) => request.status !== "PENDING");

  return (
    <div className="app-shell inventory-app-shell">
      <AuthenticatedSidebar
        role={membership.role}
        canViewTables={["ADMIN", "OWNER", "MANAGER", "SERVER"].includes(membership.role)}
        canManageSettings={["ADMIN", "OWNER"].includes(membership.role)}
      />
      <main className="dashboard-main inventory-dashboard">
        <header className="page-header">
          <div>
            <p className="eyebrow">INVENTORY MANAGEMENT</p>
            <h1>Inventory</h1>
            <p className="muted">Items, stock levels, requests, and inventory activity.</p>
          </div>
        </header>

        <div className="inventory-content">
          <InventoryLiveAlerts restaurantId={membership.restaurant_id} />

          <section className="stats-grid" aria-label="Inventory overview">
            <article className="stat-card">
              <span>Items</span>
              <strong>{items.length}</strong>
            </article>
            <article className="stat-card">
              <span>Low stock</span>
              <strong>{lowStockItems.length}</strong>
            </article>
            <article className="stat-card">
              <span>Out of stock</span>
              <strong>{outOfStock}</strong>
            </article>
            <article className="stat-card">
              <span>Stock value</span>
              <strong>{formatMoney(totalStockValue)}</strong>
            </article>
            <article className="stat-card">
              <span>Pending requests</span>
              <strong>{pendingRequests.length}</strong>
            </article>
          </section>

          {canManage && (
            <section className="inventory-setup-grid">
              <InventoryItemForm action={createInventoryItem} categories={categories} suppliers={suppliers} />
              <div className="panel">
                <h2>Categories</h2>
                <form action={createInventoryCategory} className="mini-form">
                  <div className="field">
                    <label htmlFor="inventory-category-name">Add category</label>
                    <input id="inventory-category-name" name="name" required placeholder="Produce, Dry goods" />
                  </div>
                  <button type="submit">Add category</button>
                </form>
                {categories.length ? (
                  <ul className="inventory-plain-list">
                    {categories.map((category) => <li key={category.id}>{category.name}</li>)}
                  </ul>
                ) : <p className="muted">No categories yet.</p>}
              </div>
              <div className="panel">
                <h2>Suppliers</h2>
                <form action={createSupplier} className="mini-form">
                  <div className="field">
                    <label htmlFor="inventory-supplier-name">Supplier name</label>
                    <input id="inventory-supplier-name" name="name" required />
                  </div>
                  <div className="field">
                    <label htmlFor="inventory-supplier-phone">Phone</label>
                    <input id="inventory-supplier-phone" name="phone" type="tel" />
                  </div>
                  <button type="submit">Add supplier</button>
                </form>
                {suppliers.length ? (
                  <ul className="inventory-plain-list">
                    {suppliers.map((supplier) => (
                      <li key={supplier.id}>
                        {supplier.name} {!supplier.is_active && <span className="muted">(inactive)</span>}
                      </li>
                    ))}
                  </ul>
                ) : <p className="muted">No suppliers yet.</p>}
              </div>
            </section>
          )}

          <section className="panel">
            <div className="toolbar inventory-filter-heading">
              <div>
                <h2>Inventory items</h2>
                <p className="muted">{items.length} shown</p>
              </div>
              <form method="get" className="inventory-filters">
                <label>
                  <span className="sr-only">Search items</span>
                  <input type="search" name="q" defaultValue={searchTerm} placeholder="Search name or SKU" />
                </label>
                <label>
                  <span className="sr-only">Filter by category</span>
                  <select name="category" defaultValue={categoryFilter}>
                    <option value="all">All categories</option>
                    {categories.map((category) => <option key={category.id} value={category.id}>{category.name}</option>)}
                  </select>
                </label>
                <label>
                  <span className="sr-only">Filter by supplier</span>
                  <select name="supplier" defaultValue={supplierFilter}>
                    <option value="all">All suppliers</option>
                    {suppliers.map((supplier) => <option key={supplier.id} value={supplier.id}>{supplier.name}</option>)}
                  </select>
                </label>
                <button type="submit">Filter</button>
              </form>
            </div>
            {lowStockItems.length > 0 && (
              <div className="inventory-low-stock">
                <h3>Low-stock items</h3>
                <div className="inventory-low-stock-list">
                  {lowStockItems.map((item) => (
                    <span key={item.id}>
                      <strong>{item.name}</strong> · {formatNumber(item.current_quantity)} / {formatNumber(item.minimum_stock_level)} {item.unit}
                    </span>
                  ))}
                </div>
              </div>
            )}
            {items.length ? (
              <div className="inventory-table-scroll">
                <table className="inventory-table">
                  <thead>
                    <tr>
                      <th>Item</th>
                      <th>Category</th>
                      <th>Supplier</th>
                      <th>Stock</th>
                      <th>Cost</th>
                      <th>Status</th>
                      {canManage && <th>Manage</th>}
                    </tr>
                  </thead>
                  <tbody>
                    {items.map((item) => (
                      <tr key={item.id}>
                        <td>
                          <strong>{item.name}</strong>
                          <div className="muted">{item.sku || "No SKU"} · {item.station || "KITCHEN"}</div>
                        </td>
                        <td>{item.inventory_categories?.name || "Uncategorized"}</td>
                        <td>{item.suppliers?.name || "No supplier"}</td>
                        <td>
                          <strong>{formatNumber(item.current_quantity)} {item.unit}</strong>
                          <div className="muted">Minimum {formatNumber(item.minimum_stock_level)}</div>
                        </td>
                        <td>{formatMoney(item.cost_price)}</td>
                        <td><span className={item.is_active ? "badge" : "badge danger"}>{item.is_active ? "Active" : "Inactive"}</span></td>
                        {canManage && (
                          <td>
                            <details className="inventory-item-actions">
                              <summary>Update / stock</summary>
                              <form action={updateInventoryItem} className="mini-form">
                                <input type="hidden" name="id" value={item.id} />
                                <div className="field">
                                  <label htmlFor={`item-name-${item.id}`}>Name</label>
                                  <input id={`item-name-${item.id}`} name="name" defaultValue={item.name} required />
                                </div>
                                <div className="field">
                                  <label htmlFor={`item-sku-${item.id}`}>SKU</label>
                                  <input id={`item-sku-${item.id}`} name="sku" defaultValue={item.sku || ""} />
                                </div>
                                <div className="field">
                                  <label htmlFor={`item-category-${item.id}`}>Category</label>
                                  <select id={`item-category-${item.id}`} name="category_id" defaultValue={item.category_id || ""}>
                                    <option value="">No category</option>
                                    {categories.map((category) => <option key={category.id} value={category.id}>{category.name}</option>)}
                                  </select>
                                </div>
                                <div className="field">
                                  <label htmlFor={`item-supplier-${item.id}`}>Supplier</label>
                                  <select id={`item-supplier-${item.id}`} name="supplier_id" defaultValue={item.supplier_id || ""}>
                                    <option value="">No supplier</option>
                                    {suppliers.map((supplier) => <option key={supplier.id} value={supplier.id}>{supplier.name}</option>)}
                                  </select>
                                </div>
                                <div className="field">
                                  <label htmlFor={`item-unit-${item.id}`}>Unit</label>
                                  <input id={`item-unit-${item.id}`} name="unit" defaultValue={item.unit} required />
                                </div>
                                <div className="field">
                                  <label htmlFor={`item-minimum-${item.id}`}>Minimum stock</label>
                                  <input id={`item-minimum-${item.id}`} name="minimum_stock_level" type="number" min="0" step="0.001" defaultValue={item.minimum_stock_level} required />
                                </div>
                                <div className="field">
                                  <label htmlFor={`item-cost-${item.id}`}>Cost price</label>
                                  <input id={`item-cost-${item.id}`} name="cost_price" type="number" min="0" step="0.01" defaultValue={item.cost_price} required />
                                </div>
                                <div className="field">
                                  <label htmlFor={`item-station-${item.id}`}>Station</label>
                                  <select id={`item-station-${item.id}`} name="station" defaultValue={item.station || "KITCHEN"}>
                                    <option value="KITCHEN">Kitchen</option>
                                    <option value="BAR">Bar</option>
                                  </select>
                                </div>
                                <div className="field">
                                  <label htmlFor={`item-active-${item.id}`}>Status</label>
                                  <select id={`item-active-${item.id}`} name="is_active" defaultValue={item.is_active ? "true" : "false"}>
                                    <option value="true">Active</option>
                                    <option value="false">Inactive</option>
                                  </select>
                                </div>
                                <div className="field">
                                  <label htmlFor={`item-description-${item.id}`}>Description</label>
                                  <textarea id={`item-description-${item.id}`} name="description" defaultValue={item.description || ""} />
                                </div>
                                <button type="submit">Update item</button>
                              </form>
                              <AddStockForm item={item} />
                            </details>
                          </td>
                        )}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <p className="inventory-empty-state">{allItems.length ? "No items match these filters." : "No inventory items yet. Add an item to get started."}</p>
            )}
          </section>

          {canManage && (
            <section className="inventory-request-create-grid">
              <StockRequestForm station="KITCHEN" />
              <StockRequestForm station="BAR" />
            </section>
          )}

          {canManage && <InventoryRequests requests={pendingRequests} />}

          <section className="panel">
            <h2>Request history</h2>
            {requestHistory.length ? (
              <div className="list-stack">
                {requestHistory.map((request) => (
                  <div className="list-row" key={request.id}>
                    <div>
                      <strong>{request.inventory_items?.name || request.requested_item_name || "Inventory item"}</strong>
                      <div className="muted">{request.station} · {formatNumber(request.quantity)} {request.unit} · {formatDate(request.created_at)}</div>
                    </div>
                    <span className={statusBadgeClass(request.status)}>{request.status}</span>
                  </div>
                ))}
              </div>
            ) : <p className="inventory-empty-state">No completed requests yet.</p>}
          </section>

          <section className="panel">
            <h2>Stock movements</h2>
            {movements.length ? (
              <div className="list-stack">
                {movements.map((movement) => (
                  <div className="list-row" key={movement.id}>
                    <div>
                      <strong>{movement.inventory_items?.name || "Inventory item"}</strong>
                      <div className="muted">{movement.movement_type} · {formatDate(movement.created_at)}</div>
                    </div>
                    <div>
                      <strong>{Number(movement.quantity_delta) > 0 ? "+" : ""}{formatNumber(movement.quantity_delta)}</strong>
                      <div className="muted">{movement.reason || "No reason provided"}</div>
                    </div>
                  </div>
                ))}
              </div>
            ) : <p className="inventory-empty-state">No stock movements recorded.</p>}
          </section>

          <section className="panel">
            <h2>Inventory audit history</h2>
            {auditLogs.length ? (
              <div className="list-stack">
                {auditLogs.map((audit) => (
                  <div className="list-row" key={audit.id}>
                    <div>
                      <strong>{audit.inventory_items?.name || "Inventory item"}</strong>
                      <div className="muted">{audit.action} · {formatDate(audit.created_at)}</div>
                    </div>
                    <div>
                      <strong>{formatNumber(audit.previous_quantity)} → {formatNumber(audit.new_quantity)}</strong>
                      <div className="muted">{audit.note || "No note"}</div>
                    </div>
                  </div>
                ))}
              </div>
            ) : <p className="inventory-empty-state">No inventory audit activity.</p>}
          </section>
        </div>
      </main>
    </div>
  );
}
