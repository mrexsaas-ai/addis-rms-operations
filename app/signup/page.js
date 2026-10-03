"use client";

import Link from "next/link";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { getSupabaseBrowserClient } from "@/lib/supabase/browser";
import { provisionRestaurant } from "./actions";
import { useLanguage } from "@/app/i18n/LanguageProvider";

const BUSINESS_TYPES = ["Restaurant", "Cafe", "Hotel", "Other food-service business"];

function displayNameKeys(businessType) {
  if (businessType === "Cafe") return { label: "cafeDisplayName", placeholder: "cafeDisplayNamePlaceholder" };
  if (businessType === "Hotel") return { label: "hotelDisplayName", placeholder: "hotelDisplayNamePlaceholder" };
  if (businessType === "Other food-service business") return { label: "otherBusinessDisplayName", placeholder: "otherBusinessDisplayNamePlaceholder" };
  return { label: "restaurantDisplayName", placeholder: "restaurantDisplayNamePlaceholder" };
}

function getAuthCallbackUrl() {
  const appUrl = process.env.NEXT_PUBLIC_APP_URL || window.location.origin;
  return new URL("/auth/callback", appUrl).toString();
}

export default function SignupPage() {
  const router = useRouter();
  const { t } = useLanguage();
  const [form, setForm] = useState({ fullName: "", businessLegalName: "", restaurantName: "", businessType: "Restaurant", email: "", password: "" });
  const [showPassword, setShowPassword] = useState(false);
  const [state, setState] = useState({ pending: false, message: "", error: "" });

  function localizeError(message) {
    const value = String(message || "");

    if (/email.*already|already.*email|user.*already/i.test(value)) {
      return "signupError";
    }

    if (/restaurant name is required/i.test(value)) {
      return { field: "displayName", required: true };
    }

    if (/business display name is required/i.test(value)) {
      return { field: "displayName", required: true };
    }

    if (/business name is required/i.test(value)) {
      return "businessNameRequired";
    }

    if (/business name is too long/i.test(value)) return "businessNameTooLong";
    if (/business display name is too long/i.test(value)) return "businessDisplayNameTooLong";
    if (/sample owner email/i.test(value)) return "ownerEmailExampleNotAllowed";
    if (/authenticated owner email is required/i.test(value)) return "ownerEmailRequired";

    if (/full name is required/i.test(value)) {
      return { field: "ownerName", required: true };
    }

    if (/business category is not supported/i.test(value)) {
      return "businessCategoryInvalid";
    }

    if (/could not be created|restaurant.*created/i.test(value)) {
      return "restaurantCreationError";
    }

    return "signupError";
  }

  function translateMessage(message) {
    if (!message) return "";
    if (typeof message === "string") return t(message);
    const labelKey = message.field === "displayName"
      ? displayNameKeys(form.businessType).label
      : message.field;
    return `${t(labelKey)} ${t("requiredField")}`;
  }

  function updateField(event) {
    const field = event.target.name === "full_name"
      ? "fullName"
      : event.target.name === "business_type"
        ? "businessType"
      : event.target.name === "restaurant_name"
        ? "restaurantName"
        : event.target.name === "business_legal_name"
          ? "businessLegalName"
        : event.target.name;
    setForm((current) => ({ ...current, [field]: event.target.value }));
  }

  async function handleSubmit(event) {
    event.preventDefault();

    if (!form.fullName.trim()) {
      setState({ pending: false, message: "", error: { field: "ownerName", required: true } });
      return;
    }

    if (!form.businessLegalName.trim()) {
      setState({ pending: false, message: "", error: "businessNameRequired" });
      return;
    }

    if (!form.restaurantName.trim()) {
      setState({ pending: false, message: "", error: { field: "displayName", required: true } });
      return;
    }

    if (!BUSINESS_TYPES.includes(form.businessType)) {
      setState({ pending: false, message: "", error: "businessCategoryInvalid" });
      return;
    }

    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email.trim())) {
      setState({ pending: false, message: "", error: "invalidEmail" });
      return;
    }

    if (form.email.trim().toLowerCase() === "you@gmail.com") {
      setState({ pending: false, message: "", error: "ownerEmailExampleNotAllowed" });
      return;
    }

    if (form.password.length < 6) {
      setState({ pending: false, message: "", error: "passwordLength" });
      return;
    }

    setState({ pending: true, message: "", error: "" });

    const email = form.email.trim().toLowerCase();
    const { data, error } = await getSupabaseBrowserClient().auth.signUp({
      email,
      password: form.password,
      options: {
        emailRedirectTo: getAuthCallbackUrl(),
        data: { full_name: form.fullName.trim(), business_legal_name: form.businessLegalName.trim(), business_name: form.restaurantName.trim(), business_type: form.businessType },
      },
    });

    if (error) {
      setState({ pending: false, message: "", error: localizeError(error.message) });
      return;
    }

    if (!data.session) {
      setState({ pending: false, message: "signupVerifyEmail", error: "" });
      return;
    }

    try {
      await provisionRestaurant(new FormData(event.currentTarget));
      router.replace("/");
      router.refresh();
    } catch (provisionError) {
      setState({ pending: false, message: "", error: localizeError(provisionError?.message) });
    }
  }

  return (
    <main className="public-form-page">
      <Link className="public-form-back" href="/login">{t("signupBack")}</Link>
      <section className="public-form-card">
        <p className="public-kicker">{t("signupEyebrow")}</p>
        <h1>{t("signupTitle")}<br /><em>{t("signupTitleAccent")}</em></h1>
        <p>{t("signupDescription")}</p>
        <form onSubmit={handleSubmit} noValidate>
          <label>{t("businessCategory")}<select name="business_type" value={form.businessType} onChange={updateField}><option value="Restaurant">{t("businessRestaurant")}</option><option value="Cafe">{t("businessCafe")}</option><option value="Hotel">{t("businessHotel")}</option><option value="Other food-service business">{t("businessOtherFoodService")}</option></select></label>
          <label>{t("businessName")}<input name="business_legal_name" value={form.businessLegalName} onChange={updateField} placeholder={t("businessNamePlaceholder")} maxLength="160" required /><small>{t("businessLegalNameHelper")}</small></label>
          <label>{t(displayNameKeys(form.businessType).label)}<input name="restaurant_name" value={form.restaurantName} onChange={updateField} placeholder={t(displayNameKeys(form.businessType).placeholder)} maxLength="160" required /><small>{t("businessDisplayNameHelper")}</small></label>
          <label>{t("ownerName")}<input name="full_name" value={form.fullName} onChange={updateField} placeholder={t("ownerNamePlaceholder")} required /></label>
          <label>{t("ownerEmail")}<input name="email" type="email" value={form.email} onChange={updateField} placeholder={t("ownerEmailPlaceholder")} required /></label>
          <label>{t("password")}<span className="public-password-field"><input name="password" type={showPassword ? "text" : "password"} minLength="6" value={form.password} onChange={updateField} required /><button type="button" className="public-password-toggle" aria-label={showPassword ? t("hidePassword") : t("showPassword")} onClick={() => setShowPassword((value) => !value)}>{showPassword ? t("hidePasswordSignup") : t("showPasswordSignup")}</button></span></label>
          {state.error && <p className="public-form-error" role="alert">{translateMessage(state.error)}</p>}
          {state.message && <p className="public-form-success" role="status">{translateMessage(state.message)}</p>}
          <button className="public-primary" type="submit" disabled={state.pending}>{state.pending ? t("creatingWorkspace") : t("createWorkspace")}</button>
        </form>
        <p className="public-form-note">{t("alreadyHaveAccess")} <Link href="/login">{t("login")}</Link></p>
      </section>
    </main>
  );
}
