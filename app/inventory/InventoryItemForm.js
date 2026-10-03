"use client";

import { useActionState, useRef } from "react";
import { useLanguage } from "@/app/i18n/LanguageProvider";

const initialState = { success: false, error: "" };
const unitOptions = ["kg", "g", "L", "ml", "pcs", "box"];

async function submitInventoryItem(previousState, formData, action) {
  try {
    await action(formData);
    return { success: true, error: "" };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : "Unable to save inventory item.",
    };
  }
}

export default function InventoryItemForm({ action, categories, suppliers }) {
  const { t } = useLanguage();
  const formRef = useRef(null);
  const [state, formAction, pending] = useActionState(
    async (previousState, formData) => {
      const nextState = await submitInventoryItem(previousState, formData, action);
      if (nextState.success) formRef.current?.reset();
      return nextState;
    },
    initialState
  );

  return (
    <form ref={formRef} className="inventory-item-form" action={formAction}>
      <div className="inventory-form-heading">
        <div>
          <p className="inventory-form-eyebrow">INVENTORY SETUP</p>
          <h3>Add item</h3>
          <p>Create an item first so Kitchen and Bar can request it.</p>
        </div>
        <span className="inventory-form-badge">MANAGEMENT</span>
      </div>
      <div className="inventory-form-field">
        <label htmlFor="inventory-item-name">Item name</label>
        <input id="inventory-item-name" name="name" required placeholder="Flour, Cooking Oil, Chicken" disabled={pending} />
      </div>
      <div className="inventory-form-grid">
        <div className="inventory-form-field">
          <label htmlFor="inventory-item-category">Item type</label>
          <select id="inventory-item-category" name="category_id" disabled={pending}>
            <option value="">No category</option>
            {categories.map((category) => <option key={category.id} value={category.id}>{category.name}</option>)}
          </select>
        </div>
        <div className="inventory-form-field">
          <label htmlFor="inventory-item-unit">Unit</label>
          <select id="inventory-item-unit" name="unit" defaultValue="pcs" disabled={pending} required>
            {unitOptions.map((unit) => <option key={unit} value={unit}>{unit}</option>)}
          </select>
        </div>
      </div>
      <div className="inventory-form-grid">
        <div className="inventory-form-field">
          <label htmlFor="inventory-item-stock">Initial stock</label>
          <input id="inventory-item-stock" name="current_quantity" type="number" min="0" step="0.001" defaultValue="0" required disabled={pending} />
        </div>
        <div className="inventory-form-field">
          <label htmlFor="inventory-item-minimum">Minimum stock</label>
          <input id="inventory-item-minimum" name="minimum_stock_level" type="number" min="0" step="0.001" defaultValue="0" required disabled={pending} />
        </div>
      </div>
      <details className="inventory-form-advanced">
        <summary>More item details</summary>
        <div className="inventory-form-field">
          <label htmlFor="inventory-item-supplier">Supplier</label>
          <select id="inventory-item-supplier" name="supplier_id" disabled={pending}>
            <option value="">No supplier</option>
            {suppliers.map((supplier) => <option key={supplier.id} value={supplier.id}>{supplier.name}</option>)}
          </select>
        </div>
        <div className="inventory-form-grid">
          <div className="inventory-form-field">
            <label htmlFor="inventory-item-station">Station</label>
            <select id="inventory-item-station" name="station" defaultValue="KITCHEN" disabled={pending}>
              <option value="KITCHEN">Kitchen</option>
              <option value="BAR">Bar</option>
            </select>
          </div>
          <div className="inventory-form-field">
            <label htmlFor="inventory-item-cost">Cost price</label>
            <input id="inventory-item-cost" name="cost_price" type="number" min="0" step="0.01" defaultValue="0" disabled={pending} />
          </div>
        </div>
        <div className="inventory-form-grid">
          <div className="inventory-form-field">
            <label htmlFor="inventory-item-sku">SKU</label>
            <input id="inventory-item-sku" name="sku" placeholder="Optional item code" disabled={pending} />
          </div>
          <div className="inventory-form-field">
            <label htmlFor="inventory-item-active">Status</label>
            <select id="inventory-item-active" name="is_active" defaultValue="true" disabled={pending}>
              <option value="true">Active</option>
              <option value="false">Inactive</option>
            </select>
          </div>
        </div>
        <div className="inventory-form-field">
          <label htmlFor="inventory-item-note">Optional note</label>
          <textarea id="inventory-item-note" name="description" placeholder="Optional item note" disabled={pending} />
        </div>
      </details>
      <button className="inventory-form-submit" type="submit" disabled={pending}>{pending ? "Adding item..." : "Add item"}</button>
      {state.success && <p className="inventory-form-success" role="status">Item added successfully.</p>}
      {state.error && <p className="inventory-form-error" role="alert">{t(state.error)}</p>}
    </form>
  );
}
