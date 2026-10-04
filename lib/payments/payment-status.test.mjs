import test from "node:test";
import assert from "node:assert/strict";

import {
  canVerifyPendingPayment,
  nextPaymentDecision,
  isPaymentMethodEnabled,
  validateServerPaymentConfirmation,
  calculateCashChange,
  paymentContributesToRevenue,
} from "./payment-status.mjs";

test("SERVER can confirm valid payment", () => {
  const result = validateServerPaymentConfirmation({
    orderStatus: "NEW",
    orderTotal: 850,
    paymentAmount: 850,
    method: "CASH",
    enabledMethods: ["CASH", "TELEBIRR", "CBE"],
    cashReceived: 1000,
    hasCompletedPayment: false,
  });

  assert.equal(result.ok, true);
  assert.equal(result.change, 150);
});

test("SERVER cannot confirm another restaurant's order", () => {
  const result = validateServerPaymentConfirmation({
    orderStatus: "NEW",
    orderTotal: 200,
    paymentAmount: 200,
    method: "TELEBIRR",
    enabledMethods: ["TELEBIRR"],
    currentRestaurantId: "rest-1",
    orderRestaurantId: "rest-2",
    hasCompletedPayment: false,
  });

  assert.equal(result.ok, false);
  assert.match(result.reason, /restaurant/i);
});

test("SERVER cannot confirm an already-paid order twice", () => {
  const result = validateServerPaymentConfirmation({
    orderStatus: "PAID",
    orderTotal: 1200,
    paymentAmount: 1200,
    method: "CBE",
    enabledMethods: ["CBE"],
    hasCompletedPayment: true,
  });

  assert.equal(result.ok, false);
  assert.match(result.reason, /already|completed/i);
});

test("COMPLETED orders remain payable until payment is completed", () => {
  const result = validateServerPaymentConfirmation({
    orderStatus: "COMPLETED",
    orderTotal: 500,
    paymentAmount: 500,
    method: "CASH",
    enabledMethods: ["CASH"],
    cashReceived: 500,
    hasCompletedPayment: false,
  });

  assert.equal(result.ok, true);
});

test("disabled payment method cannot be used", () => {
  const result = validateServerPaymentConfirmation({
    orderStatus: "NEW",
    orderTotal: 600,
    paymentAmount: 600,
    method: "CBE",
    enabledMethods: ["CASH", "TELEBIRR"],
    hasCompletedPayment: false,
  });

  assert.equal(result.ok, false);
  assert.match(result.reason, /enabled|disabled/i);
});

test("TELEBIRR amount must match order amount", () => {
  const result = validateServerPaymentConfirmation({
    orderStatus: "NEW",
    orderTotal: 1200,
    paymentAmount: 1300,
    method: "TELEBIRR",
    enabledMethods: ["TELEBIRR"],
    hasCompletedPayment: false,
  });

  assert.equal(result.ok, false);
  assert.match(result.reason, /match|amount/i);
});

test("CBE amount must match order amount", () => {
  const result = validateServerPaymentConfirmation({
    orderStatus: "NEW",
    orderTotal: 600,
    paymentAmount: 500,
    method: "CBE",
    enabledMethods: ["CBE"],
    hasCompletedPayment: false,
  });

  assert.equal(result.ok, false);
  assert.match(result.reason, /match|amount/i);
});

test("CASH received amount must be sufficient", () => {
  const result = validateServerPaymentConfirmation({
    orderStatus: "NEW",
    orderTotal: 850,
    paymentAmount: 850,
    method: "CASH",
    enabledMethods: ["CASH"],
    cashReceived: 700,
    hasCompletedPayment: false,
  });

  assert.equal(result.ok, false);
  assert.match(result.reason, /cash|sufficient|received/i);
});

test("change is calculated correctly", () => {
  assert.equal(calculateCashChange(2000, 1750), 250);
  assert.equal(calculateCashChange(850, 850), 0);
});

test("PAID payment contributes to revenue", () => {
  assert.equal(paymentContributesToRevenue({ status: "COMPLETED", method: "CASH", amount: 850 }), true);
  assert.equal(paymentContributesToRevenue({ status: "COMPLETED", method: "TELEBIRR", amount: 1200 }), true);
});

test("FAILED/CANCELLED/PENDING payments do not contribute to revenue", () => {
  assert.equal(paymentContributesToRevenue({ status: "FAILED", amount: 100 }), false);
  assert.equal(paymentContributesToRevenue({ status: "PENDING", amount: 50 }), false);
  assert.equal(paymentContributesToRevenue({ status: "CANCELLED", amount: 75 }), false);
});

test("admin approval remains available only as an exception flow", () => {
  const result = canVerifyPendingPayment({ status: "PENDING", amount: 100 });
  assert.equal(result, true);
  const decision = nextPaymentDecision("declined");
  assert.equal(decision, "FAILED");
  assert.equal(nextPaymentDecision("COMPLETED"), "COMPLETED");
  assert.equal(nextPaymentDecision("APPROVED"), null);
  assert.equal(nextPaymentDecision(""), null);
});

test("existing functionality remains intact", () => {
  assert.equal(isPaymentMethodEnabled("CASH", ["CASH", "TELEBIRR"]), true);
  assert.equal(isPaymentMethodEnabled("CBE", ["CASH", "TELEBIRR"]), false);
  assert.equal(calculateCashChange(1500, 1200), 300);
});
