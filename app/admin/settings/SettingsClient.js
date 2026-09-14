"use client";

import { useState, useTransition } from "react";
import { deleteBankAccount, saveBankAccount, saveSettings } from "./actions";

const languages = [
  ["en", "English"],
  ["am", "Amharic"],
  ["om", "Afaan Oromoo"],
  ["ti", "Tigrinya"],
];

const roles = [
  ["ADMIN", "Full control", "Manage restaurant, finances, staff, and all operations."],
  ["OWNER", "Full control", "Manage restaurant, finances, staff, and all operations."],
  ["MANAGER", "Operations", "Manage menus, tables, orders, and daily operations."],
  ["SERVER", "Service", "Create orders and manage assigned service workflows."],
  ["CHEF", "Kitchen", "View and update kitchen orders."],
  ["BARMAN", "Bar", "Prepare bar items and manage bar workflow."],
];

function messageFrom(error) {
  return error?.message || "Something went wrong. Please try again.";
}

export default function SettingsClient({ restaurant, settings, accounts }) {
  const [isPending, startTransition] = useTransition();
  const [notice, setNotice] = useState(null);
  const [language, setLanguage] = useState(settings?.default_language || "en");
  const [editingAccount, setEditingAccount] = useState(null);

  const enabledMethods = settings?.enabled_payment_methods || ["CASH"];
  const qrAccount = accounts.find((account) => account.qr_code_url);

  function runAction(action, formData, onSuccess) {
    setNotice(null);
    startTransition(async () => {
      try {
        const result = await action(formData);
        setNotice({ type: "success", text: result.message });
        onSuccess?.();
      } catch (error) {
        setNotice({ type: "error", text: messageFrom(error) });
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
    runAction(deleteBankAccount, formData);
  }

  return (
    <div className="settings-shell">
      <header className="settings-header">
        <div>
          <a className="settings-back" href="/admin">← Admin area</a>
          <p className="settings-eyebrow">CONTROL CENTER / SETTINGS</p>
          <h1>Restaurant settings</h1>
          <p className="settings-lede">Shape how {restaurant?.name || "your restaurant"} works across the floor, kitchen, and guest experience.</p>
        </div>
        <div className="settings-status"><span className="settings-status-dot" /> Admin access</div>
      </header>

      {notice && <div className={`settings-notice settings-notice-${notice.type}`}>{notice.text}</div>}

      <form className="settings-form" onSubmit={handleSettingsSubmit}>
        <section className="settings-card settings-card-featured">
          <div className="settings-section-heading"><div><p className="settings-eyebrow">01 / Identity</p><h2>Restaurant information</h2></div><span className="settings-badge">Live profile</span></div>
          <div className="settings-grid settings-grid-identity">
            <div className="settings-fields">
              <label className="settings-field"><span>Restaurant name</span><input name="restaurant_name" defaultValue={restaurant?.name || ""} required maxLength={160} /></label>
              <label className="settings-field"><span>Phone</span><input name="phone" type="tel" defaultValue={restaurant?.phone || ""} maxLength={40} placeholder="+251 ..." /></label>
              <label className="settings-field settings-field-wide"><span>Address</span><input name="address" defaultValue={restaurant?.address || ""} maxLength={255} placeholder="Addis Ababa, Ethiopia" /></label>
              <label className="settings-field settings-field-wide"><span>Logo URL <em>Optional</em></span><input name="logo_url" type="url" defaultValue={restaurant?.logo_url || ""} maxLength={500} placeholder="https://..." /></label>
            </div>
            <div className="settings-logo-preview">{restaurant?.logo_url ? <img src={restaurant.logo_url} alt="Restaurant logo" /> : <span>{(restaurant?.name || "A").slice(0, 1).toUpperCase()}</span>}<small>Restaurant mark</small></div>
          </div>
        </section>

        <section className="settings-card">
          <div className="settings-section-heading"><div><p className="settings-eyebrow">02 / Checkout</p><h2>Payment methods</h2></div><span className="settings-caption">Ready for order workflows</span></div>
          <p className="settings-description">Choose the payment methods your team can record. Payment status remains a manual operational action.</p>
          <div className="settings-method-grid">{[["CASH", "Cash", "Record cash collected at the counter."], ["TELEBIRR", "Telebirr", "Record Telebirr payments and references."], ["BANK_TRANSFER", "Bank transfer", "Record transfers against configured accounts."]].map(([value, label, description]) => <label className="settings-toggle-card" key={value}><input type="checkbox" name={value} defaultChecked={enabledMethods.includes(value)} /><span className="settings-toggle" /><span><strong>{label}</strong><small>{description}</small></span></label>)}</div>
        </section>

        <section className="settings-card">
          <div className="settings-section-heading"><div><p className="settings-eyebrow">03 / Finance</p><h2>Bank accounts</h2></div><span className="settings-caption">{accounts.length} configured</span></div>
          <p className="settings-description">Keep payout details available to staff without claiming automatic payment verification.</p>
          <div className="settings-account-list">{accounts.length ? accounts.map((account) => <div className="settings-account-row" key={account.id}><div className="settings-account-icon">{account.type === "TELEBIRR" ? "T" : "B"}</div><div className="settings-account-details"><strong>{account.name}</strong><span>{account.account_name} · {account.account_number}</span>{account.branch && <small>{account.branch}</small>}</div><span className={`settings-pill ${account.is_active ? "settings-pill-active" : ""}`}>{account.is_active ? "Active" : "Inactive"}</span><button type="button" className="settings-text-button" onClick={() => setEditingAccount(account)}>Edit</button><button type="button" className="settings-icon-button" aria-label={`Delete ${account.name}`} onClick={() => handleDelete(account.id)} disabled={isPending}>×</button></div>) : <p className="settings-empty">No bank accounts configured yet.</p>}</div>
          <div className="settings-account-editor" key={editingAccount?.id || "new-account"}><h3>{editingAccount ? "Edit account" : "Add bank account"}</h3><input type="hidden" name="id" defaultValue={editingAccount?.id || ""} /><div className="settings-fields settings-fields-account"><label className="settings-field"><span>Type</span><select name="type" defaultValue={editingAccount?.type || "BANK_TRANSFER"}><option value="BANK_TRANSFER">Bank transfer</option><option value="TELEBIRR">Telebirr</option></select></label><label className="settings-field"><span>Bank name</span><input name="name" defaultValue={editingAccount?.name || ""} /></label><label className="settings-field"><span>Account name</span><input name="account_name" defaultValue={editingAccount?.account_name || ""} /></label><label className="settings-field"><span>Account number</span><input name="account_number" defaultValue={editingAccount?.account_number || ""} /></label><label className="settings-field"><span>Branch <em>Optional</em></span><input name="branch" defaultValue={editingAccount?.branch || ""} /></label><label className="settings-field"><span>QR image URL <em>Optional</em></span><input name="qr_code_url" type="url" defaultValue={editingAccount?.qr_code_url || ""} /></label></div><label className="settings-check"><input type="checkbox" name="is_active" defaultChecked={editingAccount ? editingAccount.is_active : true} /> Account is active</label><div className="settings-inline-actions"><button type="button" className="settings-primary-button" disabled={isPending} onClick={(event) => runAction(saveBankAccount, new FormData(event.currentTarget.closest("form")), () => setEditingAccount(null))}>{isPending ? "Saving..." : editingAccount ? "Update account" : "Add account"}</button>{editingAccount && <button type="button" className="settings-secondary-button" onClick={() => setEditingAccount(null)}>Cancel</button>}</div></div>
        </section>

        <section className="settings-card settings-two-column"><div><div className="settings-section-heading"><div><p className="settings-eyebrow">04 / Guest payments</p><h2>QR payment</h2></div><span className="settings-caption">Manual confirmation</span></div><p className="settings-description">Display a payment QR image for guests. Your team still confirms payment manually.</p><div className="settings-qr-box">{qrAccount?.qr_code_url ? <img src={qrAccount.qr_code_url} alt="Configured payment QR" /> : <span>QR preview<br /><small>Set a QR image URL on a payment account</small></span>}</div></div><div><div className="settings-section-heading"><div><p className="settings-eyebrow">05 / Receipts</p><h2>Receipt settings</h2></div><span className="settings-badge">Locked</span></div><div className="settings-receipt"><span className="settings-receipt-icon">EN</span><div><strong>Receipt language: English only</strong><p>Application language preferences never change printed or digital receipt language.</p></div></div></div></section>

        <section className="settings-card"><div className="settings-section-heading"><div><p className="settings-eyebrow">06 / Workspace</p><h2>Language settings</h2></div><span className="settings-caption">UI only</span></div><p className="settings-description">Choose the language for the application interface. This does not change IDs, business logic, payments, orders, or receipts.</p><div className="settings-language-grid">{languages.map(([value, label]) => <label className={`settings-language-option ${language === value ? "selected" : ""}`} key={value}><input type="radio" name="default_language" value={value} checked={language === value} onChange={() => setLanguage(value)} /><span className="settings-radio" /><strong>{label}</strong></label>)}</div></section>

        <section className="settings-card"><div className="settings-section-heading"><div><p className="settings-eyebrow">07 / Access model</p><h2>User & role permissions</h2></div><span className="settings-caption">Supabase roles</span></div><div className="settings-role-grid">{roles.map(([role, access, detail]) => <div className="settings-role" key={role}><div className="settings-role-top"><strong>{role}</strong><span>{access}</span></div><p>{detail}</p></div>)}</div></section>

        <div className="settings-save-bar"><span>Changes apply to this restaurant only.</span><button type="submit" className="settings-primary-button" disabled={isPending}>{isPending ? "Saving changes..." : "Save changes"}</button></div>
      </form>
    </div>
  );
}
