"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useLanguage } from "@/app/i18n/LanguageProvider";
import { deleteBankAccount, saveBankAccount, saveSettings } from "./actions";

const paymentMethods = [
  ["CASH", "cash", "settingsCashDescription"],
  ["TELEBIRR", "telebirr", "settingsTelebirrDescription"],
  ["BANK_TRANSFER", "cbe", "settingsCbeDescription"],
  ["BANK_TRANSFER", "settingsOtherBanks", "settingsOtherBanksDescription"],
];

const accountTypes = [
  { key: "TELEBIRR", label: "Telebirr", labelKey: "telebirr", fieldLabelKey: "telebirrNumber", backendType: "TELEBIRR", providerCode: "telebirr" },
  { key: "CBE", label: "CBE", labelKey: "cbe", fieldLabelKey: "settingsCbeNumber", backendType: "BANK_TRANSFER", providerCode: "cbe" },
  { key: "OTHER_BANKS", label: "Other Banks", labelKey: "settingsOtherBanks", fieldLabelKey: "settingsBankNumber", backendType: "BANK_TRANSFER", providerCode: null },
];

const businessTypes = [
  ["Restaurant", "businessRestaurant"],
  ["Cafe", "businessCafe"],
  ["Hotel", "businessHotel"],
  ["Other food-service business", "businessOtherFoodService"],
];

function displayNameKeys(businessType) {
  if (businessType === "Cafe") return { label: "cafeDisplayName", placeholder: "cafeDisplayNamePlaceholder" };
  if (businessType === "Hotel") return { label: "hotelDisplayName", placeholder: "hotelDisplayNamePlaceholder" };
  if (businessType === "Other food-service business") return { label: "otherBusinessDisplayName", placeholder: "otherBusinessDisplayNamePlaceholder" };
  return { label: "restaurantDisplayName", placeholder: "restaurantDisplayNamePlaceholder" };
}

const actionMessageKeys = {
  "Settings saved successfully.": "settingsSavedSuccess",
  "Bank account updated.": "settingsAccountUpdated",
  "Bank account added.": "settingsAccountAdded",
  "Bank account deleted.": "settingsAccountDeleted",
  "You must be signed in.": "settingsSignInRequired",
  "You do not have permission to manage settings.": "settingsPermissionDenied",
  "Restaurant name is required.": "settingsRestaurantNameRequired",
  "Restaurant name is too long.": "settingsRestaurantNameTooLong",
  "Business name is required.": "businessNameRequired",
  "Business name is too long.": "businessNameTooLong",
  "Business display name is required.": "businessDisplayNameRequired",
  "Business display name is too long.": "businessDisplayNameTooLong",
  "Business category is not supported.": "businessCategoryInvalid",
  "One of the fields is too long.": "settingsFieldTooLong",
  "Select at least one payment method.": "settingsPaymentMethodRequired",
  "Choose a supported application language.": "settingsLanguageUnsupported",
  "Bank name is required.": "settingsBankNameRequired",
  "Bank name is too long.": "settingsBankNameTooLong",
  "Account name is required.": "settingsAccountNameRequired",
  "Account name is too long.": "settingsAccountNameTooLong",
  "Account number is required.": "settingsAccountNumberRequired",
  "Account number is too long.": "settingsAccountNumberTooLong",
  "Choose a supported account type.": "settingsAccountTypeUnsupported",
  "The payment account was not saved for this restaurant.": "settingsAccountSaveFailed",
  "Account ID is required.": "settingsAccountIdRequired",
  "Account ID is too long.": "settingsAccountIdTooLong",
};

function translateActionMessage(message, t) {
  const key = actionMessageKeys[message];
  return key ? t(key) : t("settingsGenericError");
}

function localizedRequiredField(event, t) {
  event.currentTarget.setCustomValidity(t("settingsRequiredField"));
}

function clearFieldValidity(event) {
  event.currentTarget.setCustomValidity("");
}

function accountForType(accounts, type) {
  const usableAccounts = accounts.filter((account) => account.is_active && String(account.account_number || "").trim());
  if (type.key === "TELEBIRR") return usableAccounts.find((account) => account.type === "TELEBIRR" && account.verify_et_provider === "telebirr");
  if (type.key === "CBE") return usableAccounts.find((account) => account.type === "BANK_TRANSFER" && account.verify_et_provider === "cbe");
  return usableAccounts.find((account) => account.type === "BANK_TRANSFER" && account.verify_et_provider !== "cbe");
}

export default function SettingsClient({ restaurant, settings, accounts = [], accessDenied = false }) {
  const { t } = useLanguage();
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [notice, setNotice] = useState(null);
  const [accountList, setAccountList] = useState(accounts);
  const [editingType, setEditingType] = useState(null);
  const [businessType, setBusinessType] = useState(restaurant?.description || "Restaurant");
  const enabledMethods = settings?.enabled_payment_methods || ["CASH"];
  const displayName = displayNameKeys(businessType);

  function runAction(action, formData, onSuccess) {
    setNotice(null);
    startTransition(async () => {
      try {
        const result = await action(formData);
        setNotice({ type: "success", text: translateActionMessage(result.message, t) });
        onSuccess?.(result);
      } catch (error) {
        setNotice({ type: "error", text: translateActionMessage(error?.message, t) });
      }
    });
  }

  function handleSettingsSubmit(event) {
    event.preventDefault();
    runAction(saveSettings, new FormData(event.currentTarget));
  }

  function handleDelete(id) {
    const formData = new FormData();
    formData.set("id", id);
    runAction(deleteBankAccount, formData, () => {
      setAccountList((current) => current.filter((account) => account.id !== id));
      setEditingType(null);
      router.refresh();
    });
  }

  function handleAccountSave(event, type, existingAccount) {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);
    formData.set("type", type.backendType);
    formData.set("name", type.label);
    formData.set("verify_et_provider", type.providerCode || String(formData.get("verify_et_provider") || ""));
    if (existingAccount?.id) formData.set("id", existingAccount.id);
    formData.set("is_active", "on");
    runAction(saveBankAccount, formData, (result) => {
      const savedAccount = result.account;
      setAccountList((current) => existingAccount
        ? current.map((account) => account.id === existingAccount.id ? savedAccount : account)
        : [...current, savedAccount]);
      setEditingType(null);
      router.refresh();
    });
  }

  if (accessDenied) {
    return (
      <main className="state-page">
        <div className="state-panel">
          <span className="brand-mark">ADDIS RMS</span>
          <p className="eyebrow">{t("settingsAccessControl")}</p>
          <h1>{t("settingsRestricted")}</h1>
          <p>{t("settingsAdminOwnerRequired")}</p>
          <Link className="back-link" href="/">{t("settingsReturnDashboard")}</Link>
        </div>
      </main>
    );
  }

  return (
    <div className="settings-shell">
      <header className="settings-header">
        <div>
          <Link className="settings-back" href="/admin">&larr; {t("settingsAdminArea")}</Link>
          <p className="settings-eyebrow">{t("settingsControlCenter")}</p>
          <h1>{t("settingsPageTitle")}</h1>
          <p className="settings-lede">{t("settingsPageDescription")}</p>
        </div>
        <div className="settings-status"><span className="settings-status-dot" /> {t("settingsAdminAccess")}</div>
      </header>

      {notice && <div className={`settings-notice settings-notice-${notice.type}`}>{notice.text}</div>}

      <div className="settings-form">
        <form id="settings-form" onSubmit={handleSettingsSubmit}>
        <section className="settings-card settings-card-featured">
          <div className="settings-section-heading"><div><p className="settings-eyebrow">{t("settingsProfileSection")}</p><h2>{t("settingsRestaurantInformation")}</h2></div><span className="settings-badge">{t("settingsLiveProfile")}</span></div>
          <div className="settings-fields">
            <label className="settings-field"><span>{t("businessCategory")}</span><select name="business_type" value={businessType} onChange={(event) => setBusinessType(event.target.value)}>{businessTypes.map(([value, labelKey]) => <option value={value} key={value}>{t(labelKey)}</option>)}</select></label>
            <label className="settings-field"><span>{t("businessName")}</span><input name="business_legal_name" defaultValue={restaurant?.business_legal_name || ""} placeholder={t("businessNamePlaceholder")} required maxLength={160} onInvalid={(event) => localizedRequiredField(event, t)} onInput={clearFieldValidity} /><small>{t("businessLegalNameHelper")}</small></label>
            <label className="settings-field"><span>{t(displayName.label)}</span><input name="restaurant_name" defaultValue={restaurant?.name || ""} placeholder={t(displayName.placeholder)} required maxLength={160} onInvalid={(event) => localizedRequiredField(event, t)} onInput={clearFieldValidity} /><small>{t("businessDisplayNameHelper")}</small></label>
            <label className="settings-field"><span>{t("settingsPhoneNumber")}</span><input name="phone" type="tel" defaultValue={restaurant?.phone || ""} maxLength={40} /></label>
          </div>
          <input type="hidden" name="address" value={restaurant?.address || ""} readOnly />
          <input type="hidden" name="logo_url" value={restaurant?.logo_url || ""} readOnly />
          <input type="hidden" name="default_language" value={settings?.default_language || "en"} readOnly />
        </section>

        <section className="settings-card">
          <div className="settings-section-heading"><div><p className="settings-eyebrow">{t("settingsCheckoutSection")}</p><h2>{t("settingsPaymentMethods")}</h2></div><span className="settings-caption">{t("settingsManualPaymentFlow")}</span></div>
          <p className="settings-description">{t("settingsPaymentMethodsDescription")}</p>
          <div className="settings-method-grid">{paymentMethods.map(([value, labelKey, descriptionKey]) => <label className="settings-toggle-card" key={`${value}-${labelKey}`}><input type="checkbox" name={value} defaultChecked={enabledMethods.includes(value)} /><span className="settings-toggle" /><span><strong>{t(labelKey)}</strong><small>{t(descriptionKey)}</small></span></label>)}</div>
        </section>
        </form>

        <section className="settings-card">
          <div className="settings-section-heading"><div><p className="settings-eyebrow">{t("settingsAccountsSection")}</p><h2>{t("settingsAccountConfiguration")}</h2></div><span className="settings-caption">{t("settingsConfiguredCount").replace("{count}", String(accountList.length))}</span></div>
          <p className="settings-description">{t("settingsAccountDescription")}</p>
          <div className="settings-account-list">{accountTypes.map((type) => {
            const account = accountForType(accountList, type);
            const isEditing = editingType === type.key;
            return <article className={`settings-account-card ${isEditing ? "is-editing" : ""}`} key={type.key}>
              <div className="settings-account-heading"><div><span className="settings-account-kicker">{t(type.labelKey)}</span><h3>{t(type.labelKey)}</h3></div>{account && !isEditing && <span className="settings-pill settings-pill-active">{t("settingsSaved")}</span>}</div>
              {isEditing ? <form className="settings-account-editor" onSubmit={(event) => handleAccountSave(event, type, account)}>
                <label className="settings-field"><span>{t(type.fieldLabelKey)}</span><input name="account_number" defaultValue={account?.account_number || ""} required maxLength={80} onInvalid={(event) => localizedRequiredField(event, t)} onInput={clearFieldValidity} /></label>
                <label className="settings-field"><span>{t("settingsAccountHolderName")}</span><input name="account_name" defaultValue={account?.account_name || ""} required maxLength={160} onInvalid={(event) => localizedRequiredField(event, t)} onInput={clearFieldValidity} /></label>
                {type.key === "OTHER_BANKS" && <label className="settings-field"><span>Verify.et provider</span><select name="verify_et_provider" defaultValue={account?.verify_et_provider || ""}><option value="">Manual verification only</option><option value="cbe">CBE</option><option value="boa">Bank of Abyssinia</option><option value="dashen">Dashen</option><option value="awash">Awash</option><option value="siinqee">Siinqee</option></select></label>}
                <div className="settings-inline-actions"><button className="settings-primary-button" disabled={isPending} type="submit">{isPending ? t("settingsSaving") : t("save")}</button><button className="settings-secondary-button" disabled={isPending} type="button" onClick={() => setEditingType(null)}>{t("Cancel")}</button></div>
              </form> : account ? <div className="settings-account-readonly"><div><span>{t(type.fieldLabelKey)}</span><strong>{account.account_number}</strong><small>{account.account_name}</small></div><div className="settings-account-actions"><button className="settings-text-button" type="button" onClick={() => setEditingType(type.key)}>{t("Edit")}</button><button className="settings-icon-button" type="button" aria-label={t("settingsRemoveAccount").replace("{account}", t(type.labelKey))} onClick={() => handleDelete(account.id)} disabled={isPending}>&times;</button></div></div> : <div className="settings-account-empty"><span>{t("settingsNoAccountConfigured")}</span><button className="settings-secondary-button" type="button" onClick={() => setEditingType(type.key)}>{t("Add")}</button></div>}
            </article>;
          })}</div>
        </section>

        <div className="settings-save-bar"><span>{t("settingsChangesLocal")}</span><button form="settings-form" type="submit" className="settings-primary-button" disabled={isPending}>{isPending ? t("settingsSavingChanges") : t("settingsSaveChanges")}</button></div>
      </div>
    </div>
  );
}
