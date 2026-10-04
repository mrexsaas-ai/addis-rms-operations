import test from "node:test";
import assert from "node:assert/strict";
import { createHmac } from "node:crypto";

import {
  normalizeVerifyEtWebhookAmount,
  verifyVerifyEtWebhookSignature,
} from "./verify-et-webhook.mjs";

function signatureFor(rawBody, timestamp, secret) {
  const digest = createHmac("sha256", secret).update(`${timestamp}.${rawBody}`).digest("hex");
  return `sha256=${digest}`;
}

test("accepts a valid Verify.et signature within the timestamp tolerance", () => {
  const timestamp = "2026-10-02T12:00:00.000Z";
  const rawBody = '{"id":"event-1"}';
  const secret = "webhook-secret";

  assert.equal(verifyVerifyEtWebhookSignature({
    rawBody,
    timestamp,
    signature: signatureFor(rawBody, timestamp, secret),
    secret,
    now: Date.parse(timestamp) + 1000,
  }), true);
});

test("accepts any valid comma-separated rotation signature", () => {
  const timestamp = "2026-10-02T12:00:00.000Z";
  const rawBody = '{"id":"event-2"}';
  const currentSignature = signatureFor(rawBody, timestamp, "current-secret");
  const previousSignature = signatureFor(rawBody, timestamp, "previous-secret");

  assert.equal(verifyVerifyEtWebhookSignature({
    rawBody,
    timestamp,
    signature: `sha256=${"0".repeat(64)}, ${previousSignature}`,
    secret: "previous-secret",
    now: Date.parse(timestamp),
  }), true);
  assert.equal(currentSignature.startsWith("sha256="), true);
});

test("rejects changed bodies, malformed signatures, and stale timestamps", () => {
  const timestamp = "2026-10-02T12:00:00.000Z";
  const rawBody = '{"id":"event-3"}';
  const signature = signatureFor(rawBody, timestamp, "webhook-secret");

  assert.equal(verifyVerifyEtWebhookSignature({
    rawBody: `${rawBody} `,
    timestamp,
    signature,
    secret: "webhook-secret",
    now: Date.parse(timestamp),
  }), false);
  assert.equal(verifyVerifyEtWebhookSignature({
    rawBody,
    timestamp,
    signature: "sha256=not-a-digest",
    secret: "webhook-secret",
    now: Date.parse(timestamp),
  }), false);
  assert.equal(verifyVerifyEtWebhookSignature({
    rawBody,
    timestamp,
    signature,
    secret: "webhook-secret",
    now: Date.parse(timestamp) + 5 * 60 * 1000 + 1,
  }), false);
});

test("normalizes documented numeric and string ETB amounts without floating-point conversion", () => {
  assert.equal(normalizeVerifyEtWebhookAmount("1500.50"), "1500.50");
  assert.equal(normalizeVerifyEtWebhookAmount(350), "350");
  assert.equal(normalizeVerifyEtWebhookAmount("12.345"), null);
  assert.equal(normalizeVerifyEtWebhookAmount("1e3"), null);
  assert.equal(normalizeVerifyEtWebhookAmount("0"), null);
});