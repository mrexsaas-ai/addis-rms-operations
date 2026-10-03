"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { getSupabaseBrowserClient } from "@/lib/supabase/browser";
import { useLanguage } from "../i18n/LanguageProvider";

function formatMessage(template, values) {
  return Object.entries(values).reduce(
    (message, [key, value]) => message.replaceAll(`{${key}}`, String(value)),
    template,
  );
}

function resultMessage(request, t) {
  const key = request.status === "APPROVED"
    ? "stockRequestResultApproved"
    : "stockRequestResultRejected";
  return formatMessage(t(key), {
    item: request.requested_item_name,
    quantity: Number(request.quantity || 0).toLocaleString(undefined, { maximumFractionDigits: 3 }),
    unit: request.unit,
  });
}

export default function StockRequestResults({ requests = [], restaurantId, userId }) {
  const router = useRouter();
  const { t } = useLanguage();
  const [liveMessage, setLiveMessage] = useState("");
  const seenEvents = useRef(new Set());

  useEffect(() => {
    if (!restaurantId || !userId) return undefined;

    const client = getSupabaseBrowserClient();
    const channel = client
      .channel(`stock-request-results-${restaurantId}-${userId}`)
      .on("postgres_changes", {
        event: "UPDATE",
        schema: "public",
        table: "stock_requests",
        filter: `restaurant_id=eq.${restaurantId}`,
      }, (payload) => {
        const request = payload.new;
        const previousRequest = payload.old;
        if (
          !request
          || request.requested_by_user_id !== userId
          || (previousRequest?.requested_by_user_id && previousRequest.requested_by_user_id !== userId)
          || !["APPROVED", "REJECTED"].includes(request.status)
          || previousRequest?.status === request.status
        ) return;

        const eventKey = `${request.id}:${request.status}`;
        if (seenEvents.current.has(eventKey)) return;
        seenEvents.current.add(eventKey);

        const message = resultMessage(request, t);
        const note = request.note ? ` ${formatMessage(t("stockRequestResultNote"), { note: request.note })}` : "";
        setLiveMessage(`${message}${note}`);
        router.refresh();
      })
      .subscribe();

    return () => {
      client.removeChannel(channel);
    };
  }, [restaurantId, router, t, userId]);

  if (!requests.length && !liveMessage) return null;

  return (
    <section className="stock-request-panel" aria-labelledby="stock-request-results-title">
      <div className="stock-request-heading">
        <div>
          <p className="stock-request-eyebrow">{t("workspaceInventoryLabel")}</p>
          <h2 id="stock-request-results-title">{t("stockRequestResultsTitle")}</h2>
        </div>
      </div>
      {liveMessage && <p className="live-alert" role="status">{liveMessage}</p>}
      <div>
        {requests.map((request) => (
          <article className="stock-request-success" key={request.id}>
            <strong>{resultMessage(request, t)}</strong>
            {request.note && <span>{formatMessage(t("stockRequestResultNote"), { note: request.note })}</span>}
          </article>
        ))}
      </div>
    </section>
  );
}