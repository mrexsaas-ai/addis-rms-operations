"use client";

import { useEffect, useRef, useState } from "react";
import { getSupabaseBrowserClient } from "@/lib/supabase/browser";

export default function WorkspaceLiveAlerts({ restaurantId, station }) {
  const [message, setMessage] = useState("");
  const seenOrderIds = useRef(new Set());

  useEffect(() => {
    const client = getSupabaseBrowserClient();
    const channel = client
      .channel(`${station.toLowerCase()}-orders-${restaurantId}`)
      .on("postgres_changes", {
        event: "INSERT",
        schema: "public",
        table: "kitchen_orders",
        filter: `restaurant_id=eq.${restaurantId}`,
      }, (payload) => {
        if (payload.new.station !== station) return;
        if (seenOrderIds.current.has(payload.new.id)) return;
        seenOrderIds.current.add(payload.new.id);
        setMessage(`New ${station.toLowerCase()} order received`);
        try {
          const context = new AudioContext();
          const oscillator = context.createOscillator();
          const gain = context.createGain();
          oscillator.connect(gain);
          gain.connect(context.destination);
          oscillator.frequency.value = 740;
          gain.gain.value = 0.08;
          oscillator.start();
          oscillator.stop(context.currentTime + 0.15);
        } catch {
          // Browser audio policies may require an earlier user gesture.
        }
      })
      .subscribe();

    return () => {
      client.removeChannel(channel);
    };
  }, [restaurantId, station]);

  if (!message) return null;
  return <div className="live-alert" role="status">{message}</div>;
}