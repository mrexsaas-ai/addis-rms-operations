"use server";

import { createHash } from "node:crypto";
import { revalidatePath } from "next/cache";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { SERVICE_ROLES, getAuthContext } from "@/lib/auth";
import {
  canVerifyPendingPayment,
  nextPaymentDecision,
  normalizePaymentMethod,
  validateServerPaymentConfirmation,
  calculateCashChange,
  isPaymentMethodEnabled,
} from "@/lib/payments/payment-status.mjs";
import {
  buildVerifyEtRequest,
  providerForPaymentAccount,
} from "@/lib/payments/verify-et-provider.mjs";

const ACTIVE_PAYMENT_EXISTS_MESSAGE = "An active payment already exists for this order.";

export async function createOrder(formData) {
  const supabase = await createSupabaseServerClient();
  const { user, membership } = await getAuthContext(supabase);

  if (!user) throw new Error("You must be signed in.");
  if (!membership || !SERVICE_ROLES.includes(membership.role)) {
    throw new Error("You do not have permission to create orders.");
  }

  const menuItemId = String(formData.get("menu_item_id") || "");
  const quantity = Number(formData.get("quantity"));
  const tableId = String(formData.get("table_id") || "") || null;
  const notes = String(formData.get("notes") || "").trim() || null;

  if (!menuItemId || !Number.isInteger(quantity) || quantity < 1) {
    throw new Error("Choose a menu item and a positive quantity.");
  }

  const orderType = tableId ? "DINE_IN" : "TAKEAWAY";
  const { data: result, error } = await supabase.rpc("create_order_atomic", {
    p_order_type: orderType,
    p_order_number_prefix: "ORD",
    p_creation_flow: "ORDERS_PAGE",
    p_table_id: tableId || null,
    p_notes: notes,
    p_item_notes: notes,
    p_items: [{ id: menuItemId, quantity }],
  });
  if (error) {
    if (error.message === "One or more menu items are unavailable in this restaurant.") {
      throw new Error("That menu item is not available.");
    }
    throw error;
  }

  revalidatePath("/");
  revalidatePath("/orders");
  revalidatePath("/server");
  revalidatePath("/kitchen");
  revalidatePath("/bar");
  return { orderId: result.order_id, orderNumber: result.order_number, orderTotal: Number(result.order_total || 0) };
}

export async function recordPayment(formData) {
  const supabase = await createSupabaseServerClient();
  const { user, membership } = await getAuthContext(supabase);

  if (!user) throw new Error("You must be signed in.");
  if (!membership || !SERVICE_ROLES.includes(membership.role)) {
    throw new Error("You do not have permission to record payments.");
  }

  const orderId = String(formData.get("order_id") || "");
  const amount = Number(formData.get("amount"));
  const cashReceivedValue = formData.get("cash_received");
  const cashReceived = Number(cashReceivedValue == null || cashReceivedValue === "" ? amount : cashReceivedValue);
  const method = normalizePaymentMethod(String(formData.get("method") || ""));
  const referenceNumber = String(formData.get("reference_number") || "").trim() || null;

  if (!orderId || !Number.isFinite(amount) || amount <= 0 || !["CASH", "TELEBIRR", "BANK_TRANSFER"].includes(method)) {
    throw new Error("Enter a valid amount and payment method.");
  }

  const { data: settings, error: settingsError } = await supabase
    .from("restaurant_settings")
    .select("enabled_payment_methods")
    .eq("restaurant_id", membership.restaurant_id)
    .maybeSingle();

  if (settingsError) throw settingsError;
  const enabledMethods = Array.isArray(settings?.enabled_payment_methods) ? settings.enabled_payment_methods : ["CASH"];
  if (!isPaymentMethodEnabled(method, enabledMethods)) {
    throw new Error("This payment method is not enabled for this restaurant.");
  }

  const { data: order, error: orderError } = await supabase
    .from("orders")
    .select("id, restaurant_id, total, status, table_id")
    .eq("id", orderId)
    .eq("restaurant_id", membership.restaurant_id)
    .maybeSingle();

  if (orderError) throw orderError;
  if (!order) throw new Error("Order not found.");
  if (order.status === "CANCELLED") throw new Error("Cancelled orders cannot be paid.");

  const validation = validateServerPaymentConfirmation({
    orderStatus: order.status,
    orderTotal: order.total,
    paymentAmount: amount,
    method,
    enabledMethods,
    cashReceived,
    currentRestaurantId: membership.restaurant_id,
    orderRestaurantId: order.restaurant_id,
    hasCompletedPayment: false,
  });

  if (!validation.ok) {
    throw new Error(validation.reason);
  }

  if (method !== "CASH" && !referenceNumber) {
    throw new Error("A transaction reference is required for this payment method.");
  }

  const { data: paymentId, error: paymentError } = await supabase.rpc("record_completed_payment", {
    p_order_id: order.id,
    p_amount: amount,
    p_method: method,
    p_reference_number: referenceNumber,
    p_cash_received: method === "CASH" ? cashReceived : null,
  });
  if (paymentError) throw new Error(paymentError.message);

  revalidatePath("/");
  revalidatePath("/orders");
  revalidatePath("/server");
  revalidatePath("/history");
  revalidatePath(`/receipts/${order.id}`);
  return { orderId: order.id, paymentId, paid: true };
}

function formatPendingPaymentError(error) {
  if (error?.message === ACTIVE_PAYMENT_EXISTS_MESSAGE) return ACTIVE_PAYMENT_EXISTS_MESSAGE;
  const safeText = (value) => String(value || "")
    .replace(/\b(password|passwd|token|secret|api[_ -]?key|authorization)\b\s*[:=]\s*["']?[^,\s;"'}]+["']?/gi, "$1=[redacted]")
    .replace(/\bBearer\s+\S+/gi, "Bearer [redacted]")
    .replace(/\beyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\b/g, "[redacted]");
  const message = safeText(error?.message);
  if (message) return `Payment failed: ${message}`;

  const fields = ["code", "details", "hint"]
    .map((field) => {
      const value = safeText(error?.[field]);
      return value ? `${field}: ${value}` : "";
    })
    .filter(Boolean);

  return `Payment failed: ${fields.join("; ") || "Unknown Supabase error."}`;
}

export async function createPendingPayment(formData) {
  const supabase = await createSupabaseServerClient();
  const { user, membership } = await getAuthContext(supabase);

  if (!user) throw new Error("You must be signed in.");
  if (!membership || !SERVICE_ROLES.includes(membership.role)) {
    throw new Error("You do not have permission to start payments.");
  }

  const orderId = String(formData.get("order_id") || "").trim();
  const method = normalizePaymentMethod(String(formData.get("method") || ""));
  const accountId = String(formData.get("account_id") || "").trim();
  const referenceNumber = String(formData.get("reference_number") || "").trim();
  if (!orderId || !["TELEBIRR", "BANK_TRANSFER"].includes(method)) {
    throw new Error("Enter a valid payment method.");
  }
  if (!referenceNumber) throw new Error("A transaction reference is required for this payment method.");

  const { data: settings, error: settingsError } = await supabase
    .from("restaurant_settings")
    .select("enabled_payment_methods")
    .eq("restaurant_id", membership.restaurant_id)
    .maybeSingle();
  if (settingsError) throw new Error(formatPendingPaymentError(settingsError));
  const enabledMethods = Array.isArray(settings?.enabled_payment_methods) ? settings.enabled_payment_methods : ["CASH"];
  if (!isPaymentMethodEnabled(method, enabledMethods)) {
    throw new Error("This payment method is not enabled for this restaurant.");
  }

  const { data: order, error: orderError } = await supabase
    .from("orders")
    .select("id, total, status")
    .eq("id", orderId)
    .eq("restaurant_id", membership.restaurant_id)
    .maybeSingle();
  if (orderError) throw new Error(formatPendingPaymentError(orderError));
  if (!order) throw new Error("Order not found.");
  if (order.status === "CANCELLED") throw new Error("Cancelled orders cannot be paid.");

  const accountType = method === "TELEBIRR" ? "TELEBIRR" : "BANK_TRANSFER";
  let paymentAccountQuery = supabase
    .from("payment_accounts")
    .select("id, type, name, account_number, verify_et_provider")
    .eq("restaurant_id", membership.restaurant_id)
    .eq("type", accountType)
    .eq("is_active", true);
  if (accountId) paymentAccountQuery = paymentAccountQuery.eq("id", accountId);
  const { data: paymentAccount, error: paymentAccountError } = await paymentAccountQuery.maybeSingle();
  if (paymentAccountError) throw new Error(formatPendingPaymentError(paymentAccountError));
  if (!paymentAccount || !String(paymentAccount.account_number || "").trim() || paymentAccount.type !== accountType) {
    throw new Error("No active payment account is configured for this method.");
  }
  const selectedProvider = providerForPaymentAccount(paymentAccount);
  const verifyEtApiKey = process.env.VERIFY_ET_API_KEY?.trim();

  const { data: completedPayment, error: completedPaymentError } = await supabase
    .from("payments")
    .select("id")
    .eq("restaurant_id", membership.restaurant_id)
    .eq("order_id", order.id)
    .eq("status", "COMPLETED")
    .maybeSingle();
  if (completedPaymentError) throw new Error(formatPendingPaymentError(completedPaymentError));
  if (completedPayment) throw new Error("This order has already been paid.");

  const { data: existingPending, error: existingPendingError } = await supabase
    .from("payments")
    .select("id, amount, method, reference_number, verify_et_request_id, verify_et_provider")
    .eq("restaurant_id", membership.restaurant_id)
    .eq("order_id", order.id)
    .eq("status", "PENDING")
    .maybeSingle();
  if (existingPendingError) throw new Error(formatPendingPaymentError(existingPendingError));
  if (existingPending && existingPending.method !== method) {
    throw new Error(ACTIVE_PAYMENT_EXISTS_MESSAGE);
  }
  if (existingPending?.verify_et_request_id) {
    if (existingPending.reference_number !== referenceNumber) {
      throw new Error("A Verify.et request already exists for a different transaction reference.");
    }
    return {
      paymentId: existingPending.id,
      amount: Number(existingPending.amount || order.total || 0),
      existing: true,
      requestId: existingPending.verify_et_request_id,
      status: "PENDING",
    };
  }

  const providerForRequest = existingPending ? existingPending.verify_et_provider : selectedProvider;
  if (providerForRequest && !verifyEtApiKey) {
    throw new Error("Verify.et is not configured on the server.");
  }

  let paymentId = existingPending?.id;
  let paymentAmount = Number(existingPending?.amount ?? order.total ?? 0);
  let verifyEtProvider = existingPending?.verify_et_provider || null;
  let existing = Boolean(existingPending);
  if (!paymentId) {
    const { data: payment, error: paymentError } = await supabase.rpc("create_pending_payment", {
      p_order_id: order.id,
      p_method: method,
      p_account_id: accountId || null,
    });
    if (paymentError?.code === "23505") throw new Error(ACTIVE_PAYMENT_EXISTS_MESSAGE);
    if (paymentError) throw new Error(formatPendingPaymentError(paymentError));
    paymentId = payment.payment_id;
    paymentAmount = Number(payment.amount || 0);
    verifyEtProvider = payment.verify_et_provider || null;
    existing = payment.created === false;
  }

  if (existingPending && verifyEtProvider && selectedProvider !== verifyEtProvider) {
    throw new Error("The selected payment account does not match the provider stored for this pending payment.");
  }
  if (!existingPending && verifyEtProvider !== selectedProvider) {
    throw new Error("The selected payment account provider could not be verified.");
  }

  const { error: trackingError } = await supabase.rpc("set_pending_payment_verify_tracking", {
    p_payment_id: paymentId,
    p_reference_number: referenceNumber,
  });
  if (trackingError) throw new Error(formatPendingPaymentError(trackingError));

  revalidatePath("/server");
  revalidatePath("/orders");
  revalidatePath("/history");
  revalidatePath(`/receipts/${order.id}`);

  const verifyRequest = buildVerifyEtRequest({
    providerCode: verifyEtProvider,
    reference: referenceNumber,
    settlementAccount: String(paymentAccount.account_number).trim(),
  });
  if (!verifyRequest) {
    return {
      paymentId,
      amount: paymentAmount,
      existing,
      requestId: null,
      status: "PENDING",
      manualVerificationOnly: true,
    };
  }
  if (!verifyEtApiKey) throw new Error("Verify.et is not configured on the server.");

  const idempotencyKey = createHash("sha256")
    .update(`${paymentId}:${JSON.stringify(verifyRequest)}`)
    .digest("hex");
  let verifyResponse;
  try {
    verifyResponse = await fetch("https://verify.et/api/verify", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": verifyEtApiKey,
        "Idempotency-Key": idempotencyKey,
      },
      body: JSON.stringify(verifyRequest),
      cache: "no-store",
    });
  } catch {
    throw new Error("Unable to reach Verify.et. The payment remains pending and can be retried.");
  }

  let verifyResult;
  try {
    verifyResult = await verifyResponse.json();
  } catch {
    verifyResult = null;
  }
  if (![200, 202].includes(verifyResponse.status) || verifyResult?.success !== true) {
    throw new Error(`Verify.et rejected the request (HTTP ${verifyResponse.status}). The payment remains pending.`);
  }

  const requestId = String(verifyResult.requestId || verifyResult.verification?.requestId || "").trim();
  if (!requestId) {
    throw new Error("Verify.et accepted the request without returning a requestId. The payment remains pending; retry to retrieve the request status.");
  }

  const { error: requestIdError } = await supabase.rpc("set_pending_payment_verify_tracking", {
    p_payment_id: paymentId,
    p_reference_number: referenceNumber,
    p_verify_et_request_id: requestId,
  });
  if (requestIdError) {
    throw new Error("Verify.et accepted the request, but ADDIS RMS could not save its request ID. The payment remains pending; retry the same reference.");
  }

  return {
    paymentId,
    amount: paymentAmount,
    existing,
    requestId,
    status: "PENDING",
  };
}

export async function resolvePendingPayment(formData) {
  const supabase = await createSupabaseServerClient();
  const { user, membership } = await getAuthContext(supabase);

  if (!user) throw new Error("You must be signed in.");
  if (!membership || !SERVICE_ROLES.includes(membership.role)) {
    throw new Error("You do not have permission to complete payments.");
  }

  const paymentId = String(formData.get("payment_id") || "").trim();
  const decision = nextPaymentDecision(String(formData.get("decision") || ""));
  const note = String(formData.get("note") || "").trim();

  if (!paymentId) throw new Error("Payment record is missing.");
  if (!decision) throw new Error("Choose a valid payment decision.");

  const { data: payment, error: paymentError } = await supabase
    .from("payments")
    .select("id, restaurant_id, order_id, amount, method, status, reference_number, orders(id, total, status, table_id)")
    .eq("id", paymentId)
    .eq("restaurant_id", membership.restaurant_id)
    .maybeSingle();

  if (paymentError) throw paymentError;
  if (!payment) throw new Error("Payment record was not found.");
  if (!canVerifyPendingPayment(payment)) throw new Error("This payment is not pending verification.");
  if (!payment.orders) throw new Error("The payment is missing its order record.");
  if (decision === "COMPLETED" && payment.method !== "CASH" && !note) {
    throw new Error("A transaction reference is required for this payment method.");
  }

  const { data: result, error: resolveError } = await supabase.rpc("resolve_pending_payment", {
    p_payment_id: payment.id,
    p_decision: decision,
    p_note: note || null,
  });
  if (resolveError) throw new Error(resolveError.message);

  revalidatePath("/");
  revalidatePath("/orders");
  revalidatePath("/server");
  revalidatePath("/history");
  revalidatePath(`/receipts/${payment.order_id}`);

  return result;
}