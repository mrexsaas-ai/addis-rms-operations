"use client";

import { useActionState, useState } from "react";
import { recordStockMovement } from "./actions";

const initialState = { success: false, error: "" };

async function submitAddStock(previousState, formData) {
  try {
    await recordStockMovement(formData);
    return { success: true, error: "" };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : "Unable to add stock.",
    };
  }
}

export default function AddStockForm({ item }) {
  const [state, formAction, pending] = useActionState(submitAddStock, initialState);
  const [quantity, setQuantity] = useState("");

  return (
    <form action={formAction} className="mini-form">
      <input type="hidden" name="item_id" value={item.id} />
      <input type="hidden" name="unit" value={item.unit} />
      <div className="field">
        <label htmlFor={`stock-operation-${item.id}`}>Operation</label>
        <select id={`stock-operation-${item.id}`} name="movement_type" defaultValue="ADD_STOCK">
          <option value="ADD_STOCK">Stock in</option>
          <option value="ADJUSTMENT">Adjustment</option>
        </select>
      </div>
      <div className="field">
        <label htmlFor={`stock-direction-${item.id}`}>Adjustment direction</label>
        <select id={`stock-direction-${item.id}`} name="direction" defaultValue="INCREASE">
          <option value="INCREASE">Increase</option>
          <option value="DECREASE">Decrease</option>
        </select>
      </div>
      <div className="field">
        <label>Supplier</label>
        <input value={item.suppliers?.name || "No supplier"} readOnly />
      </div>
      <div className="field">
        <label htmlFor={`add-stock-${item.id}`}>Add stock ({item.unit})</label>
        <input
          id={`add-stock-${item.id}`}
          name="quantity"
          type="number"
          min="0.01"
          step="0.01"
          value={quantity}
          onChange={(event) => setQuantity(event.target.value)}
          required
          disabled={pending}
        />
      </div>
      <div className="field">
        <label htmlFor={`add-stock-reason-${item.id}`}>Reason</label>
        <input
          id={`add-stock-reason-${item.id}`}
          name="reason"
          placeholder="Received stock"
          disabled={pending}
        />
      </div>
      <button type="submit" disabled={pending || !quantity}>
        {pending ? "Adding..." : "Add stock"}
      </button>
      {state.success && <p className="kds-success" role="status">Stock added successfully.</p>}
      {state.error && <p className="kds-error" role="alert">{state.error}</p>}
    </form>
  );
}

export function InventoryQuickAddStockForm({ items = [] }) {
  const [isOpen, setIsOpen] = useState(false);
  const [selectedItemId, setSelectedItemId] = useState(items[0]?.id || "");
  const [state, formAction, pending] = useActionState(submitAddStock, initialState);

  const selectedItem = items.find((item) => item.id === selectedItemId) || null;

  return (
    <section className="panel" style={{ marginBottom: 18 }}>
      <div className="toolbar" style={{ justifyContent: "space-between", alignItems: "center" }}>
        <div>
          <p className="eyebrow">INVENTORY</p>
          <h2 style={{ margin: 0 }}>Add stock</h2>
        </div>
        <button type="button" className="primary-button" onClick={() => setIsOpen((value) => !value)}>
          {isOpen ? "Close" : "Add Stock"}
        </button>
      </div>

      {isOpen && (
        items.length > 0 ? (
          <form action={formAction} className="mini-form">
            <input type="hidden" name="movement_type" value="ADD_STOCK" />
            <div className="field">
              <label htmlFor="quick-stock-item">Inventory item</label>
              <select
                id="quick-stock-item"
                name="item_id"
                value={selectedItemId}
                onChange={(event) => setSelectedItemId(event.target.value)}
                required
              >
                <option value="">Select item</option>
                {items.map((item) => (
                  <option key={item.id} value={item.id}>
                    {item.name} ({item.unit})
                  </option>
                ))}
              </select>
            </div>

            <div className="field">
              <label htmlFor="quick-stock-quantity">Quantity</label>
              <input id="quick-stock-quantity" name="quantity" type="number" min="0.01" step="0.01" required disabled={pending || !selectedItemId} />
            </div>

            <div className="field">
              <label htmlFor="quick-stock-unit">Unit</label>
              <input id="quick-stock-unit" name="unit" value={selectedItem?.unit || ""} readOnly />
            </div>

            <div className="field">
              <label>Supplier</label>
              <input value={selectedItem?.suppliers?.name || "No supplier"} readOnly />
            </div>

            <div className="field">
              <label htmlFor="quick-stock-reason">Note</label>
              <input id="quick-stock-reason" name="reason" placeholder="Received stock" disabled={pending} />
            </div>

            <button type="submit" disabled={pending || !selectedItemId}>
              {pending ? "Adding..." : "Add Stock"}
            </button>

            {state.success && <p className="kds-success" role="status">Stock added successfully.</p>}
            {state.error && <p className="kds-error" role="alert">{state.error}</p>}
          </form>
        ) : (
          <p className="muted" style={{ margin: 0 }}>No inventory items are available for this restaurant.</p>
        )
      )}
    </section>
  );
}
