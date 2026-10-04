"use client";

import Link from "next/link";
import { useLanguage } from "../i18n/LanguageProvider";

const roleKeys = {
  ADMIN: "roleADMIN",
  OWNER: "roleOWNER",
  MANAGER: "roleMANAGER",
  SERVER: "roleSERVER",
  CHEF: "roleCHEF",
  BARMAN: "roleBARMAN",
};

export default function MenuHeader({ restaurantName, role, canManage }) {
  const { t } = useLanguage();
  const roleLabel = t(roleKeys[role] || role);

  return (
    <header className="menu-topbar">
      <div>
        <span className="brand-mark">ADDIS RMS</span>
        <p className="eyebrow" style={{ marginTop: 22 }}>{t("menuManagement")}</p>
        <h1>{restaurantName || t("restaurant")}</h1>
        <p className="subtle">
          {roleLabel} {t("access")} · {t("foodDrinkCatalog")}
        </p>
      </div>

      <div className="menu-actions">
        {canManage && <a className="menu-cta" href="#menu-item-form">{t("addMenuItem")}</a>}
        <Link href="/" className="back-link">← {t("overview")}</Link>
      </div>
    </header>
  );
}
