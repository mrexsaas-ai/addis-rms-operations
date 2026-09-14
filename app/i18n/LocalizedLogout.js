"use client";

import { useLanguage } from "./LanguageProvider";
import { getSupabaseBrowserClient } from "@/lib/supabase/browser";
import { useRouter } from "next/navigation";

export default function LocalizedLogout() {
  const { t } = useLanguage();
  const router = useRouter();

  async function handleSubmit(event) {
    event.preventDefault();

    const { error } = await getSupabaseBrowserClient().auth.signOut();

    if (error) throw error;

    router.replace("/login");
  }

  return (
    <form className="global-logout" onSubmit={handleSubmit}>
      <button type="submit">{t("logOut")}</button>
    </form>
  );
}
