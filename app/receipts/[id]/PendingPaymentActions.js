"use client";

import { resolvePendingPayment } from "@/app/orders/actions";
import { useLanguage } from "@/app/i18n/LanguageProvider";

export default function PendingPaymentActions({ payment }) {
  const { t } = useLanguage();

  return (
    <form action={resolvePendingPayment} style={{ display: "grid", gap: 8, marginTop: 8 }}>
      <input type="hidden" name="payment_id" value={payment.id} />
      <label>
        {t("transactionReference")}
        <input name="note" defaultValue={payment.reference_number || ""} required />
      </label>
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
        <button type="submit" name="decision" value="COMPLETED">{t("markAsPaid")}</button>
        <button type="submit" name="decision" value="FAILED" formNoValidate style={{ background: "#b91c1c", color: "white" }}>{t("rejectPayment")}</button>
      </div>
    </form>
  );
}
