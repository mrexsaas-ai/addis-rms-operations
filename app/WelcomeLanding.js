"use client";

import Link from "next/link";
import { Mail, Phone } from "lucide-react";
import { FaInstagram, FaTelegramPlane, FaTiktok } from "react-icons/fa";
import { useLanguage } from "./i18n/LanguageProvider";
import GlobalLanguageDrawer from "./i18n/GlobalLanguageDrawer";

const features = [
  ["01", "featureDashboard", "featureDashboardBody"],
  ["02", "featurePos", "featurePosBody"],
  ["03", "featureTables", "featureTablesBody"],
  ["04", "featureKitchen", "featureKitchenBody"],
  ["05", "featureInventory", "featureInventoryBody"],
  ["06", "featureStaff", "featureStaffBody"],
  ["07", "featurePayments", "featurePaymentsBody"],
  ["08", "featureReports", "featureReportsBody"],
];

const benefits = [
  ["benefitOne", "benefitOneBody"],
  ["benefitTwo", "benefitTwoBody"],
  ["benefitThree", "benefitThreeBody"],
  ["benefitFour", "benefitFourBody"],
  ["benefitFive", "benefitFiveBody"],
  ["benefitSix", "benefitSixBody"],
];

const contactLinks = [
  { label: "contactPhone", value: "0978123612", href: "tel:0978123612", icon: Phone },
  { label: "contactEmail", value: "yonaelgetahun@gmail.com", href: "mailto:yonaelgetahun@gmail.com", icon: Mail },
  { label: "contactTelegram", value: "@nael_get", href: "https://t.me/nael_get", icon: FaTelegramPlane, external: true },
  { label: "contactInstagram", value: "@review_addis_", href: "https://www.instagram.com/review_addis_?stkn=OWFhNnU4bWZocXJq", icon: FaInstagram, external: true },
  { label: "contactTikTok", value: "@review_addis", href: "https://www.tiktok.com/@review_addis", icon: FaTiktok, external: true },
];

export default function WelcomeLanding() {
  const { t } = useLanguage();

  return (
    <main className="landing-page public-site">
      <nav className="landing-nav" aria-label="Primary navigation">
        <Link className="landing-brand" href="/" aria-label="ADDIS RMS home">
          <span>
            <strong>ADDIS RMS</strong>
            <small>V10 / RESTAURANT OPERATIONS</small>
          </span>
        </Link>
        <div className="landing-links">
          <a href="#capabilities">{t("landingNavFeatures")}</a>
          <a href="#why">{t("landingNavWhy")}</a>
          <a href="#contact">{t("landingNavContact")}</a>
        </div>
        <div className="landing-nav-actions">
          <GlobalLanguageDrawer />
          <Link className="landing-login" href="/login">{t("landingLogin")}</Link>
        </div>
      </nav>

      <section className="landing-hero">
        <div className="landing-hero-copy">
          <p className="landing-kicker">{t("landingKicker")}</p>
          <h1>ADDIS <em>RMS</em></h1>
          <p className="landing-slogan">{t("landingSlogan")}</p>
          <p className="landing-lede">{t("landingHeroBody")}</p>
          <div className="landing-actions">
            <Link className="landing-primary" href="/signup">{t("landingStart")}</Link>
            <Link className="landing-secondary" href="/login">{t("landingLogin")}</Link>
          </div>
          <p className="landing-note">{t("landingConnected")}</p>
        </div>
        <div className="landing-hero-visual" aria-hidden="true">
          <div className="landing-grid" />
          <div className="landing-signal signal-one" />
          <div className="landing-signal signal-two" />
          <div className="landing-visual-label">{t("landingFrontBack")}</div>
          <div className="landing-visual-center"><span>24/7</span><small>{t("liveData")}</small></div>
        </div>
      </section>

      <section className="landing-section landing-intro" id="why">
        <div>
          <p className="landing-kicker">{t("landingWhat")}</p>
          <h2>{t("landingHeroTitle")}</h2>
        </div>
        <p>{t("landingWhatBody")}</p>
      </section>

      <section className="landing-section" id="capabilities">
        <div className="landing-section-heading">
          <p className="landing-kicker">{t("landingInside")}</p>
          <h2>{t("landingTools")}</h2>
        </div>
        <div className="landing-feature-grid">
          {features.map(([number, title, body]) => (
            <article className="landing-feature" key={title}>
              <span>{number}</span>
              <h3>{t(title)}</h3>
              <p>{t(body)}</p>
            </article>
          ))}
        </div>
      </section>

      <section className="landing-section landing-benefits">
        <div className="landing-section-heading">
          <p className="landing-kicker">{t("landingWhy")}</p>
          <h2>{t("landingWhyTitle")}</h2>
        </div>
        <div className="landing-benefit-grid">
          {benefits.map(([title, body]) => (
            <article key={title}>
              <h3>{t(title)}</h3>
              <p>{t(body)}</p>
            </article>
          ))}
        </div>
      </section>

      <section className="landing-cta">
        <div>
          <p className="landing-kicker">{t("landingTrial")}</p>
          <h2>{t("landingFree")}</h2>
          <p>{t("landingTrialBody")}</p>
        </div>
        <Link className="landing-primary" href="/signup">{t("landingStart")}</Link>
      </section>

      <section className="landing-contact-section" id="contact">
        <div className="landing-contact-heading">
          <p className="landing-kicker">{t("landingContact")}</p>
          <h2>{t("landingTalk")}</h2>
          <p>{t("landingContactBody")}</p>
        </div>
        <div className="landing-contact-grid">
          {contactLinks.map((contact) => {
            const Icon = contact.icon;
            return (
              <a
                className="landing-contact-link"
                href={contact.href}
                key={contact.label}
                aria-label={`${t(contact.label)}: ${contact.value}`}
                target={contact.external ? "_blank" : undefined}
                rel={contact.external ? "noopener noreferrer" : undefined}
              >
                <Icon className="landing-contact-icon" aria-hidden="true" />
                <span className="landing-contact-copy">
                  <strong>{t(contact.label)}</strong>
                  <small>{contact.value}</small>
                </span>
              </a>
            );
          })}
        </div>
      </section>

      <footer className="landing-footer">
        <div>
          <strong>{t("landingFooterVersion")}</strong>
          <small>{t("landingSlogan")}</small>
        </div>
        <div>
          <span>{t("landingFooterCredit")}</span>
          <small>{t("landingFooterRights")}</small>
        </div>
        <div className="landing-footer-right">
          <Link href="/login">{t("landingLogin")}</Link>
        </div>
      </footer>
    </main>
  );
}
