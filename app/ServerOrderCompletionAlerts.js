"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { getSupabaseBrowserClient } from "@/lib/supabase/browser";
import { useLanguage } from "./i18n/LanguageProvider";

export default function ServerOrderCompletionAlerts({ restaurantId }) {
  const router = useRouter();
  const { t } = useLanguage();
  const [message, setMessage] = useState("");
  const seenEvents = useRef(new Set());

  useEffect(() => {
    if (!restaurantId) return undefined;

    const client = getSupabaseBrowserClient();
    const channel = client
      .channel(`server-order-completions-${restaurantId}`)
      .on("postgres_changes", {
        event: "UPDATE",
        schema: "public",
        table: "kitchen_orders",
        filter: `restaurant_id=eq.${restaurantId}`,
      }, (payload) => {
        const order = payload.new;
        const previousOrder = payload.old;
        if (
          !order
          || order.restaurant_id !== restaurantId
          || !["KITCHEN", "BAR"].includes(order.station)
          || order.status !== "COMPLETED"
          || !previousOrder
          || previousOrder.status === "COMPLETED"
        ) {
          return;
        }

        const dedupeKey = `completed:${order.id}`;
        if (seenEvents.current.has(dedupeKey)) return;

        seenEvents.current.add(dedupeKey);
        setMessage(t(order.station === "KITCHEN" ? "kitchenOrderCompleted" : "barOrderCompleted"));
        router.refresh();
      })
      .subscribe();

    return () => {
      client.removeChannel(channel);
    };
  }, [restaurantId, router, t]);

  if (!message) return null;
  return <div className="live-alert" role="status">{message}</div>;
}