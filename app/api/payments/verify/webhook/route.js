import { createClient } from "@supabase/supabase-js";
import {
  normalizeVerifyEtWebhookAmount,
  verifyVerifyEtWebhookSignature,
} from "@/lib/payments/verify-et-webhook.mjs";

function createWebhookDatabaseClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceRoleKey) throw new Error("Webhook database access is not configured.");

  return createClient(url, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}

function response(status, message) {
  return Response.json({ error: message }, { status });
}

export async function POST(request) {
  const rawBody = await request.text();
  const timestamp = request.headers.get("X-Webhook-Timestamp") || "";
  const signature = request.headers.get("X-Webhook-Signature") || "";
  const webhookSecret = process.env.VERIFY_ET_WEBHOOK_SECRET;

  if (!webhookSecret) return response(500, "Webhook verification is not configured.");
  if (!verifyVerifyEtWebhookSignature({ rawBody, timestamp, signature, secret: webhookSecret })) {
    return response(401, "Invalid webhook signature.");
  }
  if (request.headers.get("X-Webhook-Test") === "true") {
    return new Response(null, { status: 204 });
  }

  let event;
  try {
    event = JSON.parse(rawBody);
  } catch {
    return response(400, "Invalid webhook JSON.");
  }

  if (event?.event === "webhook.test") {
    return new Response(null, { status: 204 });
  }
  if (event?.event !== "verification.completed") return new Response(null, { status: 204 });

  const eventId = typeof event.id === "string" ? event.id.trim() : "";
  const requestId = typeof event.requestId === "string" ? event.requestId.trim() : "";
  const eventTimestamp = typeof event.timestamp === "string" ? event.timestamp : "";
  const data = event.data;
  const amount = normalizeVerifyEtWebhookAmount(data?.amount);
  const currency = typeof data?.currency === "string" ? data.currency.trim().toUpperCase() : "";
  const bank = typeof data?.bank === "string" ? data.bank.trim().toLowerCase() : "";
  const processingStatus = typeof data?.processingStatus === "string" ? data.processingStatus.trim().toLowerCase() : "";
  const status = typeof data?.status === "string" ? data.status.trim().toLowerCase() : "";
  const timestampMs = Date.parse(eventTimestamp);

  if (!eventId || !requestId || !Number.isFinite(timestampMs) || typeof data?.verified !== "boolean" || !amount || !currency || !bank) {
    return response(400, "Webhook is missing required verification fields.");
  }

  const referenceNumber = typeof data.referenceNumber === "string" ? data.referenceNumber.trim() : null;
  const transactionNumber = typeof data.transactionNumber === "string" ? data.transactionNumber.trim() : null;
  const receiptNumber = typeof data.receiptNumber === "string" ? data.receiptNumber.trim() : null;

  let supabase;
  try {
    supabase = createWebhookDatabaseClient();
  } catch {
    return response(503, "Webhook database access is unavailable.");
  }

  const { data: result, error } = await supabase.rpc("process_verify_et_webhook_event", {
    p_event_id: eventId,
    p_request_id: requestId,
    p_event_name: event.event,
    p_event_timestamp: eventTimestamp,
    p_processing_status: processingStatus,
    p_status: status,
    p_verified: data.verified,
    p_bank: bank,
    p_amount: amount,
    p_currency: currency,
    p_reference_number: referenceNumber,
    p_transaction_number: transactionNumber,
    p_receipt_number: receiptNumber,
  });

  if (error) {
    console.error("Verify.et webhook database operation failed", { eventId, requestId, code: error.code });
    return response(503, "Webhook processing is temporarily unavailable.");
  }

  if (!["processed", "duplicate", "ignored", "mismatch"].includes(result?.outcome)) {
    return response(503, "Webhook processing did not complete.");
  }

  if (result.outcome === "mismatch") {
    console.warn("Verify.et webhook did not match the pending payment", { eventId, requestId, reason: result.reason });
  }

  return new Response(null, { status: 204 });
}