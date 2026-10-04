"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { getSupabaseBrowserClient } from "@/lib/supabase/browser";
import { useLanguage } from "./i18n/LanguageProvider";

async function playAlertTone() {
  try {
    const AudioCtor = window.AudioContext || window.webkitAudioContext;
    if (!AudioCtor) return false;

    const context = new AudioCtor();
    if (typeof context.resume === "function") await context.resume();

    const oscillator = context.createOscillator();
    const gain = context.createGain();
    oscillator.type = "triangle";
    oscillator.frequency.value = 740;
    gain.gain.value = 0.08;
    oscillator.connect(gain);
    gain.connect(context.destination);
    oscillator.start();
    oscillator.stop(context.currentTime + 0.18);
    oscillator.addEventListener("ended", () => context.close().catch(() => undefined), { once: true });
    return true;
  } catch {
    return false;
  }
}

export default function WorkspaceLiveAlerts({ restaurantId, station }) {
  const router = useRouter();
  const { t } = useLanguage();
  const [message, setMessage] = useState("");
  const seenEvents = useRef(new Set());
  const stationLabel = station === "KITCHEN" ? t("historyKitchenLabel") : t("historyBarLabel");

  useEffect(() => {
    if (!restaurantId || !station) {
      return undefined;
    }

    const client = getSupabaseBrowserClient();
    const channel = client
      .channel(`${station.toLowerCase()}-orders-${restaurantId}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "kitchen_orders",
          filter: `restaurant_id=eq.${restaurantId}`,
        },
        (payload) => {
          const newOrder = payload.new;
          if (!newOrder || newOrder.station !== station) return;

          router.refresh();

          const dedupeKey = `insert:${newOrder.id}`;
          if (seenEvents.current.has(dedupeKey)) return;

          seenEvents.current.add(dedupeKey);
          setMessage(t("newStationOrderReceived").replace("{station}", stationLabel));
          playAlertTone();
        }
      )
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "kitchen_orders",
          filter: `restaurant_id=eq.${restaurantId}`,
        },
        (payload) => {
          const nextOrder = payload.new;
          const previousOrder = payload.old;
          if (!nextOrder || nextOrder.station !== station) return;
          if (previousOrder && previousOrder.status === nextOrder.status) return;

          router.refresh();

          const isNewOrder = nextOrder.status === "NEW" && (!previousOrder || previousOrder.status !== "NEW");
          if (!isNewOrder) return;

          const dedupeKey = `update:${nextOrder.id}:${nextOrder.status}`;
          if (seenEvents.current.has(dedupeKey)) return;

          seenEvents.current.add(dedupeKey);
          setMessage(t("newStationOrderReceived").replace("{station}", stationLabel));
          playAlertTone();
        }
      )
      .subscribe();

    return () => {
      client.removeChannel(channel);
    };
  }, [restaurantId, router, station, stationLabel, t]);

  if (!message) return null;
  return <div className="live-alert" role="status">{message}</div>;
}