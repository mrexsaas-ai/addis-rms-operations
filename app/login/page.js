"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { getSupabaseBrowserClient } from "@/lib/supabase/browser";
import { getRoleHome, isKnownRole } from "@/lib/auth";
import { useLanguage } from "@/app/i18n/LanguageProvider";
import { provisionRestaurant } from "@/app/signup/actions";
import styles from "./login.module.css";

export default function LoginPage() {
  const router = useRouter();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(true);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const { t } = useLanguage();

  const eyeIcon = (
    <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M2.5 12s3.5-5 9.5-5 9.5 5 9.5 5-3.5 5-9.5 5-9.5-5-9.5-5Z" /><circle cx="12" cy="12" r="2.5" /></svg>
  );

  useEffect(() => {
    const savedEmail = localStorage.getItem("addis-rms-login-email");
    const currentUrl = new URL(window.location.href);
    const verified = currentUrl.searchParams.get("verified") === "1";
    const verificationError = currentUrl.searchParams.get("authError") === "verification";
    const restaurantInactive = currentUrl.searchParams.get("restaurantInactive") === "1";
    const membershipAmbiguous = currentUrl.searchParams.get("membershipAmbiguous") === "1";

    const frame = requestAnimationFrame(() => {
      if (savedEmail) setEmail(savedEmail);
      if (verified) setNotice("emailVerified");
      if (verificationError) setError("verificationLinkInvalid");
      if (restaurantInactive) setError("restaurantInactive");
      if (membershipAmbiguous) setError("membershipAmbiguous");
    });
    return () => cancelAnimationFrame(frame);
  }, []);

  function handleRememberChange(event) {
    const checked = event.target.checked;
    setRememberMe(checked);

    if (!checked) {
      localStorage.removeItem("addis-rms-login-email");
    }
  }

  async function handleSubmit(event) {
    event.preventDefault();

    setError("");
    const emailInput = event.currentTarget.querySelector('input[name="email"]');
    const normalizedEmail = emailInput.value.trim().toLowerCase();

    if (emailInput.validity.valueMissing) {
      setError({ field: "restaurantEmail", required: true });
      return;
    }

    if (emailInput.validity.typeMismatch) {
      setError("invalidEmail");
      return;
    }

    if (!password) {
      setError({ field: "password", required: true });
      return;
    }

    setIsSubmitting(true);

    if (rememberMe) {
      localStorage.setItem("addis-rms-login-email", normalizedEmail);
    } else {
      localStorage.removeItem("addis-rms-login-email");
    }

    const supabase = getSupabaseBrowserClient();
    const { error: signInError } = await supabase.auth.signInWithPassword({
      email: normalizedEmail,
      password,
    });

    if (signInError) {
      console.error("[auth] Sign-in failed", {
        name: signInError.name,
        code: signInError.code,
        status: signInError.status,
        message: String(signInError.message || "").replace(/([?&](?:access_token|refresh_token|token|key|password)=)[^&\s]*/gi, "$1[redacted]"),
      });

      const message = /email not confirmed|email_not_confirmed/i.test(signInError.message || "")
        ? "confirmEmailError"
        : /invalid login|invalid credentials|email or password/i.test(signInError.message || "")
          ? "invalidLoginError"
          : "signInError";
      setError(message);
      setIsSubmitting(false);
      return;
    }

    const { data: { user }, error: userError } = await supabase.auth.getUser();
    if (userError || !user) {
      setError("sessionError");
      setIsSubmitting(false);
      return;
    }

    const [
      { error: profileError },
      { data: membership, error: membershipError },
      { data: platformAdmin, error: platformAdminError },
    ] = await Promise.all([
      supabase.from("profiles").select("id").eq("id", user.id).maybeSingle(),
      supabase.from("restaurant_users").select("role, restaurant_id, restaurants(status)").eq("user_id", user.id).order("created_at", { ascending: true }).limit(2),
      supabase.from("platform_admins").select("user_id").eq("user_id", user.id).maybeSingle(),
    ]);

    if (profileError || membershipError || platformAdminError) {
      setError("accountLoadError");
      setIsSubmitting(false);
      return;
    }

    const { data: { session }, error: sessionError } = await supabase.auth.getSession();
    if (sessionError || !session) {
      setError("expiredSessionError");
      setIsSubmitting(false);
      return;
    }

    if (membership?.length > 1) {
      setError("membershipAmbiguous");
      setIsSubmitting(false);
      return;
    }

    if (platformAdmin) {
      setError("unauthorizedRoleError");
      setIsSubmitting(false);
      return;
    }

    const selectedMembership = membership?.[0] || null;

    const membershipRestaurant = Array.isArray(selectedMembership?.restaurants)
      ? selectedMembership.restaurants[0]
      : selectedMembership?.restaurants;
    if (selectedMembership && membershipRestaurant?.status !== "ACTIVE") {
      setError("restaurantInactive");
      setIsSubmitting(false);
      return;
    }

    if (!selectedMembership && user.user_metadata?.business_name) {
      try {
        const onboardingForm = new FormData();
        onboardingForm.set("restaurant_name", user.user_metadata.business_name);
        onboardingForm.set("business_legal_name", user.user_metadata.business_legal_name || user.user_metadata.business_name);
        onboardingForm.set("business_type", user.user_metadata.business_type || "Restaurant");
        onboardingForm.set("full_name", user.user_metadata.full_name || "");
        await provisionRestaurant(onboardingForm);
        router.replace("/");
        router.refresh();
        return;
      } catch {
        setError("workspaceCreationError");
        setIsSubmitting(false);
        return;
      }
    }

    if (!selectedMembership || !isKnownRole(selectedMembership.role)) {
      setError("unauthorizedRoleError");
      setIsSubmitting(false);
      return;
    }

    router.replace(getRoleHome(selectedMembership.role));
    router.refresh();
  }

  return (
    <main className={`login-page ${styles.loginPage}`}>
      <header className="login-topbar">
        <div className="login-brand">
          <span className="login-brand-mark">ADDIS RMS</span>
          <span className="login-brand-subtitle">{t("loginTagline")}</span>
        </div>

      </header>

      <section className="login-card">
        <div className="login-heading">
          <p className="eyebrow">{t("loginEyebrow")}</p>

          <h1>{t("welcomeBack")}</h1>

          <p>
            {t("loginDescription")}
          </p>
        </div>

        {notice && <p className="public-form-success" role="status">{t(notice)}</p>}

        <form className="login-form" onSubmit={handleSubmit} noValidate>
          <label htmlFor="email">
            {t("restaurantEmail")}

            <input
              id="email"
              name="email"
              type="email"
              autoComplete="username"
              placeholder={t("emailPlaceholder")}
              required
              value={email}
              onChange={(event) => setEmail(event.target.value)}
            />
          </label>

          <label htmlFor="password">
            {t("password")}

            <span className="password-field">
              <input
                id="password"
                name="password"
                type={showPassword ? "text" : "password"}
                autoComplete="current-password"
                placeholder={t("passwordPlaceholder")}
                required
                value={password}
                onChange={(event) => setPassword(event.target.value)}
              />

              <button
                type="button"
                className="password-toggle"
                aria-label={t(showPassword ? "hidePassword" : "showPassword")}
                title={t(showPassword ? "hidePassword" : "showPassword")}
                onClick={() =>
                  setShowPassword((value) => !value)
                }
              >
                {eyeIcon}
              </button>
            </span>
          </label>

          <div className="login-options">
            <label className="remember-option">
              <input
                type="checkbox"
                checked={rememberMe}
                onChange={handleRememberChange}
              />
              <span>{t("rememberMe")}</span>
            </label>

            <span className="secure-label">
              {t("secureLogin")}
            </span>
          </div>

          {error && (
            <p className="form-error" role="alert">
              {typeof error === "string"
                ? t(error)
                : `${t(error.field)} ${t("requiredField")}`}
            </p>
          )}

          <button
            className="login-submit"
            type="submit"
            disabled={isSubmitting}
          >
            {isSubmitting ? t("signingIn") : t("signIn")}
          </button>
        </form>

        <p className="login-footer">
          {t("authorizedStaff")} · <Link href="/staff-login">{t("staffLogin")}</Link> · <Link href="/signup">{t("createWorkspace")}</Link>
        </p>
      </section>
    </main>
  );
}