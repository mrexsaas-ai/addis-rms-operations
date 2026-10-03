"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { getSupabaseBrowserClient } from "@/lib/supabase/browser";

export default function InventoryLiveAlerts({ restaurantId }) {
  const router = useRouter();
  const [message, setMessage] = useState("");
  const [soundEnabled, setSoundEnabled] = useState(false);
  const seenAlertIds = useRef(new Set());
  const audioContext = useRef(null);
  const soundEnabledRef = useRef(false);

  function playAlertSound() {
    if (!soundEnabledRef.current || typeof window === "undefined") return;

    try {
      const AudioContext = window.AudioContext || window.webkitAudioContext;
      if (!AudioContext) return;
      const context = audioContext.current || new AudioContext();
      audioContext.current = context;
      if (context.state === "suspended") return;
      const oscillator = context.createOscillator();
      const gain = context.createGain();
      oscillator.frequency.value = 740;
      oscillator.type = "sine";
      gain.gain.setValueAtTime(0.0001, context.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.08, context.currentTime + 0.01);
      gain.gain.exponentialRampToValueAtTime(0.0001, context.currentTime + 0.22);
      oscillator.connect(gain);
      gain.connect(context.destination);
      oscillator.start();
      oscillator.stop(context.currentTime + 0.24);
    } catch {
      // Browser audio may be unavailable or blocked.
    }
  }

  function enableSound() {
    if (typeof window === "undefined") return;
    try {
      const AudioContext = window.AudioContext || window.webkitAudioContext;
      if (!AudioContext) return;
      const context = audioContext.current || new AudioContext();
      audioContext.current = context;
      context.resume().catch(() => {});
      soundEnabledRef.current = true;
      setSoundEnabled(true);
    } catch {
      setSoundEnabled(false);
    }
  }

  useEffect(() => {
    if (!restaurantId) return undefined;

    const client = getSupabaseBrowserClient();
    const channel = client
      .channel(`inventory-alerts-${restaurantId}`)
      .on("postgres_changes", {
        event: "INSERT",
        schema: "public",
        table: "inventory_audit_logs",
        filter: `restaurant_id=eq.${restaurantId}`,
      }, async (payload) => {
        const alert = payload.new;
        if (!alert || seenAlertIds.current.has(alert.id)) return;
        seenAlertIds.current.add(alert.id);
        const { data: item } = await client
          .from("inventory_items")
          .select("name, unit")
          .eq("id", alert.item_id)
          .eq("restaurant_id", restaurantId)
          .maybeSingle();
        const itemLabel = item?.name || "Inventory item";
        const quantity = alert.new_quantity == null ? "" : ` ${alert.new_quantity} ${item?.unit || "units"}`;
        const prefix = alert.action === "LOW_STOCK_ALERT"
          ? "Low stock"
          : alert.action === "ADD_STOCK"
            ? "Stock added"
            : "Stock movement recorded";
        setMessage(`${prefix}: ${itemLabel}${quantity}${alert.note ? ` — ${alert.note}` : ""}`);
        router.refresh();
        playAlertSound();
      })
      .on("postgres_changes", {
        event: "INSERT",
        schema: "public",
        table: "stock_requests",
        filter: `restaurant_id=eq.${restaurantId}`,
      }, async (payload) => {
        const request = payload.new;
        if (!request || seenAlertIds.current.has(`request:${request.id}`)) return;
        seenAlertIds.current.add(`request:${request.id}`);
        const { data: item } = request.item_id
          ? await client
            .from("inventory_items")
            .select("name, station")
            .eq("id", request.item_id)
            .eq("restaurant_id", restaurantId)
            .maybeSingle()
          : { data: null };
        const station = item?.station || "STATION";
        setMessage(`Stock request: ${station} · ${item?.name || request.requested_item_name || "Inventory item"} · ${request.quantity} ${request.unit}${request.note ? ` — ${request.note}` : ""}`);
        router.refresh();
        playAlertSound();
      })
      .subscribe();

    return () => {
      client.removeChannel(channel);
    };
  }, [restaurantId, router]);

  return (
    <div className="inventory-alert-stack">
      <div className="inventory-alert-controls">
        <span>Live inventory alerts</span>
        <button type="button" className="secondary" onClick={enableSound} disabled={soundEnabled}>
          {soundEnabled ? "Notification sound enabled" : "Enable notification sound"}
        </button>
      </div>
      {message && <div className="live-alert" role="status">{message}</div>}
    </div>
  );
}
