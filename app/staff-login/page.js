"use client";

import Link from "next/link";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { getSupabaseBrowserClient } from "@/lib/supabase/browser";
import { getRoleHome, isKnownRole } from "@/lib/auth";
import { useLanguage } from "@/app/i18n/LanguageProvider";

export default function StaffLoginPage() {
  const router = useRouter();
  const { t } = useLanguage();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function handleSubmit(event) {
    event.preventDefault();
    setError("");
    setIsSubmitting(true);

    const normalizedEmail = email.trim().toLowerCase();
    const supabase = getSupabaseBrowserClient();
    const { error: signInError } = await supabase.auth.signInWithPassword({
      email: normalizedEmail,
      password,
    });

    if (signInError) {
      console.error("[auth] Staff sign-in failed", {
        name: signInError.name,
        code: signInError.code,
        status: signInError.status,
        message: String(signInError.message || "").replace(/([?&](?:access_token|refresh_token|token|key|password)=)[^&\s]*/gi, "$1[redacted]"),
      });
      setError(/email not confirmed|email_not_confirmed/i.test(signInError.message || "")
        ? "confirmEmailError"
        : /invalid login|invalid credentials|email or password/i.test(signInError.message || "")
          ? "invalidLoginError"
          : "signInError");
      setIsSubmitting(false);
      return;
    }

    const { data: { user }, error: userError } = await supabase.auth.getUser();
    if (userError || !user) {
      setError("sessionError");
      setIsSubmitting(false);
      return;
    }

    const { data: membership, error: membershipError } = await supabase
      .from("restaurant_users")
      .select("role, restaurant_id, restaurants(status)")
      .eq("user_id", user.id)
      .order("created_at", { ascending: true })
      .limit(2);

    if (membershipError) {
      console.error("[auth] Staff membership lookup failed", {
        code: membershipError.code,
        status: membershipError.status,
        message: membershipError.message,
      });
      setError("accountLoadError");
      setIsSubmitting(false);
      return;
    }

    if (membership?.length > 1) {
      setError("membershipAmbiguous");
      setIsSubmitting(false);
      return;
    }

    const selectedMembership = membership?.[0] || null;
    if (!selectedMembership) {
      setError("unauthorizedRoleError");
      setIsSubmitting(false);
      return;
    }

    const membershipRestaurant = Array.isArray(selectedMembership.restaurants)
      ? selectedMembership.restaurants[0]
      : selectedMembership.restaurants;
    if (membershipRestaurant?.status !== "ACTIVE") {
      setError(t("restaurantInactive"));
      setIsSubmitting(false);
      return;
    }

    if (!isKnownRole(selectedMembership.role)) {
      setError("unauthorizedRoleError");
      setIsSubmitting(false);
      return;
    }

    const { data: { session }, error: sessionError } = await supabase.auth.getSession();
    if (sessionError || !session) {
      setError("expiredSessionError");
      setIsSubmitting(false);
      return;
    }

    router.replace(getRoleHome(selectedMembership.role));
    router.refresh();
  }

  return (
    <main className="login-page">
      <section className="login-card">
        <div className="login-heading">
          <p className="eyebrow">ADDIS RMS</p>
          <h1>{t("staffLogin")}</h1>
          <p>{t("staffLoginDescription")}</p>
        </div>

        <form className="login-form" onSubmit={handleSubmit}>
          <label htmlFor="staff-email">
            {t("email")}
            <input id="staff-email" name="email" type="email" autoComplete="username" required value={email} onChange={(event) => setEmail(event.target.value)} />
          </label>

          <label htmlFor="staff-password">
            {t("password")}
            <span className="password-field">
              <input id="staff-password" name="password" type={showPassword ? "text" : "password"} autoComplete="current-password" required value={password} onChange={(event) => setPassword(event.target.value)} />
              <button type="button" className="password-toggle" aria-label={t(showPassword ? "hidePassword" : "showPassword")} onClick={() => setShowPassword((value) => !value)}>
                {t(showPassword ? "hidePasswordSignup" : "showPasswordSignup")}
              </button>
            </span>
          </label>

          {error && <p className="form-error" role="alert">{t(error)}</p>}
          <button className="login-submit" type="submit" disabled={isSubmitting}>{isSubmitting ? t("signingIn") : t("signIn")}</button>
        </form>

        <p className="login-footer"><Link href="/login">{t("adminOwnerLogin")}</Link></p>
      </section>
    </main>
  );
}
