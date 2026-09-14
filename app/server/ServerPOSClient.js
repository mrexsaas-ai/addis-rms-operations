"use client";

import { useActionState, useMemo, useState } from "react";
import { createServerOrder } from "./actions";
import { recordPayment } from "../orders/actions";

const statusColors = {
  AVAILABLE: "success",
  OCCUPIED: "danger",
  RESERVED: "warning",
  CLEANING: "muted",
};

const defaultState = {
  success: false,
  error: "",
  orderId: null,
};

async function submitOrder(prevState, formData) {
  try {
    const result = await createServerOrder(formData);
    return {
      success: true,
      orderId: result?.orderId || null,
      error: "",
    };
  } catch (error) {
    return {
      success: false,
      orderId: null,
      error: error?.message || "Unable to create this order.",
    };
  }
}

function formatCurrency(value) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "ETB",
    currencyDisplay: "code",
  }).format(Number(value || 0));
}

export default function ServerPOSClient({ restaurantName, tables, categories, menuItems, paymentAccounts }) {
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedCategory, setSelectedCategory] = useState("ALL");
  const [orderType, setOrderType] = useState("DINE_IN");
  const [selectedTableId, setSelectedTableId] = useState(
    tables.find((table) => ["AVAILABLE", "RESERVED"].includes(table.status))?.id || ""
  );
  const [notes, setNotes] = useState("");
  const [cart, setCart] = useState([]);
  const [paymentMethod, setPaymentMethod] = useState("CASH");
  const [state, formAction, pending] = useActionState(submitOrder, defaultState);

  function handleOrderTypeChange(nextOrderType) {
    setOrderType(nextOrderType);
    if (nextOrderType !== "DINE_IN") {
      setSelectedTableId("");
      return;
    }

    const eligibleTables = (tables || []).filter((table) =>
      ["AVAILABLE", "RESERVED"].includes(table.status)
    );

    setSelectedTableId(eligibleTables[0]?.id || "");
  }

  const categoryList = useMemo(
    () => [{ id: "ALL", name: "All items" }, ...(categories || [])],
    [categories]
  );

  const filteredItems = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();

    return (menuItems || []).filter((item) => {
      const matchesCategory =
        selectedCategory === "ALL" || item.category_id === selectedCategory;
      const haystack = `${item.name} ${item.description || ""}`.toLowerCase();
      const matchesSearch = !query || haystack.includes(query);
      return matchesCategory && matchesSearch;
    });
  }, [menuItems, searchQuery, selectedCategory]);

  const subtotal = cart.reduce(
    (sum, item) => sum + Number(item.price || 0) * Number(item.quantity || 0),
    0
  );

  const availableTables = tables.filter((table) =>
    ["AVAILABLE", "RESERVED"].includes(table.status)
  );

  function addItemToCart(item) {
    setCart((current) => {
      const existing = current.find((entry) => entry.id === item.id);
      if (existing) {
        return current.map((entry) =>
          entry.id === item.id
            ? { ...entry, quantity: entry.quantity + 1 }
            : entry
        );
      }
      return [
        ...current,
        { id: item.id, name: item.name, price: Number(item.price), quantity: 1, station: item.station || "KITCHEN" },
      ];
    });
  }

  function updateQuantity(itemId, nextQuantity) {
    setCart((current) => {
      if (nextQuantity <= 0) {
        return current.filter((entry) => entry.id !== itemId);
      }
      return current.map((entry) =>
        entry.id === itemId ? { ...entry, quantity: nextQuantity } : entry
      );
    });
  }

  const selectedTable = tables.find((table) => table.id === selectedTableId) || null;
  const activeTableCount = tables.filter((table) => table.status === "AVAILABLE").length;
  const occupiedTableCount = tables.filter((table) => table.status === "OCCUPIED").length;

  return (
    <div className="server-page-shell">
      <style>{`
        .server-page-shell {
          min-height: 100vh;
          background: #0b0b0c;
          color: #f5f5f5;
          padding: 28px;
        }
        .server-layout {
          max-width: 1440px;
          margin: 0 auto;
          display: grid;
          grid-template-columns: 1.2fr 0.8fr;
          gap: 20px;
        }
        .panel {
          background: #111113;
          border: 1px solid #2a2a2d;
          border-radius: 18px;
          padding: 20px;
        }
        .brand {
          letter-spacing: 0.18em;
          font-weight: 800;
          font-size: 11px;
          text-transform: uppercase;
          color: #d8ff45;
        }
        .eyebrow {
          margin: 0 0 8px;
          font-size: 12px;
          letter-spacing: 0.16em;
          text-transform: uppercase;
          opacity: 0.6;
        }
        .header-row {
          display: flex;
          justify-content: space-between;
          align-items: end;
          gap: 16px;
          margin-bottom: 20px;
        }
        .header-row h1 {
          margin: 0;
          font-size: clamp(30px, 3vw, 46px);
          letter-spacing: -0.05em;
        }
        .header-row p {
          margin: 8px 0 0;
          color: #a4a4a7;
        }
        .stats-grid {
          display: grid;
          grid-template-columns: repeat(4, minmax(0, 1fr));
          gap: 12px;
          margin-bottom: 20px;
        }
        .stat-card {
          background: #111113;
          border: 1px solid #2a2a2d;
          border-radius: 16px;
          padding: 18px;
        }
        .stat-card span {
          display: block;
          color: #9aa0a8;
          font-size: 12px;
          margin-bottom: 8px;
          text-transform: uppercase;
          letter-spacing: 0.12em;
        }
        .stat-card strong {
          font-size: 28px;
          letter-spacing: -0.05em;
        }
        .toolbar {
          display: flex;
          gap: 12px;
          flex-wrap: wrap;
          margin-bottom: 18px;
        }
        .toolbar-field {
          flex: 1;
          min-width: 180px;
        }
        .toolbar-field input,
        .toolbar-field select,
        .toolbar-field textarea,
        .server-form select,
        .server-form input,
        .server-form textarea {
          width: 100%;
          box-sizing: border-box;
          border: 1px solid #303034;
          background: #09090b;
          color: #f5f5f5;
          border-radius: 10px;
          padding: 12px 14px;
          font: inherit;
        }
        .toolbar-field label,
        .server-form label {
          display: block;
          margin-bottom: 7px;
          color: #a5a5a8;
          font-size: 12px;
          text-transform: uppercase;
          letter-spacing: 0.12em;
        }
        .filter-row {
          display: flex;
          gap: 8px;
          flex-wrap: wrap;
          margin-bottom: 18px;
        }
        .filter-chip {
          border: 1px solid #33343a;
          background: transparent;
          color: #d9d9dd;
          border-radius: 999px;
          padding: 8px 12px;
          font-size: 12px;
          cursor: pointer;
        }
        .filter-chip.active {
          background: #d8ff45;
          color: #101010;
          border-color: #d8ff45;
        }
        .menu-grid {
          display: grid;
          grid-template-columns: repeat(2, minmax(0, 1fr));
          gap: 14px;
        }
        .menu-item {
          background: #0d0d0f;
          border: 1px solid #2a2a2d;
          border-radius: 16px;
          padding: 12px;
          display: grid;
          gap: 10px;
        }
        .item-image {
          width: 100%;
          height: 120px;
          object-fit: cover;
          border-radius: 10px;
          background: #18181b;
        }
        .item-header {
          display: flex;
          justify-content: space-between;
          gap: 12px;
          align-items: center;
        }
        .item-header h3 {
          margin: 0;
          font-size: 16px;
        }
        .price-tag {
          font-weight: 800;
          color: #d8ff45;
        }
        .meta-row {
          display: flex;
          justify-content: space-between;
          align-items: center;
          gap: 8px;
          color: #a5a5a8;
          font-size: 12px;
        }
        .badge {
          display: inline-flex;
          padding: 5px 8px;
          border-radius: 999px;
          border: 1px solid #3b3b40;
          font-weight: 700;
          text-transform: uppercase;
          font-size: 10px;
          letter-spacing: 0.08em;
        }
        .badge.success { color: #7ade8b; border-color: rgba(122, 222, 139, 0.3); background: rgba(122, 222, 139, 0.12); }
        .badge.warning { color: #f1c35d; border-color: rgba(241, 195, 93, 0.3); background: rgba(241, 195, 93, 0.12); }
        .badge.danger { color: #ff7f7f; border-color: rgba(255, 127, 127, 0.3); background: rgba(255, 127, 127, 0.12); }
        .badge.muted { color: #c7c7ca; border-color: rgba(199, 199, 202, 0.2); background: rgba(199, 199, 202, 0.08); }
        .cta {
          width: 100%;
          border: 0;
          border-radius: 10px;
          padding: 10px 12px;
          background: #d8ff45;
          color: #111111;
          font-weight: 800;
          cursor: pointer;
        }
        .checkout-panel {
          display: flex;
          flex-direction: column;
          gap: 16px;
        }
        .table-grid {
          display: grid;
          grid-template-columns: repeat(2, minmax(0, 1fr));
          gap: 10px;
        }
        .table-card {
          background: #0d0d0f;
          border: 1px solid #2b2b2d;
          border-radius: 12px;
          padding: 12px;
          cursor: pointer;
          transition: border-color 0.2s ease;
        }
        .table-card.selected {
          border-color: #d8ff45;
        }
        .table-card strong {
          display: block;
          font-size: 20px;
        }
        .table-card small {
          display: block;
          color: #a6a6aa;
         margin-top: 4px;
        }
        .cart-list {
          display: grid;
          gap: 12px;
        }
        .cart-row {
          display: grid;
          grid-template-columns: 1fr auto;
          gap: 10px;
          align-items: center;
          padding: 12px 0;
          border-bottom: 1px solid #2a2a2d;
        }
        .qty-control {
          display: inline-flex;
          align-items: center;
          gap: 8px;
          border: 1px solid #323236;
          border-radius: 999px;
          background: #0a0a0b;
        }
        .qty-button {
          width: 28px;
          height: 28px;
          border: 0;
          border-radius: 50%;
          background: #19191b;
          color: #fff;
          cursor: pointer;
          font-size: 18px;
        }
        .totals {
          display: grid;
          gap: 8px;
        }
        .totals-row {
          display: flex;
          justify-content: space-between;
          color: #d5d5d7;
        }
        .totals-row strong {
          color: #f5f5f5;
          font-size: 26px;
        }
        .server-form {
          display: grid;
          gap: 12px;
        }
        .server-form textarea {
          min-height: 90px;
          resize: vertical;
        }
        .submit-button {
          border: 0;
          border-radius: 10px;
          background: #d8ff45;
          color: #101010;
          font-weight: 800;
          padding: 12px 16px;
          cursor: pointer;
        }
        @media (max-width: 980px) {
          .server-layout { grid-template-columns: 1fr; }
          .stats-grid { grid-template-columns: repeat(2, minmax(0, 1fr)); }
          .menu-grid { grid-template-columns: 1fr; }
        }
      `}</style>

      <div className="server-layout">
        <section className="panel">
          <div className="header-row">
            <div>
              <div className="brand">ADDIS RMS</div>
              <p className="eyebrow">SERVER POS</p>
              <h1>{restaurantName}</h1>
              <p>Fast service, real tables, live menu access.</p>
            </div>
          </div>

          <div className="stats-grid">
            <div className="stat-card">
              <span>Tables</span>
              <strong>{tables.length}</strong>
            </div>
            <div className="stat-card">
              <span>Available</span>
              <strong>{activeTableCount}</strong>
            </div>
            <div className="stat-card">
              <span>Occupied</span>
              <strong>{occupiedTableCount}</strong>
            </div>
            <div className="stat-card">
              <span>Reserved</span>
              <strong>{tables.filter((table) => table.status === "RESERVED").length}</strong>
            </div>
          </div>

          <div className="toolbar">
            <div className="toolbar-field">
              <label htmlFor="search-items">Search</label>
              <input
                id="search-items"
                value={searchQuery}
                onChange={(event) => setSearchQuery(event.target.value)}
                placeholder="Search menu items"
              />
            </div>
            <div className="toolbar-field">
              <label htmlFor="queue-type">Order type</label>
              <select
                id="queue-type"
                value={orderType}
                onChange={(event) => handleOrderTypeChange(event.target.value)}
              >
                <option value="DINE_IN">Dine-in</option>
                <option value="TAKEAWAY">Takeaway</option>
                <option value="DELIVERY">Delivery</option>
              </select>
            </div>
          </div>

          <div className="filter-row">
            {categoryList.map((category) => (
              <button
                key={category.id}
                type="button"
                className={`filter-chip ${selectedCategory === category.id ? "active" : ""}`}
                onClick={() => setSelectedCategory(category.id)}
              >
                {category.name}
              </button>
            ))}
          </div>

          <div className="menu-grid">
            {filteredItems.map((item) => (
              <article className="menu-item" key={item.id}>
                {item.image_url ? (
                  <img className="item-image" src={item.image_url} alt={item.name} />
                ) : (
                  <div className="item-image" style={{ display: "grid", placeItems: "center", color: "#9ca3af" }}>
                    No image
                  </div>
                )}
                <div className="item-header">
                  <h3>{item.name}</h3>
                  <span className="price-tag">{formatCurrency(item.price)}</span>
                </div>
                <div className="meta-row">
                  <span>{item.station || "KITCHEN"}</span>
                  <span className="badge success">Available</span>
                </div>
                <p style={{ margin: 0, color: "#b6b6ba", minHeight: "42px" }}>
                  {item.description || "Freshly prepared item."}
                </p>
                <button type="button" className="cta" onClick={() => addItemToCart(item)}>
                  Add to cart
                </button>
              </article>
            ))}
          </div>
        </section>

        <aside className="panel checkout-panel">
          <div>
            <p className="eyebrow">Order setup</p>
            <h2 style={{ margin: "0 0 16px" }}>Checkout</h2>
          </div>

          <div className="table-grid">
            {tables.map((table) => {
              const isSelected = selectedTableId === table.id;
              const disabled = orderType !== "DINE_IN" || !["AVAILABLE", "RESERVED"].includes(table.status);
              return (
                <button
                  key={table.id}
                  type="button"
                  className={`table-card ${isSelected ? "selected" : ""}`}
                  onClick={() => {
                    if (!disabled) setSelectedTableId(table.id);
                  }}
                  style={{ opacity: disabled ? 0.55 : 1, cursor: disabled ? "not-allowed" : "pointer" }}
                >
                  <strong>#{table.table_number}</strong>
                  <small>{table.name || "Table"}</small>
                  <span className={`badge ${statusColors[table.status] || "muted"}`} style={{ marginTop: 10 }}>
                    {table.status}
                  </span>
                </button>
              );
            })}
          </div>

          <form className="server-form" action={formAction}>
            <input type="hidden" name="items" value={JSON.stringify(cart)} />
            <input type="hidden" name="order_type" value={orderType} />
            <input type="hidden" name="table_id" value={orderType === "DINE_IN" ? selectedTableId : ""} />

            <div>
              <label htmlFor="selected-order-type">Current order type</label>
              <select
                id="selected-order-type"
                value={orderType}
                onChange={(event) => handleOrderTypeChange(event.target.value)}
              >
                <option value="DINE_IN">Dine-in</option>
                <option value="TAKEAWAY">Takeaway</option>
                <option value="DELIVERY">Delivery</option>
              </select>
            </div>

            <div>
              <label htmlFor="selected-table">Selected table</label>
              <input
                id="selected-table"
                readOnly
                value={
                  orderType === "DINE_IN"
                    ? selectedTable
                      ? `Table #${selectedTable.table_number}${selectedTable.name ? ` - ${selectedTable.name}` : ""}`
                      : "No eligible table selected"
                    : "Not required for takeaway or delivery"
                }
              />
            </div>

            <div>
              <label htmlFor="notes">Notes</label>
              <textarea
                id="notes"
                name="notes"
                value={notes}
                onChange={(event) => setNotes(event.target.value)}
                placeholder="Guest notes or delivery details"
              />
            </div>

            <div className="cart-list">
              {cart.length === 0 ? (
                <p style={{ color: "#a6a6aa", margin: 0 }}>Cart is empty. Add menu items to begin.</p>
              ) : (
                cart.map((item) => (
                  <div key={item.id} className="cart-row">
                    <div>
                      <strong>{item.name}</strong>
                      <div className="meta-row">
                        <span>{formatCurrency(item.price)}</span>
                        <span>{item.station}</span>
                      </div>
                    </div>
                    <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                      <div className="qty-control">
                        <button type="button" className="qty-button" onClick={() => updateQuantity(item.id, item.quantity - 1)}>
                          −
                        </button>
                        <span>{item.quantity}</span>
                        <button type="button" className="qty-button" onClick={() => updateQuantity(item.id, item.quantity + 1)}>
                          +
                        </button>
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>

            <div className="totals">
              <div className="totals-row">
                <span>Subtotal</span>
                <strong>{formatCurrency(subtotal)}</strong>
              </div>
            </div>

            {state.error ? (
              <div className="badge danger" style={{ width: "fit-content", padding: "8px 12px", color: "#ffb4b4" }}>
                {state.error}
              </div>
            ) : null}

            <button type="submit" className="submit-button" disabled={pending || cart.length === 0}>
              {pending ? "Creating order..." : "Confirm order"}
            </button>
          </form>

          {state.success && state.orderId ? (
              <div style={{ display: "grid", gap: 10 }}>
                <div className="badge success" style={{ width: "fit-content", padding: "8px 12px", color: "#b7f7c3" }}>
                  Order created successfully. Total due: {formatCurrency(subtotal)}
                </div>
                <form className="server-form" action={recordPayment}>
                  <input type="hidden" name="order_id" value={state.orderId} />
                  <input type="hidden" name="amount" value={subtotal} />
                  <label>Payment method
                    <select name="method" value={paymentMethod} onChange={(event) => setPaymentMethod(event.target.value)}>
                      <option value="CASH">Cash</option>
                      <option value="TELEBIRR">Telebirr</option>
                      <option value="BANK_TRANSFER">CBE / Bank transfer</option>
                    </select>
                  </label>
                  {paymentMethod === "CASH" ? (
                    <label>Cash received
                      <input name="cash_received" type="number" min={subtotal} step="0.01" required />
                    </label>
                  ) : (
                    <>
                      <p>{paymentAccounts.find((account) => account.type === (paymentMethod === "TELEBIRR" ? "TELEBIRR" : "BANK_TRANSFER"))?.name || "No configured account"}: {paymentAccounts.find((account) => account.type === (paymentMethod === "TELEBIRR" ? "TELEBIRR" : "BANK_TRANSFER"))?.account_name || "Configure an account in Settings."}</p>
                      <input name="reference_number" placeholder="Transaction reference" required />
                    </>
                  )}
                  <button type="submit" className="submit-button">Record payment</button>
                </form>
              </div>
            ) : null}
        </aside>
      </div>
    </div>
  );
}
