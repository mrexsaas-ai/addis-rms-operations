import { redirect } from "next/navigation";
import { getAuthContext } from "@/lib/auth";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import "./inventory.css";
import {
  createInventoryCategory,
  createInventoryItem,
  createStockRequest,
  createSupplier,
  recordStockMovement,
  updateInventoryItem,
  updateStockRequestStatus,
} from "./actions";

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

function statusBadgeClass(status) {
  if (status === "PENDING") return "status status-pending";
  if (status === "APPROVED") return "status status-approved";
  if (status === "FULFILLED") return "status status-fulfilled";
  return "status status-rejected";
}

export default async function InventoryPage({ searchParams = {} }) {
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
  const canRequest = ["ADMIN", "OWNER", "MANAGER", "CHEF", "BARMAN"].includes(membership.role);

  const categoryFilter = typeof searchParams.category === "string" ? searchParams.category : "all";
  const supplierFilter = typeof searchParams.supplier === "string" ? searchParams.supplier : "all";
  const searchTerm = typeof searchParams.q === "string" ? searchParams.q : "";

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
      .select(
        "id, name, sku, unit, current_quantity, minimum_stock_level, cost_price, is_active, description, category_id, supplier_id, inventory_categories(name), suppliers(name)"
      )
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
      .limit(12),
    supabase
      .from("stock_requests")
      .select("id, status, quantity, unit, note, created_at, requested_by_user_id, approved_by_user_id, inventory_items(name)")
      .eq("restaurant_id", membership.restaurant_id)
      .order("created_at", { ascending: false })
      .limit(20),
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

  let items = itemsResult.data || [];
  if (searchTerm) {
    items = items.filter((item) => `${item.name} ${item.sku || ""}`.toLowerCase().includes(searchTerm.toLowerCase()));
  }
  if (categoryFilter !== "all") {
    items = items.filter((item) => item.category_id === categoryFilter);
  }
  if (supplierFilter !== "all") {
    items = items.filter((item) => item.supplier_id === supplierFilter);
  }

  const categories = categoriesResult.data || [];
  const suppliers = suppliersResult.data || [];
  const movements = movementsResult.data || [];
  const requests = requestsResult.data || [];
  const auditLogs = auditResult.data || [];

  const totalItems = items.length;
  const lowStock = items.filter((item) => Number(item.current_quantity) <= Number(item.minimum_stock_level) && item.is_active).length;
  const outOfStock = items.filter((item) => Number(item.current_quantity) <= 0).length;
  const totalStockValue = items.reduce((sum, item) => sum + Number(item.current_quantity || 0) * Number(item.cost_price || 0), 0);
  const activeSuppliers = suppliers.filter((supplier) => supplier.is_active).length;
  const pendingRequests = requests.filter((request) => request.status === "PENDING").length;
  const lowStockItems = items.filter((item) => Number(item.current_quantity) <= Number(item.minimum_stock_level) && item.is_active);

  return (
    <main className="inventory-page">
      <div className="inventory-shell">
        <header className="topbar">
          <div>
            <p className="eyebrow">Inventory</p>
            <h1>Warehouse dashboard</h1>
          </div>
          <div className="brand-mark">ADDIS RMS</div>
        </header>

        <section className="stats-grid">
          <article className="stat-card">
            <div className="stat-label">Total Items</div>
            <div className="stat-value">{formatNumber(totalItems)}</div>
          </article>
          <article className="stat-card">
            <div className="stat-label">Low Stock</div>
            <div className="stat-value">{formatNumber(lowStock)}</div>
          </article>
          <article className="stat-card">
            <div className="stat-label">Out of Stock</div>
            <div className="stat-value">{formatNumber(outOfStock)}</div>
          </article>
          <article className="stat-card">
            <div className="stat-label">Total Stock Value</div>
            <div className="stat-value">{formatMoney(totalStockValue)}</div>
          </article>
          <article className="stat-card">
            <div className="stat-label">Active Suppliers</div>
            <div className="stat-value">{formatNumber(activeSuppliers)}</div>
          </article>
          <article className="stat-card">
            <div className="stat-label">Pending Requests</div>
            <div className="stat-value">{formatNumber(pendingRequests)}</div>
          </article>
        </section>

        <div className="content-grid">
          <aside className="stack">
            {canManage && (
              <section className="panel">
                <h2>Add inventory item</h2>
                <form action={createInventoryItem}>
                  <div className="field">
                    <label>Name</label>
                    <input name="name" required placeholder="Tomato paste" />
                  </div>
                  <div className="field">
                    <label>SKU</label>
                    <input name="sku" placeholder="SKU-001" />
                  </div>
                  <div className="inline-grid">
                    <div className="field">
                      <label>Category</label>
                      <select name="category_id">
                        <option value="">No category</option>
                        {categories.map((category) => (
                          <option key={category.id} value={category.id}>{category.name}</option>
                        ))}
                      </select>
                    </div>
                    <div className="field">
                      <label>Supplier</label>
                      <select name="supplier_id">
                        <option value="">No supplier</option>
                        {suppliers.map((supplier) => (
                          <option key={supplier.id} value={supplier.id}>{supplier.name}</option>
                        ))}
                      </select>
                    </div>
                  </div>
                  <div className="inline-grid">
                    <div className="field">
                      <label>Unit</label>
                      <input name="unit" defaultValue="pcs" />
                    </div>
                    <div className="field">
                      <label>Cost</label>
                      <input name="cost_price" type="number" step="0.01" min="0" defaultValue="0" />
                    </div>
                  </div>
                  <div className="inline-grid">
                    <div className="field">
                      <label>Current Qty</label>
                      <input name="current_quantity" type="number" step="0.01" min="0" defaultValue="0" />
                    </div>
                    <div className="field">
                      <label>Min Stock</label>
                      <input name="minimum_stock_level" type="number" step="0.01" min="0" defaultValue="0" />
                    </div>
                  </div>
                  <div className="field">
                    <label>Description</label>
                    <textarea name="description" placeholder="Optional description" />
                  </div>
                  <div className="field">
                    <label>Active</label>
                    <select name="is_active">
                      <option value="true">Active</option>
                      <option value="false">Inactive</option>
                    </select>
                  </div>
                  <button type="submit">Add item</button>
                </form>
              </section>
            )}

            {canManage && (
              <section className="panel">
                <h2>Add category</h2>
                <form action={createInventoryCategory}>
                  <div className="field">
                    <label>Category name</label>
                    <input name="name" placeholder="Vegetables" required />
                  </div>
                  <button type="submit">Save category</button>
                </form>
              </section>
            )}

            {canManage && (
              <section className="panel">
                <h2>Add supplier</h2>
                <form action={createSupplier}>
                  <div className="field">
                    <label>Name</label>
                    <input name="name" required placeholder="City Foods" />
                  </div>
                  <div className="field">
                    <label>Phone</label>
                    <input name="phone" placeholder="+251..." />
                  </div>
                  <div className="field">
                    <label>Email</label>
                    <input name="email" type="email" placeholder="supplier@example.com" />
                  </div>
                  <div className="field">
                    <label>Address</label>
                    <textarea name="address" placeholder="Supplier address" />
                  </div>
                  <div className="field">
                    <label>Notes</label>
                    <textarea name="notes" placeholder="Optional notes" />
                  </div>
                  <button type="submit">Save supplier</button>
                </form>
              </section>
            )}
          </aside>

          <section className="stack">
            <section className="panel">
              <div className="toolbar">
                <form method="get" className="filter-form">
                  <div className="field">
                    <label>Search</label>
                    <input name="q" defaultValue={searchTerm} placeholder="Search item or SKU" />
                  </div>
                  <div className="field">
                    <label>Category</label>
                    <select name="category" defaultValue={categoryFilter}>
                      <option value="all">All categories</option>
                      {categories.map((category) => (
                        <option key={category.id} value={category.id}>{category.name}</option>
                      ))}
                    </select>
                  </div>
                  <div className="field">
                    <label>Supplier</label>
                    <select name="supplier" defaultValue={supplierFilter}>
                      <option value="all">All suppliers</option>
                      {suppliers.map((supplier) => (
                        <option key={supplier.id} value={supplier.id}>{supplier.name}</option>
                      ))}
                    </select>
                  </div>
                  <button type="submit">Apply</button>
                </form>
              </div>
            </section>

            {lowStockItems.length > 0 && (
              <section className="panel">
                <h2>Low stock</h2>
                <div className="list-stack">
                  {lowStockItems.slice(0, 8).map((item) => (
                    <div className="list-row" key={item.id}>
                      <div>
                        <strong>{item.name}</strong>
                        <div className="muted">{item.sku || "No SKU"}</div>
                      </div>
                      <div>
                        <div>{formatNumber(item.current_quantity)} / {formatNumber(item.minimum_stock_level)} {item.unit}</div>
                      </div>
                    </div>
                  ))}
                </div>
              </section>
            )}

            <section className="table-panel">
              <h2>Inventory items</h2>
              <table>
                <thead>
                  <tr>
                    <th>Item</th>
                    <th>Category</th>
                    <th>Supplier</th>
                    <th>Qty</th>
                    <th>Cost</th>
                    <th>Status</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {items.map((item) => (
                    <tr key={item.id}>
                      <td>
                        <div><strong>{item.name}</strong></div>
                        <div className="muted">{item.sku || "No SKU"}</div>
                        <div className="muted">{item.unit}</div>
                      </td>
                      <td>{item.inventory_categories?.name || "Uncategorized"}</td>
                      <td>{item.suppliers?.name || "No supplier"}</td>
                      <td>
                        <div>{formatNumber(item.current_quantity)} {item.unit}</div>
                        <div className="muted">Min {formatNumber(item.minimum_stock_level)}</div>
                      </td>
                      <td>{formatMoney(item.cost_price)}</td>
                      <td>
                        <span className={item.is_active ? "badge" : "badge danger"}>{item.is_active ? "Active" : "Inactive"}</span>
                      </td>
                      <td>
                        {canManage && (
                          <div className="mini-form">
                            <form action={updateInventoryItem}>
                              <input type="hidden" name="id" value={item.id} />
                              <div className="field">
                                <label>Name</label>
                                <input name="name" defaultValue={item.name} />
                              </div>
                              <div className="field">
                                <label>SKU</label>
                                <input name="sku" defaultValue={item.sku || ""} />
                              </div>
                              <div className="field">
                                <label>Category</label>
                                <select name="category_id" defaultValue={item.category_id || ""}>
                                  <option value="">No category</option>
                                  {categories.map((category) => (
                                    <option key={category.id} value={category.id}>{category.name}</option>
                                  ))}
                                </select>
                              </div>
                              <div className="field">
                                <label>Supplier</label>
                                <select name="supplier_id" defaultValue={item.supplier_id || ""}>
                                  <option value="">No supplier</option>
                                  {suppliers.map((supplier) => (
                                    <option key={supplier.id} value={supplier.id}>{supplier.name}</option>
                                  ))}
                                </select>
                              </div>
                              <div className="field">
                                <label>Unit</label>
                                <input name="unit" defaultValue={item.unit} />
                              </div>
                              <div className="field">
                                <label>Min stock</label>
                                <input name="minimum_stock_level" type="number" step="0.01" defaultValue={item.minimum_stock_level} />
                              </div>
                              <div className="field">
                                <label>Cost</label>
                                <input name="cost_price" type="number" step="0.01" defaultValue={item.cost_price} />
                              </div>
                              <div className="field">
                                <label>Active</label>
                                <select name="is_active" defaultValue={item.is_active ? "true" : "false"}>
                                  <option value="true">Active</option>
                                  <option value="false">Inactive</option>
                                </select>
                              </div>
                              <button type="submit">Update item</button>
                            </form>
                            <form action={recordStockMovement}>
                              <input type="hidden" name="item_id" value={item.id} />
                              <input type="hidden" name="unit" value={item.unit} />
                              <div className="field">
                                <label>Movement type</label>
                                <select name="movement_type" defaultValue="ADD_STOCK">
                                  <option value="ADD_STOCK">Add stock</option>
                                  <option value="USAGE">Usage</option>
                                  <option value="ADJUSTMENT">Adjustment</option>
                                  <option value="TRANSFER">Transfer</option>
                                  <option value="RETURN">Return</option>
                                  <option value="WASTE">Waste</option>
                                  <option value="REJECTED">Rejected</option>
                                </select>
                              </div>
                              <div className="field">
                                <label>Quantity</label>
                                <input name="quantity" type="number" step="0.01" defaultValue="0" />
                              </div>
                              <div className="field">
                                <label>Reason</label>
                                <input name="reason" placeholder="Reason" />
                              </div>
                              <button type="submit">Apply</button>
                            </form>
                          </div>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </section>

            <section className="panel">
              <h2>Suppliers</h2>
              <div className="list-stack">
                {suppliers.map((supplier) => (
                  <div className="list-row" key={supplier.id}>
                    <div>
                      <strong>{supplier.name}</strong>
                      <div className="muted">{supplier.is_active ? "Active" : "Inactive"}</div>
                    </div>
                  </div>
                ))}
              </div>
            </section>

            <section className="panel">
              <h2>Stock requests</h2>
              {canRequest && (
                <form action={createStockRequest}>
                  <div className="field">
                    <label>Item</label>
                    <select name="item_id" required>
                      <option value="">Select item</option>
                      {items.map((item) => (
                        <option key={item.id} value={item.id}>{item.name}</option>
                      ))}
                    </select>
                  </div>
                  <div className="inline-grid">
                    <div className="field">
                      <label>Quantity</label>
                      <input name="quantity" type="number" min="0.01" step="0.01" required />
                    </div>
                    <div className="field">
                      <label>Unit</label>
                      <input name="unit" placeholder="pcs" />
                    </div>
                  </div>
                  <div className="field">
                    <label>Note</label>
                    <textarea name="note" placeholder="Request note" />
                  </div>
                  <button type="submit">Create request</button>
                </form>
              )}

              <div className="list-stack" style={{ marginTop: 16 }}>
                {requests.map((request) => (
                  <div className="list-row" key={request.id}>
                    <div>
                      <strong>{request.inventory_items?.name || "Unknown item"}</strong>
                      <div className="muted">{request.quantity} {request.unit}</div>
                    </div>
                    <div>
                      <span className={statusBadgeClass(request.status)}>{request.status}</span>
                      {canManage && request.status !== "FULFILLED" && (
                        <form action={updateStockRequestStatus} style={{ marginTop: 8 }}>
                          <input type="hidden" name="request_id" value={request.id} />
                          <select name="status" defaultValue="APPROVED">
                            <option value="APPROVED">Approve</option>
                            <option value="REJECTED">Reject</option>
                            <option value="FULFILLED">Fulfill</option>
                          </select>
                          <div style={{ marginTop: 8 }}>
                            <input name="note" placeholder="Review note" />
                          </div>
                          <button type="submit" style={{ marginTop: 8 }}>Submit</button>
                        </form>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </section>

            <section className="panel">
              <h2>Stock history</h2>
              <div className="list-stack">
                {movements.map((movement) => (
                  <div className="list-row" key={movement.id}>
                    <div>
                      <strong>{movement.inventory_items?.name || "Item"}</strong>
                      <div className="muted">{movement.movement_type}</div>
                    </div>
                    <div>
                      <div>{movement.quantity_delta > 0 ? "+" : ""}{formatNumber(movement.quantity_delta)}</div>
                      <div className="muted">{movement.reason || "No reason"}</div>
                    </div>
                  </div>
                ))}
              </div>
            </section>

            <section className="panel">
              <h2>Audit history</h2>
              <div className="list-stack">
                {auditLogs.map((audit) => (
                  <div className="list-row" key={audit.id}>
                    <div>
                      <strong>{audit.inventory_items?.name || "Item"}</strong>
                      <div className="muted">{audit.action}</div>
                    </div>
                    <div>
                      <div>{formatNumber(audit.previous_quantity)} → {formatNumber(audit.new_quantity)}</div>
                      <div className="muted">{audit.note || "No note"}</div>
                    </div>
                  </div>
                ))}
              </div>
            </section>
          </section>
        </div>
      </div>
    </main>
  );
}
