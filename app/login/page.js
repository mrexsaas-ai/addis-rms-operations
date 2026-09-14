"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { getSupabaseBrowserClient } from "@/lib/supabase/browser";
import { getRoleHome, isKnownRole } from "@/lib/auth";
import { useLanguage } from "@/app/i18n/LanguageProvider";

export default function LoginPage() {
  const router = useRouter();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(true);
  const [darkMode, setDarkMode] = useState(false);
  const [error, setError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const { t } = useLanguage();

  useEffect(() => {
    const savedEmail = localStorage.getItem("addis-rms-login-email");
    const savedTheme = localStorage.getItem("addis-rms-theme");
    const applySavedValues = () => {
      if (savedEmail) {
        setEmail(savedEmail);
      }

      if (savedTheme === "dark") {
        setDarkMode(true);
      }
    };
    const frame = requestAnimationFrame(applySavedValues);
    return () => cancelAnimationFrame(frame);
  }, []);

  function handleRememberChange(event) {
    const checked = event.target.checked;
    setRememberMe(checked);

    if (!checked) {
      localStorage.removeItem("addis-rms-login-email");
    }
  }

  function toggleTheme() {
    const nextMode = !darkMode;
    setDarkMode(nextMode);
    localStorage.setItem(
      "addis-rms-theme",
      nextMode ? "dark" : "light"
    );
  }

  async function handleSubmit(event) {
    event.preventDefault();

    setError("");
    setIsSubmitting(true);

    if (rememberMe) {
      localStorage.setItem("addis-rms-login-email", email);
    } else {
      localStorage.removeItem("addis-rms-login-email");
    }

    const supabase = getSupabaseBrowserClient();
    const { error: signInError } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

    if (signInError) {
      setError(signInError.message);
      setIsSubmitting(false);
      return;
    }

    const { data: { user }, error: userError } = await supabase.auth.getUser();
    if (userError || !user) {
      setError(userError?.message || "Your session could not be established.");
      setIsSubmitting(false);
      return;
    }

    const [{ error: profileError }, { data: membership, error: membershipError }] = await Promise.all([
      supabase.from("profiles").select("id").eq("id", user.id).maybeSingle(),
      supabase.from("restaurant_users").select("role").eq("user_id", user.id).order("created_at", { ascending: true }).limit(1).maybeSingle(),
    ]);

    if (profileError || membershipError) {
      setError((profileError || membershipError).message);
      setIsSubmitting(false);
      return;
    }

    if (!membership || !isKnownRole(membership.role)) {
      setError("Your account is not connected to an authorized restaurant role.");
      setIsSubmitting(false);
      return;
    }

    router.replace(getRoleHome(membership.role));
    router.refresh();
  }

  return (
    <main className={`login-page ${darkMode ? "login-dark" : ""}`}>
      <header className="login-topbar">
        <div className="login-brand">
          <span className="login-brand-mark">ADDIS RMS</span>
          <span className="login-brand-subtitle">
            RUN SMARTER. GROW FASTER.
          </span>
        </div>

        <button
          type="button"
          className="theme-toggle"
          onClick={toggleTheme}
          aria-label="Toggle dark and light mode"
        >
          {darkMode ? "☀ Light" : "☾ Dark"}
        </button>
      </header>

      <section className="login-card">
        <div className="login-heading">
          <p className="eyebrow">RESTAURANT OPERATIONS</p>

          <h1>{t("welcomeBack")}</h1>

          <p>
            Sign in to your restaurant workspace and keep your
            operations moving.
          </p>
        </div>

        <form className="login-form" onSubmit={handleSubmit}>
          <label htmlFor="email">
            {t("restaurantEmail")}

            <input
              id="email"
              name="email"
              type="email"
              autoComplete="username"
              placeholder="you@restaurant.com"
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
                placeholder="Enter your password"
                required
                value={password}
                onChange={(event) => setPassword(event.target.value)}
              />

              <button
                type="button"
                className="password-toggle"
                onClick={() =>
                  setShowPassword((value) => !value)
                }
              >
                {showPassword ? "Hide" : "Show"}
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
              {error}
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
          {t("authorizedStaff")}
        </p>
      </section>
    </main>
  );
}