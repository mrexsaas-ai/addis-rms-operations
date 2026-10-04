export const INVENTORY_UNITS = Object.freeze(["kg", "g", "L", "ml", "pcs", "box"]);

export function convertRecipeQuantity(quantity, recipeUnit, inventoryUnit) {
  const amount = Number(quantity);
  if (!Number.isFinite(amount) || amount <= 0) {
    return { ok: false, reason: "invalid_quantity" };
  }
  if (!INVENTORY_UNITS.includes(recipeUnit) || !INVENTORY_UNITS.includes(inventoryUnit)) {
    return { ok: false, reason: "invalid_unit" };
  }

  let converted;
  if (recipeUnit === inventoryUnit) {
    converted = amount;
  } else if (recipeUnit === "g" && inventoryUnit === "kg") {
    converted = amount / 1000;
  } else if (recipeUnit === "kg" && inventoryUnit === "g") {
    converted = amount * 1000;
  } else if (recipeUnit === "ml" && inventoryUnit === "L") {
    converted = amount / 1000;
  } else if (recipeUnit === "L" && inventoryUnit === "ml") {
    converted = amount * 1000;
  } else {
    return { ok: false, reason: "incompatible_units" };
  }

  const rounded = Math.round((converted + Number.EPSILON) * 1000) / 1000;
  if (!Number.isFinite(converted) || Math.abs(converted - rounded) > 1e-9) {
    return { ok: false, reason: "stock_precision" };
  }

  return { ok: true, quantity: rounded };
}