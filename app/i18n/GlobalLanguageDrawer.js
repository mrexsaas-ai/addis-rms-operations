"use client";

import { useState } from "react";
import { useLanguage } from "./LanguageProvider";

export default function GlobalLanguageDrawer({ showLabel = false }) {
  const { language, setLanguage, languages, t } = useLanguage();
  const [open, setOpen] = useState(false);
  const selected = languages.find((entry) => entry.code === language) || languages[0];

  return (
    <>
      <button
        className="global-language-trigger"
        type="button"
        onClick={() => setOpen(true)}
        aria-label={t("openLanguage")}
        title={t("language")}
      >
        <span aria-hidden="true">文</span>
        {showLabel && <span className="authenticated-language-label">{t("language")}</span>}
        <span className={showLabel ? "authenticated-language-current" : undefined}>
          {selected.nativeLabel}
          {showLabel && <span aria-hidden="true">⌄</span>}
        </span>
      </button>

      {open ? (
        <div className="global-language-backdrop" role="presentation" onClick={() => setOpen(false)}>
          <aside
            className="global-language-drawer"
            role="dialog"
            aria-modal="true"
            aria-label={t("chooseLanguage")}
            onClick={(event) => event.stopPropagation()}
          >
            <div className="global-language-heading">
              <div>
                <p className="global-language-eyebrow">{t("language")}</p>
                <h2>{t("chooseLanguage")}</h2>
              </div>
              <button type="button" className="global-language-close" onClick={() => setOpen(false)}>
                {t("close")}
              </button>
            </div>

            <div className="global-language-options">
              {languages.map((entry) => (
                <button
                  type="button"
                  key={entry.code}
                  className={`global-language-option ${entry.code === language ? "selected" : ""}`}
                  onClick={() => {
                    setLanguage(entry.code);
                    setOpen(false);
                  }}
                >
                  <span>
                    <strong>{entry.nativeLabel}</strong>
                    <small>{entry.label}</small>
                  </span>
                  <span className="global-language-check" aria-hidden="true">
                    {entry.code === language ? "✓" : ""}
                  </span>
                </button>
              ))}
            </div>
            <p className="global-language-note">{t("languageSaved")}</p>
          </aside>
        </div>
      ) : null}
    </>
  );
}
