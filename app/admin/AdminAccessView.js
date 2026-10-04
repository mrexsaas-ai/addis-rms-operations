"use client";

import Link from "next/link";
import { useLanguage } from "@/app/i18n/LanguageProvider";

export default function AdminAccessView({ restaurantName = "", restricted = false }) {
  const { t } = useLanguage();

  return (
    <main className="admin-access-page">
      <header className="admin-access-header">
        <div className="admin-access-brand">
          <span className="brand-mark">ADDIS RMS</span>
          <span className="brand-tagline">{t("landingSlogan")}</span>
        </div>
        <span className="admin-access-indicator" aria-hidden="true" />
      </header>

      <div className="admin-access-main">
        <section className="admin-access-card" aria-labelledby="admin-access-title">
          <span className="admin-access-accent" aria-hidden="true" />
          {restricted ? (
            <>
              <p className="admin-access-eyebrow">{t("settingsAccessControl")}</p>
              <h1 id="admin-access-title">{t("settingsRestricted")}</h1>
              <p className="admin-access-description">{t("settingsAdminOwnerRequired")}</p>
            </>
          ) : (
            <>
              <p className="admin-access-eyebrow">{t("adminAreaLabel")}</p>
              <h1 id="admin-access-title">{restaurantName || t("settingsPageTitle")}</h1>
              <p className="admin-access-description">{t("adminAccessExplanation")}</p>
            </>
          )}
          <Link className="admin-access-return" href="/">
            <span aria-hidden="true">&larr;</span>
            {t("settingsReturnDashboard")}
          </Link>
        </section>
      </div>
    </main>
  );
}