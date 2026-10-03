"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { getSupabaseBrowserClient } from "@/lib/supabase/browser";

export default function MenuItemsLiveRefresh({ restaurantId }) {
  const router = useRouter();

  useEffect(() => {
    if (!restaurantId) return undefined;

    const client = getSupabaseBrowserClient();
    const channel = client
      .channel(`menu-items-${restaurantId}`)
      .on("postgres_changes", {
        event: "INSERT",
        schema: "public",
        table: "menu_items",
        filter: `restaurant_id=eq.${restaurantId}`,
      }, () => router.refresh())
      .on("postgres_changes", {
        event: "UPDATE",
        schema: "public",
        table: "menu_items",
        filter: `restaurant_id=eq.${restaurantId}`,
      }, () => router.refresh())
      .subscribe();

    return () => {
      client.removeChannel(channel);
    };
  }, [restaurantId, router]);

  return null;
}