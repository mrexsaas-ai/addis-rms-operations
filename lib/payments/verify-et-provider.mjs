export const VERIFY_ET_BANK_PROVIDERS = Object.freeze([
  "cbe",
  "boa",
  "dashen",
  "awash",
  "siinqee",
]);

export const VERIFY_ET_PROVIDERS = Object.freeze([
  "telebirr",
  ...VERIFY_ET_BANK_PROVIDERS,
]);

export function normalizeVerifyEtProvider(value) {
  const provider = String(value || "").trim().toLowerCase();
  return VERIFY_ET_PROVIDERS.includes(provider) ? provider : null;
}

export function providerForPaymentAccount({ type, providerCode, verify_et_provider }) {
  const accountType = String(type || "").trim().toUpperCase();
  const provider = normalizeVerifyEtProvider(providerCode ?? verify_et_provider);

  if (accountType === "TELEBIRR") return provider === "telebirr" ? provider : null;
  if (accountType === "BANK_TRANSFER" && provider !== "telebirr") return provider;
  return null;
}

export function verifyEtProviderMatch({ method, expectedProvider, callbackBank }) {
  const normalizedMethod = String(method || "").trim().toUpperCase();
  const expected = normalizeVerifyEtProvider(expectedProvider);
  const received = normalizeVerifyEtProvider(callbackBank);

  if (!expected) {
    return { matches: false, reason: "provider_identity_missing", status: "PENDING" };
  }
  if (!received || received !== expected) {
    return { matches: false, reason: "provider_mismatch", status: "PENDING" };
  }
  if (normalizedMethod === "TELEBIRR" && expected !== "telebirr") {
    return { matches: false, reason: "provider_method_mismatch", status: "PENDING" };
  }
  if (normalizedMethod === "BANK_TRANSFER" && !VERIFY_ET_BANK_PROVIDERS.includes(expected)) {
    return { matches: false, reason: "provider_method_mismatch", status: "PENDING" };
  }
  if (!["TELEBIRR", "BANK_TRANSFER"].includes(normalizedMethod)) {
    return { matches: false, reason: "unsupported_payment_method", status: "PENDING" };
  }

  return { matches: true, reason: null, status: "PENDING" };
}

export function buildVerifyEtRequest({ providerCode, reference, settlementAccount }) {
  const provider = normalizeVerifyEtProvider(providerCode);
  const transactionReference = String(reference || "").trim();
  if (!provider || !transactionReference) return null;

  const request = {
    bank: provider,
    ...(provider === "telebirr"
      ? { transactionNumber: transactionReference }
      : { reference: transactionReference }),
  };
  const receiverAccount = String(settlementAccount || "").trim();
  if (receiverAccount) request.settlementAccount = receiverAccount;
  return request;
}