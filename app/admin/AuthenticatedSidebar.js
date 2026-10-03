"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useLanguage } from "@/app/i18n/LanguageProvider";

export default function AuthenticatedSidebar({ role, canViewTables, canManageSettings }) {
  const { t } = useLanguage();
  const pathname = usePathname();

  const isActive = (href) => {
    if (href === "/") return pathname === "/";
    return pathname === href || pathname.startsWith(`${href}/`);
  };

  const linkClassName = (href) => `nav-link${isActive(href) ? " nav-link-active" : ""}`;

  return (
    <aside className="sidebar">
      <div className="sidebar-brand">
        <span className="brand-mark">ADDIS RMS</span>
        <span className="brand-tagline">{t("landingSlogan")}</span>
      </div>

      <nav aria-label={t("mainNavigation")}>
        <Link className={linkClassName("/")} href="/">{t("overview")}</Link>
        <Link className={linkClassName("/orders")} href="/orders">{t("orders")}</Link>
        {canViewTables && <Link className={linkClassName("/tables")} href="/tables">{t("tables")}</Link>}
        <Link className={linkClassName("/menu")} href="/menu">{t("menu")}</Link>
        <Link className={linkClassName("/inventory")} href="/inventory">{t("featureInventory")}</Link>
        <Link className={linkClassName("/staff")} href="/staff">{t("staff")}</Link>
        <Link className={linkClassName("/history")} href="/history">{t("history")}</Link>
        <Link className={linkClassName("/admin/settings")} href="/admin/settings">{t("settings")}</Link>
      </nav>

      <div className="sidebar-footer">
        <span className="status-dot" />
        {t("supabaseConnected")}
      </div>
    </aside>
  );
}
