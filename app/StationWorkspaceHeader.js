"use client";

import Link from "next/link";
import { useLanguage } from "./i18n/LanguageProvider";

export default function StationWorkspaceHeader({ station, inventoryTab, showInventoryTab = true }) {
  const { t } = useLanguage();
  const isKitchen = station === "KITCHEN";
  const stationName = isKitchen ? t("historyKitchenLabel") : t("historyBarLabel");
  const route = isKitchen ? "/kitchen" : "/bar";

  return (
    <header className="workspace-header kds-header">
      <div>
        <p className="eyebrow">{isKitchen ? t("kitchenWorkspaceTitle") : t("barWorkspaceTitle")}</p>
        <h1>{isKitchen ? t("kitchenOrdersTitle") : t("barOrdersTitle")}</h1>
      </div>
      <nav className="kds-subnav" aria-label={`${stationName} ${t("workspaceNavigation")}`}>
        <Link href={route} className={`kds-subnav-link${inventoryTab ? "" : " active"}`}>{t("orders")}</Link>
        {showInventoryTab && <Link href={`${route}?tab=inventory`} className={`kds-subnav-link${inventoryTab ? " active" : ""}`}>{t("workspaceInventoryLabel")}</Link>}
      </nav>
    </header>
  );
}