import test from "node:test";
import assert from "node:assert/strict";

import {
  buildVerifyEtRequest,
  providerForPaymentAccount,
  verifyEtProviderMatch,
} from "./verify-et-provider.mjs";

test("a documented Telebirr account stores and submits the Telebirr provider explicitly", () => {
  assert.equal(providerForPaymentAccount({ type: "TELEBIRR", providerCode: "telebirr" }), "telebirr");
  assert.equal(providerForPaymentAccount({ type: "TELEBIRR", verify_et_provider: "telebirr" }), "telebirr");
  assert.deepEqual(buildVerifyEtRequest({
    providerCode: "telebirr",
    reference: "TX-123",
    settlementAccount: "0911000000",
  }), {
    bank: "telebirr",
    transactionNumber: "TX-123",
    settlementAccount: "0911000000",
  });
  assert.deepEqual(verifyEtProviderMatch({
    method: "TELEBIRR",
    expectedProvider: "telebirr",
    callbackBank: "telebirr",
  }), { matches: true, reason: null, status: "PENDING" });
});

test("CBE and other supported banks match only their exact stored provider", () => {
  assert.equal(providerForPaymentAccount({ type: "BANK_TRANSFER", providerCode: "cbe" }), "cbe");
  assert.equal(providerForPaymentAccount({ type: "BANK_TRANSFER", verify_et_provider: "cbe" }), "cbe");
  assert.deepEqual(buildVerifyEtRequest({ providerCode: "cbe", reference: "CBE-RCPT" }), {
    bank: "cbe",
    reference: "CBE-RCPT",
  });
  assert.equal(verifyEtProviderMatch({
    method: "BANK_TRANSFER",
    expectedProvider: "cbe",
    callbackBank: "cbe",
  }).matches, true);
  assert.equal(verifyEtProviderMatch({
    method: "BANK_TRANSFER",
    expectedProvider: "boa",
    callbackBank: "dashen",
  }).reason, "provider_mismatch");
});

test("unsupported or missing provider identity stays pending and is not submitted", () => {
  assert.equal(providerForPaymentAccount({ type: "BANK_TRANSFER", providerCode: "" }), null);
  assert.equal(buildVerifyEtRequest({ providerCode: null, reference: "TX-123" }), null);
  assert.deepEqual(verifyEtProviderMatch({
    method: "BANK_TRANSFER",
    expectedProvider: null,
    callbackBank: "cbe",
  }), { matches: false, reason: "provider_identity_missing", status: "PENDING" });
});

test("Telebirr cannot be assigned to a bank-transfer account", () => {
  assert.equal(providerForPaymentAccount({ type: "BANK_TRANSFER", providerCode: "telebirr" }), null);
  assert.equal(verifyEtProviderMatch({
    method: "BANK_TRANSFER",
    expectedProvider: "telebirr",
    callbackBank: "telebirr",
  }).reason, "provider_method_mismatch");
});