"use client";

export default function InventoryError({ reset }) {
  return (
    <main className="inventory-page state-page">
      <div className="state-panel">
        <span className="brand-mark">ADDIS RMS</span>
        <p className="eyebrow">INVENTORY</p>
        <h1>Inventory is unavailable.</h1>
        <p>We could not load the current restaurant inventory.</p>
        <button type="button" onClick={() => reset()}>Try again</button>
      </div>
    </main>
  );
}
