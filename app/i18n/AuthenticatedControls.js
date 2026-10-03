"use client";

import { usePathname } from "next/navigation";
import { useLanguage } from "./LanguageProvider";
import GlobalLanguageDrawer from "./GlobalLanguageDrawer";
import LocalizedLogout from "./LocalizedLogout";

const PUBLIC_PATHS = new Set(["/login", "/signup", "/staff-login"]);

export default function AuthenticatedControls({ role, loginOnly = false }) {
  const pathname = usePathname();
  const { t } = useLanguage();
  const isDashboard = pathname === "/";
  const isPublicPath = PUBLIC_PATHS.has(pathname);

  if (loginOnly && pathname !== "/login") return null;
  if (isDashboard && !role) return null;

  const roleLabel = role ? t(`role${role}`) : "";

  return (
    <div className={isDashboard ? "dashboard-authenticated-controls" : "authenticated-controls-bar"}>
      <div
        className="authenticated-controls"
        role="group"
        aria-label={roleLabel
          ? `${roleLabel} / ${t("language")} / ${t("logOut")}`
          : isPublicPath ? t("language") : `${t("language")} / ${t("logOut")}`}
      >
        {roleLabel && <span className="authenticated-role-chip">{roleLabel}</span>}
        <GlobalLanguageDrawer showLabel={isPublicPath} />
        {!isPublicPath && <LocalizedLogout />}
      </div>
    </div>
  );
}