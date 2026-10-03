import { createHmac, timingSafeEqual } from "node:crypto";

export const VERIFY_ET_WEBHOOK_TOLERANCE_MS = 5 * 60 * 1000;

export function verifyVerifyEtWebhookSignature({ rawBody, timestamp, signature, secret, now = Date.now() }) {
  if (!rawBody || !timestamp || !signature || !secret) return false;

  const timestampMs = Date.parse(timestamp);
  if (!Number.isFinite(timestampMs) || Math.abs(now - timestampMs) > VERIFY_ET_WEBHOOK_TOLERANCE_MS) {
    return false;
  }

  const expected = createHmac("sha256", secret)
    .update(`${timestamp}.${rawBody}`)
    .digest();

  return signature.split(",").some((candidate) => {
    const match = /^sha256=([a-f0-9]{64})$/i.exec(candidate.trim());
    if (!match) return false;

    const received = Buffer.from(match[1], "hex");
    return received.length === expected.length && timingSafeEqual(received, expected);
  });
}

export function normalizeVerifyEtWebhookAmount(value) {
  if (typeof value !== "string" && typeof value !== "number") return null;

  const amount = String(value).trim();
  if (!/^\d+(?:\.\d{1,2})?$/.test(amount) || !Number.isFinite(Number(amount)) || Number(amount) <= 0) {
    return null;
  }

  return amount;
}