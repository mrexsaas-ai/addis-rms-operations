"use client";

import { useState } from "react";
import { useLanguage } from "./LanguageProvider";
import { getSupabaseBrowserClient } from "@/lib/supabase/browser";
import { useRouter } from "next/navigation";

export default function LocalizedLogout() {
  const { t } = useLanguage();
  const router = useRouter();
  const [isSigningOut, setIsSigningOut] = useState(false);
  const [error, setError] = useState(false);

  async function handleSubmit(event) {
    event.preventDefault();
    if (isSigningOut) return;

    setIsSigningOut(true);
    setError(false);

    try {
      const supabase = getSupabaseBrowserClient();
      const { data: { session }, error: sessionError } = await supabase.auth.getSession();
      if (sessionError) throw sessionError;

      if (session) {
        const { error: signOutError } = await supabase.auth.signOut();
        if (signOutError) throw signOutError;
      }

      router.replace("/login");
      router.refresh();
    } catch {
      setError(true);
      setIsSigningOut(false);
    }
  }

  return (
    <form className="global-logout" onSubmit={handleSubmit}>
      <button type="submit" disabled={isSigningOut} aria-busy={isSigningOut}>
        {isSigningOut ? t("loggingOut") : t("logOut")}
      </button>
      {error && <small className="logout-error" role="alert">{t("logoutError")}</small>}
    </form>
  );
}
