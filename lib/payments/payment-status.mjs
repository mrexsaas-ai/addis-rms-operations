export function normalizePaymentMethod(method) {
  const value = String(method || "").trim().toUpperCase();
  if (value === "CBE" || value === "BANK_TRANSFER") return "BANK_TRANSFER";
  return value;
}

export function isPaymentMethodEnabled(method, enabledMethods = []) {
  const normalized = normalizePaymentMethod(method);
  return Array.isArray(enabledMethods) && enabledMethods.some((item) => normalizePaymentMethod(item) === normalized);
}

export function calculateCashChange(cashReceived, orderTotal) {
  const received = Number(cashReceived ?? 0);
  const total = Number(orderTotal ?? 0);
  if (!Number.isFinite(received) || !Number.isFinite(total)) return 0;
  return Math.max(received - total, 0);
}

export function canVerifyPendingPayment(payment = {}) {
  const status = String(payment?.status || "").trim().toUpperCase();
  const amount = Number(payment?.amount ?? 0);
  return status === "PENDING" && Number.isFinite(amount) && amount > 0;
}

export function nextPaymentDecision(value) {
  const normalized = String(value || "").trim().toUpperCase();
  if (normalized === "REJECTED" || normalized === "DECLINED" || normalized === "FAILED") {
    return "FAILED";
  }
  if (normalized === "COMPLETED") return "COMPLETED";
  return null;
}

export function validateServerPaymentConfirmation({
  orderStatus,
  orderTotal,
  paymentAmount,
  method,
  enabledMethods = [],
  cashReceived,
  currentRestaurantId,
  orderRestaurantId,
  hasCompletedPayment = false,
}) {
  const normalizedMethod = normalizePaymentMethod(method);
  const total = Number(orderTotal ?? 0);
  const amount = Number(paymentAmount ?? 0);

  if (currentRestaurantId && orderRestaurantId && String(currentRestaurantId) !== String(orderRestaurantId)) {
    return { ok: false, reason: "Order belongs to a different restaurant." };
  }

  if (orderStatus === "PAID" || hasCompletedPayment) {
    return { ok: false, reason: "This order is already paid." };
  }

  if (!isPaymentMethodEnabled(normalizedMethod, enabledMethods)) {
    return { ok: false, reason: "This payment method is not enabled for the current restaurant." };
  }

  if (!Number.isFinite(total) || total <= 0) {
    return { ok: false, reason: "Order total is invalid." };
  }

  if (!Number.isFinite(amount) || amount <= 0) {
    return { ok: false, reason: "Payment amount is invalid." };
  }

  if (normalizedMethod !== "CASH" && Number(amount) !== Number(total)) {
    return { ok: false, reason: "Payment amount must match the order total." };
  }

  if (normalizedMethod === "CASH") {
    const received = Number(cashReceived ?? 0);
    if (!Number.isFinite(received) || received < total) {
      return { ok: false, reason: "Cash received must be sufficient for the order total." };
    }
    const change = calculateCashChange(received, total);
    return { ok: true, change, reason: "Cash payment is valid." };
  }

  return { ok: true, change: 0, reason: "Server-confirmed payment is valid." };
}

export function paymentContributesToRevenue(payment = {}) {
  const status = String(payment?.status || "").trim().toUpperCase();
  const amount = Number(payment?.amount ?? 0);
  return status === "COMPLETED" && Number.isFinite(amount) && amount > 0;
}
