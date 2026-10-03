"use client";

import { useActionState, useCallback, useEffect, useMemo, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { useLanguage } from "../i18n/LanguageProvider";
import { MenuItemImage } from "../menu/MenuImageForm";
import { createServerOrder } from "./actions";
import { updateTableStatus } from "../tables/actions";
import { createPendingPayment, recordPayment, resolvePendingPayment } from "../orders/actions";
import { getActivePaymentAccounts, saveBankAccount } from "../admin/settings/actions";

const tableStatusClasses = {
  AVAILABLE: "available",
  OCCUPIED: "occupied",
  RESERVED: "reserved",
  CLEANING: "cleaning",
};

const defaultState = {
  success: false,
  error: "",
  orderId: null,
  orderNumber: null,
  orderTotal: null,
  existingOrder: null,
};

async function submitOrder(previousState, formData) {
  try {
    const result = await createServerOrder(formData);
    if (result?.existingOrder) {
      return { ...defaultState, existingOrder: result.existingOrder };
    }

    return {
      success: true,
      orderId: result?.orderId || null,
      orderNumber: result?.orderNumber || null,
      orderTotal: result?.orderTotal ?? null,
      error: "",
    };
  } catch (error) {
    return { ...defaultState, error: error?.message || "Unable to create this order." };
  }
}

function formatCurrency(value) {
  return `ETB ${Number(value || 0).toLocaleString("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

function cartTotal(items) {
  return items.reduce((total, item) => {
    const price = Number(item.price);
    return Number.isFinite(price) ? total + price * Number(item.quantity || 0) : Number.NaN;
  }, 0);
}

function translateServerError(message, t) {
  const errorKeys = {
    "Unable to create this order.": "unableCreateOrder",
    "Add at least one item to the cart.": "emptyCartError",
    "Select a table for dine-in orders.": "selectTableError",
  };
  return errorKeys[message] ? t(errorKeys[message]) : message;
}

function isUsablePaymentAccount(account) {
  return account?.is_active && String(account.account_number || "").trim();
}

function accountMatchesPaymentOption(account, option) {
  if (!isUsablePaymentAccount(account)) return false;
  const accountType = String(account.type || "").trim().toUpperCase();
  if (option.key === "TELEBIRR") return accountType === "TELEBIRR" && account.verify_et_provider === "telebirr";
  if (option.key === "CBE") return accountType === "BANK_TRANSFER" && account.verify_et_provider === "cbe";
  if (option.key === "OTHER_BANK") return accountType === "BANK_TRANSFER" && account.verify_et_provider !== "cbe";
  return false;
}

function paymentStatusLabel(status, t) {
  if (status === "COMPLETED") return t("paid");
  if (status === "PENDING") return "PENDING";
  return status || t("unpaid");
}

function paymentActionError(error, t) {
  if (error?.message === "An active payment already exists for this order.") {
    return t("activePaymentExistsError");
  }
  return error?.message || t("unableRecordPayment");
}

export default function ServerPOSClient({ restaurantName, tables, categories, menuItems, enabledPaymentMethods = ["CASH"], canManagePaymentAccounts = false }) {
  const { t } = useLanguage();
  const router = useRouter();
  const refreshedOrderId = useRef(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedCategory, setSelectedCategory] = useState("ALL");
  const [orderType, setOrderType] = useState("DINE_IN");
  const [selectedTableId, setSelectedTableId] = useState(
    tables.find((table) => table.status === "AVAILABLE")?.id || "",
  );
  const [notes, setNotes] = useState("");
  const [cart, setCart] = useState([]);
  const [state, formAction, pending] = useActionState(submitOrder, defaultState);
  const [paymentOpen, setPaymentOpen] = useState(false);
  const [paymentMethod, setPaymentMethod] = useState("CASH");
  const [cashReceived, setCashReceived] = useState("");
  const [pendingPaymentId, setPendingPaymentId] = useState("");
  const [pendingPaymentStatus, setPendingPaymentStatus] = useState("");
  const [paymentReference, setPaymentReference] = useState("");
  const [paymentError, setPaymentError] = useState("");
  const [paymentMessage, setPaymentMessage] = useState("");
  const [checkoutError, setCheckoutError] = useState("");
  const [paymentPending, startPaymentTransition] = useTransition();
  const [accountList, setAccountList] = useState([]);
  const [selectedPaymentAccountId, setSelectedPaymentAccountId] = useState("");
  const [accountFormOpen, setAccountFormOpen] = useState(false);
  const [accountFormType, setAccountFormType] = useState("TELEBIRR");
  const [accountToEdit, setAccountToEdit] = useState(null);
  const [accountError, setAccountError] = useState("");
  const [accountPending, startAccountTransition] = useTransition();

  const paymentOptions = [
    { key: "CASH", method: "CASH", label: t("cash") },
    { key: "TELEBIRR", method: "TELEBIRR", label: t("telebirr") },
    { key: "CBE", method: "BANK_TRANSFER", label: "CBE" },
    { key: "OTHER_BANK", method: "BANK_TRANSFER", label: "OTHER BANK" },
  ];
  const availablePaymentMethods = paymentOptions.filter((option) =>
    enabledPaymentMethods.includes(option.method) || enabledPaymentMethods.includes(option.key),
  );
  const selectedPaymentOption = availablePaymentMethods.find((option) => option.key === paymentMethod) || availablePaymentMethods[0] || paymentOptions[0];
  const paymentAccountsForOption = accountList.filter((account) => accountMatchesPaymentOption(account, selectedPaymentOption));
  const selectedPaymentAccount = paymentAccountsForOption.find((account) => account.id === selectedPaymentAccountId) || paymentAccountsForOption[0] || null;
  const refreshActivePaymentAccounts = useCallback(() => {
    startAccountTransition(async () => {
      try {
        const result = await getActivePaymentAccounts();
        setAccountList(result.accounts);
      } catch (error) {
        setPaymentError(error?.message || "Unable to load payment accounts.");
      }
    });
  }, []);

  const openPayment = useCallback(() => {
    setPaymentError("");
    setPaymentMessage("");
    setPendingPaymentId("");
    setPendingPaymentStatus("");
    setPaymentReference("");
    setCashReceived("");
    setSelectedPaymentAccountId("");
    setPaymentOpen(true);
    refreshActivePaymentAccounts();
  }, [refreshActivePaymentAccounts]);

  function openAccountForm(account = null, type = "TELEBIRR") {
    setAccountError("");
    setAccountToEdit(account);
    setAccountFormType(account?.type === "BANK_TRANSFER" ? (account.verify_et_provider === "cbe" ? "CBE" : "OTHER_BANK") : type);
    setAccountFormOpen(true);
  }

  function handleAccountSave(event) {
    event.preventDefault();
    if (accountFormType === "CASH") {
      setAccountError("CASH does not require a payment account.");
      return;
    }
    const formData = new FormData(event.currentTarget);
    const type = accountFormType === "TELEBIRR" ? "TELEBIRR" : "BANK_TRANSFER";
    formData.set("type", type);
    formData.set("name", accountFormType === "TELEBIRR" ? "Telebirr" : accountFormType === "CBE" ? "CBE" : "Other Bank");
    formData.set("verify_et_provider", accountFormType === "TELEBIRR"
      ? "telebirr"
      : accountFormType === "CBE"
        ? "cbe"
        : accountToEdit?.verify_et_provider || "");
    formData.set("is_active", "on");
    if (accountToEdit?.id) formData.set("id", accountToEdit.id);
    setAccountError("");
    startAccountTransition(async () => {
      try {
        const result = await saveBankAccount(formData);
        setAccountList((current) => {
          const withoutSaved = current.filter((account) => account.id !== result.account.id);
          return [result.account, ...withoutSaved];
        });
        setSelectedPaymentAccountId(result.account.id);
        setPaymentMethod(accountFormType === "TELEBIRR" ? "TELEBIRR" : accountFormType);
        setAccountToEdit(null);
        setAccountFormOpen(false);
        setPaymentMessage(result.message);
        router.refresh();
      } catch (error) {
        setAccountError(error?.message || "Unable to save this payment account.");
      }
    });
  }

  function handleCashPayment(event) {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);
    setPaymentError("");
    startPaymentTransition(async () => {
      try {
        const result = await recordPayment(formData);
        setPendingPaymentStatus("COMPLETED");
        setPaymentMessage(t("paymentConfirmed"));
        router.push(`/receipts/${result?.orderId || state.orderId}`);
      } catch (error) {
        if (error?.message === "An active payment already exists for this order.") router.refresh();
        setPaymentError(paymentActionError(error, t));
      }
    });
  }

  function handlePendingPayment(event) {
    event.preventDefault();
    if (!paymentReference.trim()) {
      setPaymentError(t("referenceRequiredError"));
      return;
    }
    const formData = new FormData(event.currentTarget);
    formData.set("reference_number", paymentReference.trim());
    setPaymentError("");
    startPaymentTransition(async () => {
      try {
        const result = await createPendingPayment(formData);
        setPendingPaymentId(result.paymentId);
        setPendingPaymentStatus("PENDING");
      } catch (error) {
        if (error?.message === "An active payment already exists for this order.") router.refresh();
        setPaymentError(paymentActionError(error, t));
      }
    });
  }

  function confirmPendingPayment() {
    const formData = new FormData();
    formData.set("payment_id", pendingPaymentId);
    formData.set("decision", "COMPLETED");
    formData.set("note", paymentReference.trim());
    setPaymentError("");
    startPaymentTransition(async () => {
      try {
        const result = await resolvePendingPayment(formData);
        setPendingPaymentStatus("COMPLETED");
        setPaymentMessage(result?.message || t("paymentConfirmed"));
        router.push(`/receipts/${result?.orderId || state.orderId}`);
      } catch (error) {
        setPaymentError(paymentActionError(error, t));
      }
    });
  }

  useEffect(() => {
    if (!state.success || !state.orderId || refreshedOrderId.current === state.orderId) return;
    refreshedOrderId.current = state.orderId;
    setCart([]);
    setSelectedTableId("");
    setNotes("");
    openPayment();
    router.refresh();
  }, [openPayment, router, state.orderId, state.success]);

  function handleOrderTypeChange(nextOrderType) {
    setOrderType(nextOrderType);
    if (nextOrderType !== "DINE_IN") {
      setSelectedTableId("");
      return;
    }
    const eligibleTable = tables.find((table) => table.status === "AVAILABLE");
    setSelectedTableId(eligibleTable?.id || "");
  }

  const categoryList = useMemo(
    () => [{ id: "ALL", name: t("allItems") }, ...(categories || [])],
    [categories, t],
  );
  const categoryNames = useMemo(
    () => new Map((categories || []).map((category) => [category.id, category.name])),
    [categories],
  );
  const filteredItems = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();
    return (menuItems || []).filter((item) => {
      const matchesCategory = selectedCategory === "ALL" || item.category_id === selectedCategory;
      const haystack = `${item.name} ${item.description || ""} ${item.station || ""}`.toLowerCase();
      return matchesCategory && (!query || haystack.includes(query));
    });
  }, [menuItems, searchQuery, selectedCategory]);
  const subtotal = cartTotal(cart);
  const activeCartTotal = cart.length ? subtotal : 0;
  const paymentTotal = state.orderTotal == null ? activeCartTotal : Number(state.orderTotal);
  const cashChange = Math.max(Number(cashReceived || 0) - paymentTotal, 0);
  const selectedTable = tables.find((table) => table.id === selectedTableId) || null;
  const selectedTableRequired = orderType === "DINE_IN";

  function addItemToCart(item) {
    const price = Number(item.price);
    if (!Number.isFinite(price)) {
      setCheckoutError(`Unable to add ${item.name}: its price is invalid.`);
      return;
    }
    setCheckoutError("");
    setCart((current) => {
      const existing = current.find((entry) => entry.id === item.id);
      if (existing) {
        return current.map((entry) =>
          entry.id === item.id ? { ...entry, quantity: entry.quantity + 1 } : entry,
        );
      }
      return [...current, {
        id: item.id,
        name: item.name,
        price,
        quantity: 1,
        station: item.station || "KITCHEN",
      }];
    });
  }

  function updateQuantity(itemId, nextQuantity) {
    setCheckoutError("");
    setCart((current) => nextQuantity <= 0
      ? current.filter((entry) => entry.id !== itemId)
      : current.map((entry) => entry.id === itemId ? { ...entry, quantity: nextQuantity } : entry));
  }

  function handleOrderSubmit(formData) {
    if (!cart.length) {
      setCheckoutError(t("emptyCartError"));
      return;
    }
    const invalidItem = cart.find((item) => !Number.isFinite(Number(item.price)) || !Number.isInteger(item.quantity) || item.quantity < 1);
    if (invalidItem) {
      setCheckoutError(`${t("invalidItemError")} ${invalidItem.name}`);
      return;
    }
    const total = cartTotal(cart);
    if (!Number.isFinite(total) || total <= 0) {
      setCheckoutError(t("invalidOrderTotalError"));
      return;
    }
    setCheckoutError("");
    formAction(formData);
  }

  return (
    <div className="server-pos-shell">
      <style>{`
        .server-pos-shell { background: #08090b; color: #f8fafc; min-height: 100vh; overflow-x: hidden; padding: 28px clamp(16px, 3vw, 48px) 64px; }
        .server-pos { margin: 0 auto; max-width: 1500px; }
        .server-pos-header { align-items: end; display: flex; justify-content: space-between; gap: 24px; margin-bottom: 28px; }
        .server-pos-brand { color: #5ee7f2; font-size: 11px; font-weight: 800; letter-spacing: .2em; text-transform: uppercase; }
        .server-pos-header h1 { font-size: clamp(30px, 4vw, 52px); letter-spacing: -.05em; margin: 8px 0; }
        .server-pos-header p { color: #94a3b8; margin: 0; }
        .server-pos-grid { display: grid; grid-template-columns: minmax(0, 1.6fr) minmax(320px, .8fr); gap: 20px; }
        .server-pos-panel { background: #111317; border: 1px solid #262b33; border-radius: 14px; box-shadow: 0 18px 45px rgba(0, 0, 0, .24); padding: 20px; }
        .server-pos-panel h2 { font-size: 20px; letter-spacing: -.03em; margin: 0; }
        .server-pos-section-heading { align-items: center; display: flex; justify-content: space-between; gap: 16px; margin-bottom: 18px; }
        .server-pos-label { color: #94a3b8; display: block; font-size: 11px; font-weight: 700; letter-spacing: .1em; margin-bottom: 7px; text-transform: uppercase; }
        .server-pos-input, .server-pos-textarea { background: #0b0d10; border: 1px solid #303742; border-radius: 8px; box-sizing: border-box; color: #f8fafc; font: inherit; min-height: 42px; padding: 10px 12px; width: 100%; }
        .server-pos-input:focus, .server-pos-textarea:focus { border-color: #5ee7f2; outline: 2px solid rgba(94, 231, 242, .18); }
        .server-pos-toolbar { display: grid; grid-template-columns: minmax(180px, 1fr) auto; gap: 12px; margin-bottom: 16px; }
        .server-pos-filter-list { display: flex; flex-wrap: wrap; gap: 8px; margin-bottom: 20px; }
        .server-pos-filter { background: transparent; border: 1px solid #303742; border-radius: 999px; color: #cbd5e1; cursor: pointer; padding: 8px 13px; }
        .server-pos-filter.active { background: #5ee7f2; border-color: #5ee7f2; color: #071014; font-weight: 800; }
        .server-pos-menu { display: grid; grid-template-columns: repeat(auto-fill, minmax(210px, 1fr)); gap: 12px; }
        .server-pos-menu-item { background: #0b0d10; border: 1px solid #252b33; border-radius: 11px; display: grid; gap: 12px; overflow: hidden; padding-bottom: 12px; }
        .server-pos-menu-image { aspect-ratio: 16 / 10; background: #171b21; color: #64748b; display: grid; object-fit: cover; place-items: center; width: 100%; }
        .server-pos-menu-body { display: grid; gap: 9px; padding: 0 12px; }
        .server-pos-menu-title { align-items: start; display: flex; gap: 10px; justify-content: space-between; }
        .server-pos-menu-title h3 { font-size: 15px; margin: 0; }
        .server-pos-price { color: #5ee7f2; font-size: 13px; font-weight: 800; white-space: nowrap; }
        .server-pos-meta { color: #94a3b8; display: flex; font-size: 11px; gap: 8px; }
        .server-pos-station { color: #e2e8f0; font-size: 11px; font-weight: 800; letter-spacing: .08em; text-transform: uppercase; }
        .server-pos-add, .server-pos-submit { background: #5ee7f2; border: 0; border-radius: 8px; color: #071014; cursor: pointer; font-weight: 800; padding: 11px 13px; }
        .server-pos-add:hover, .server-pos-submit:hover { background: #8af0f7; }
        .server-pos-add { width: 100%; }
        .server-pos-setup { display: grid; gap: 18px; }
        .server-pos-order-types { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 8px; }
        .server-pos-order-type { background: #0b0d10; border: 1px solid #303742; border-radius: 9px; color: #cbd5e1; cursor: pointer; font-size: 12px; font-weight: 800; min-height: 44px; padding: 10px 6px; transition: background .18s ease, border-color .18s ease, box-shadow .18s ease, color .18s ease; }
        .server-pos-order-type:hover { background: #161c22 !important; border-color: #5ee7f2 !important; color: #f8fafc !important; }
        .server-pos-order-type.active { background: rgba(94, 231, 242, .14) !important; border-color: #5ee7f2 !important; box-shadow: 0 0 18px rgba(94, 231, 242, .16); color: #f8fafc !important; }
        .server-pos-table-grid { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 10px; }
        .server-pos-table-grid { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 8px; }
        .server-pos-shell button.server-pos-table { align-content: start; background: #0b0d10 !important; border: 1px solid #303742 !important; border-radius: 10px !important; color: #fff !important; cursor: pointer; display: grid; gap: 5px; min-height: 112px; opacity: 1 !important; padding: 12px; position: relative; text-align: left; transition: border-color .18s ease, box-shadow .18s ease, transform .18s ease, background .18s ease; }
        .server-pos-shell button.server-pos-table > strong, .server-pos-shell button.server-pos-table > .server-pos-table-name { color: #fff !important; -webkit-text-fill-color: #fff !important; }
        .server-pos-shell .server-pos-table-check { color: #071014 !important; }
        .server-pos-shell button.server-pos-table:disabled { cursor: not-allowed; filter: saturate(.72); opacity: .58 !important; }
        .server-pos-shell button.server-pos-table.available { background: rgba(34, 197, 94, .18) !important; border-color: rgba(34, 197, 94, .9) !important; }
        .server-pos-shell button.server-pos-table.occupied { background: rgba(239, 68, 68, .16) !important; border-color: rgba(239, 68, 68, .85) !important; }
        .server-pos-shell button.server-pos-table.reserved { background: rgba(234, 179, 8, .16) !important; border-color: rgba(234, 179, 8, .9) !important; }
        .server-pos-shell button.server-pos-table.cleaning { background: rgba(59, 130, 246, .16) !important; border-color: rgba(59, 130, 246, .9) !important; }
        .server-pos-shell .server-pos-table:not(:disabled):hover { background: rgba(34, 197, 94, .26) !important; border-color: #4ade80 !important; color: #f8fafc !important; transform: translateY(-1px); }
        .server-pos-shell .server-pos-table.available:disabled:hover { background: rgba(34, 197, 94, .18) !important; border-color: rgba(34, 197, 94, .9) !important; }
        .server-pos-shell .server-pos-table.occupied:disabled:hover { background: rgba(239, 68, 68, .16) !important; border-color: rgba(239, 68, 68, .85) !important; }
        .server-pos-shell .server-pos-table.reserved:disabled:hover { background: rgba(234, 179, 8, .16) !important; border-color: rgba(234, 179, 8, .9) !important; }
        .server-pos-shell .server-pos-table.cleaning:disabled:hover { background: rgba(59, 130, 246, .16) !important; border-color: rgba(59, 130, 246, .9) !important; }
        .server-pos-shell .server-pos-table:disabled:hover { color: #f8fafc !important; transform: none; }
        .server-pos-shell .server-pos-table.selected, .server-pos-shell .server-pos-table.selected:hover { background: rgba(94, 231, 242, .2) !important; border: 2px solid #5ee7f2 !important; box-shadow: 0 0 0 2px rgba(94, 231, 242, .3), 0 0 22px rgba(94, 231, 242, .2); color: #f8fafc !important; padding: 11px; }
        .server-pos-table-check { align-items: center; color: #071014; display: flex; font-size: 10px; font-weight: 900; height: 20px; justify-content: center; letter-spacing: .08em; min-width: 20px; }
        .server-pos-table.selected .server-pos-table-check { background: #5ee7f2; border-radius: 999px; }
        .server-pos-table strong, .server-pos-table span { display: block; }
        .server-pos-table strong { font-size: 18px; }
        .server-pos-table-name { color: #f8fafc; font-size: 12px; margin-top: 0; }
        .server-pos-table-status { border: 1px solid; border-radius: 999px; font-size: 10px; font-weight: 800; justify-self: start; margin-top: 2px; padding: 4px 7px; text-transform: uppercase; }
        .server-pos-shell .server-pos-table-status.available { background: rgba(34, 197, 94, .22) !important; border-color: #4ade80 !important; color: #bbf7d0 !important; }
        .server-pos-shell .server-pos-table-status.occupied { background: rgba(239, 68, 68, .22) !important; border-color: #f87171 !important; color: #fecaca !important; }
        .server-pos-shell .server-pos-table-status.reserved { background: rgba(234, 179, 8, .22) !important; border-color: #facc15 !important; color: #fef08a !important; }
        .server-pos-shell .server-pos-table-status.cleaning { background: rgba(59, 130, 246, .22) !important; border-color: #60a5fa !important; color: #bfdbfe !important; }
        .server-pos-selected-summary { display: grid; gap: 5px; margin: 12px 0 0; }
        .server-pos-selected-summary strong { color: #f8fafc; font-size: 14px; }
        .server-pos-selected-summary .server-pos-table-status { margin: 0; }
        .server-pos-legend { color: #94a3b8; display: flex; flex-wrap: wrap; font-size: 11px; gap: 9px 12px; }
        .server-pos-legend span::before { border-radius: 50%; content: ""; display: inline-block; height: 7px; margin-right: 5px; width: 7px; }
        .server-pos-legend .available::before { background: #22c55e; } .server-pos-legend .occupied::before { background: #ef4444; } .server-pos-legend .reserved::before { background: #eab308; } .server-pos-legend .cleaning::before { background: #3b82f6; }
        .server-pos-status-editor { display: grid; gap: 6px; margin-top: 7px; }
        .server-pos-status-editor select, .server-pos-status-editor button { background: #0b0d10; border: 1px solid #303742; border-radius: 7px; color: #f8fafc; padding: 7px; }
        .server-pos-status-editor button { cursor: pointer; }
        .server-pos-cart { border-top: 1px solid #262b33; display: grid; gap: 12px; padding-top: 16px; }
        .server-pos-cart-row { align-items: center; border-bottom: 1px solid #262b33; display: grid; gap: 10px; grid-template-columns: 1fr auto; padding-bottom: 12px; }
        .server-pos-cart-row strong { font-size: 14px; }
        .server-pos-cart-row small { color: #94a3b8; display: block; margin-top: 4px; }
        .server-pos-quantity { align-items: center; display: flex; gap: 8px; }
        .server-pos-quantity button, .server-pos-remove { background: #20252d; border: 0; border-radius: 6px; color: #f8fafc; cursor: pointer; height: 28px; width: 28px; }
        .server-pos-remove { color: #fca5a5; font-size: 16px; }
        .server-pos-totals { display: grid; gap: 8px; margin-top: 2px; }
        .server-pos-total-row { align-items: center; color: #cbd5e1; display: flex; justify-content: space-between; }
        .server-pos-total-row.total { border-top: 1px solid #303742; color: #f8fafc; font-size: 20px; font-weight: 900; padding-top: 14px; }
        .server-pos-total-row.total strong { color: #5ee7f2; font-size: 24px; }
        .server-pos-submit { font-size: 14px; margin-top: 2px; width: 100%; }
        .server-pos-submit:disabled { cursor: not-allowed; opacity: .45; }
        .server-pos-message { border-radius: 8px; font-size: 13px; padding: 10px 12px; }
        .server-pos-message.error { background: rgba(239, 68, 68, .14); color: #fca5a5; }
        .server-pos-message.success { background: rgba(34, 197, 94, .14); color: #86efac; }
        .server-pos-payment { background: #0b0d10; border: 1px solid #303742; border-radius: 10px; display: grid; gap: 14px; padding: 16px; }
        .server-pos-payment-heading { align-items: start; display: flex; justify-content: space-between; gap: 12px; }
        .server-pos-payment-heading h3 { font-size: 16px; margin: 0; }
        .server-pos-payment-close { background: transparent !important; border: 1px solid #303742 !important; border-radius: 7px; color: #cbd5e1 !important; cursor: pointer; padding: 6px 9px; }
        .server-pos-payment-close:hover { background: #161c22 !important; border-color: #5ee7f2 !important; color: #fff !important; }
        .server-pos-payment-summary { align-items: center; background: #11171b; border: 1px solid #262b33; border-radius: 8px; display: flex; justify-content: space-between; padding: 12px; }
        .server-pos-payment-summary strong { color: #5ee7f2; font-size: 20px; }
        .server-pos-payment-methods { display: flex; flex-wrap: wrap; gap: 7px; }
        .server-pos-payment-method { background: #151a1f !important; border: 1px solid #303742 !important; border-radius: 7px; color: #cbd5e1 !important; cursor: pointer; padding: 9px 10px; }
        .server-pos-payment-method.active { background: rgba(94, 231, 242, .14) !important; border-color: #5ee7f2 !important; color: #fff !important; }
        .server-pos-payment-account { background: rgba(94, 231, 242, .06); border: 1px solid rgba(94, 231, 242, .35); border-radius: 8px; display: grid; gap: 5px; padding: 12px; }
        .server-pos-payment-account strong { color: #f8fafc; }
        .server-pos-payment-account span { color: #5ee7f2; font-size: 18px; font-weight: 800; overflow-wrap: anywhere; }
        .server-pos-payment-form { display: grid; gap: 10px; }
        .server-pos-payment-form label { color: #cbd5e1; display: grid; font-size: 12px; gap: 6px; }
        .server-pos-payment-status { color: #cbd5e1; font-size: 12px; margin: 0; }
        .server-pos-payment-status strong { color: #f8fafc; }
        .server-pos-account-manager { border-top: 1px solid #262b33; display: grid; gap: 10px; padding-top: 14px; }
        .server-pos-account-manager-heading { align-items: center; display: flex; justify-content: space-between; gap: 12px; }
        .server-pos-account-manager-heading strong { color: #f8fafc; font-size: 13px; }
        .server-pos-account-action { background: transparent !important; border: 1px solid #303742 !important; border-radius: 7px; color: #cbd5e1 !important; cursor: pointer; padding: 8px 10px; }
        .server-pos-account-action:hover { background: #161c22 !important; border-color: #5ee7f2 !important; color: #fff !important; }
        .server-pos-account-list { display: grid; gap: 7px; }
        .server-pos-account-row { align-items: center; background: #11171b; border: 1px solid #262b33; border-radius: 7px; display: flex; justify-content: space-between; gap: 10px; padding: 9px 10px; }
        .server-pos-account-row span { color: #94a3b8; font-size: 11px; }
        .server-pos-account-row strong { color: #f8fafc; font-size: 12px; }
        .server-pos-account-form { background: #11171b; border: 1px solid #303742; border-radius: 8px; display: grid; gap: 10px; padding: 12px; }
        .server-pos-account-form label { color: #cbd5e1; display: grid; font-size: 11px; gap: 5px; }
        .server-pos-account-form-actions { display: flex; flex-wrap: wrap; gap: 8px; }
        .server-pos-account-form-actions button { flex: 1; min-width: 110px; }
        .server-pos-account-help { color: #94a3b8; font-size: 11px; margin: 0; }
        .server-pos-account-selector { display: grid; gap: 6px; }
        .server-pos-account-modal { align-items: center; background: rgba(0, 0, 0, .78); display: flex; inset: 0; justify-content: center; padding: 18px; position: fixed; z-index: 20; }
        .server-pos-account-dialog { background: #111317; border: 1px solid #3c4652; border-radius: 14px; box-shadow: 0 24px 80px rgba(0, 0, 0, .55); max-width: 500px; padding: 22px; width: 100%; }
        .server-pos-account-dialog-heading { align-items: start; display: flex; justify-content: space-between; gap: 16px; margin-bottom: 20px; }
        .server-pos-account-dialog-heading h3 { font-size: 22px; margin: 0; }
        .server-pos-account-dialog-heading p { color: #94a3b8; font-size: 12px; margin: 6px 0 0; }
        .server-pos-account-dialog-close { background: transparent; border: 1px solid #303742; border-radius: 7px; color: #cbd5e1; cursor: pointer; font-size: 20px; line-height: 1; padding: 5px 9px; }
        .server-pos-account-dialog-close:hover { border-color: #5ee7f2; color: #fff; }
        .server-pos-account-dialog-form { display: grid; gap: 14px; }
        .server-pos-account-dialog-form label { color: #cbd5e1; display: grid; font-size: 12px; font-weight: 700; gap: 7px; }
        .server-pos-account-dialog-actions { display: flex; gap: 10px; margin-top: 4px; }
        .server-pos-account-dialog-actions button { flex: 1; }
        .server-pos-account-cancel { background: transparent; border: 1px solid #303742; border-radius: 8px; color: #cbd5e1; cursor: pointer; font-weight: 800; padding: 11px 13px; }
        .server-pos-account-cancel:hover { border-color: #5ee7f2; color: #fff; }
        @media (max-width: 560px) { .server-pos-account-dialog { padding: 18px; } .server-pos-account-dialog-actions { flex-direction: column-reverse; } }
        @media (max-width: 980px) { .server-pos-grid { grid-template-columns: 1fr; } }
        @media (max-width: 560px) { .server-pos-header { align-items: start; display: block; } .server-pos-toolbar { grid-template-columns: 1fr; } .server-pos-panel { padding: 15px; } .server-pos-order-types { grid-template-columns: 1fr; } .server-pos-table-grid { grid-template-columns: 1fr 1fr; } }
      `}</style>

      <div className="server-pos">
        <header className="server-pos-header">
          <div>
            <div className="server-pos-brand">ADDIS RMS / V10</div>
            <h1>{restaurantName}</h1>
            <p>{t("createOrderDescription")}</p>
          </div>
          <div className="server-pos-brand">{t("serverPos")}</div>
        </header>

        <div className="server-pos-grid">
          <section className="server-pos-panel">
            <div className="server-pos-section-heading"><h2>{t("menu")}</h2><span className="server-pos-brand">{filteredItems.length} {t("items")}</span></div>
            <div className="server-pos-toolbar">
              <label><span className="server-pos-label">{t("search")}</span><input className="server-pos-input" value={searchQuery} onChange={(event) => setSearchQuery(event.target.value)} placeholder={t("searchMenuItems")} /></label>
              <div><span className="server-pos-label">{t("tables")}</span><div className="server-pos-legend"><span className="available">{t("available")}</span><span className="occupied">{t("occupied")}</span><span className="reserved">{t("reserved")}</span><span className="cleaning">{t("cleaning")}</span></div></div>
            </div>
            <div className="server-pos-filter-list">{categoryList.map((category) => <button type="button" key={category.id} className={`server-pos-filter ${selectedCategory === category.id ? "active" : ""}`} onClick={() => setSelectedCategory(category.id)}>{category.name}</button>)}</div>
            <div className="server-pos-menu">
              {filteredItems.map((item) => <article className="server-pos-menu-item" key={item.id}>
                <MenuItemImage
                  src={item.image_url}
                  alt={item.name}
                  imageClassName="server-pos-menu-image"
                  fallbackClassName="server-pos-menu-image"
                />
                <div className="server-pos-menu-body">
                  <div className="server-pos-menu-title"><h3>{item.name}</h3><span className="server-pos-price">{formatCurrency(item.price)}</span></div>
                  <div className="server-pos-meta"><span>{categoryNames.get(item.category_id) || t("menu")}</span><span>•</span><span className="server-pos-station">{item.station === "BAR" ? t("bar") : t("kitchen")}</span></div>
                  <button type="button" className="server-pos-add" onClick={() => addItemToCart(item)}>{t("addToCart")}</button>
                </div>
              </article>)}
              {!filteredItems.length && <p>{t("noMenuItems")}</p>}
            </div>
          </section>

          <aside className="server-pos-panel">
            <div className="server-pos-section-heading"><h2>{t("newOrder")}</h2><span className="server-pos-brand">{cart.length} {t("items")}</span></div>
            <div className="server-pos-setup">
              <div><span className="server-pos-label">{t("orderType")}</span><div className="server-pos-order-types">{[["DINE_IN", t("dineIn")], ["TAKEAWAY", t("takeaway")], ["DELIVERY", t("delivery")]].map(([value, label]) => <button type="button" key={value} className={`server-pos-order-type ${orderType === value ? "active" : ""}`} onClick={() => handleOrderTypeChange(value)}>{label}</button>)}</div></div>
              {selectedTableRequired && <div>
                <span className="server-pos-label">{t("selectTable")}</span>
                <div className="server-pos-table-grid">{tables.map((table) => {
                  const disabled = !selectedTableRequired || table.status !== "AVAILABLE";
                  return <div key={table.id}>
                    {table.status === "AVAILABLE" && <form action={updateTableStatus} className="server-pos-status-editor"><input type="hidden" name="id" value={table.id} /><label className="sr-only" htmlFor={`server-status-${table.id}`}>{t("tableStatus")}</label><select id={`server-status-${table.id}`} name="status" defaultValue="CLEANING"><option value="CLEANING">{t("cleaningStatus")}</option></select><button type="submit">{t("save")}</button></form>}
                    <button type="button" disabled={disabled} aria-pressed={selectedTableId === table.id} className={`server-pos-table ${tableStatusClasses[table.status] || ""} ${selectedTableId === table.id ? "selected" : ""}`} onClick={() => setSelectedTableId(table.id)}><span className="server-pos-table-check" aria-hidden="true">{selectedTableId === table.id ? "✓" : ""}</span><strong>#{table.table_number}</strong><span className="server-pos-table-name">{table.name || t("table")}</span><span className={`server-pos-table-status ${tableStatusClasses[table.status] || ""}`}>{t(`${table.status.toLowerCase()}Status`)}</span></button>
                    {["OCCUPIED", "CLEANING"].includes(table.status) && <form action={updateTableStatus} className="server-pos-status-editor"><input type="hidden" name="id" value={table.id} /><label className="sr-only" htmlFor={`server-status-${table.id}`}>{t("tableStatus")}</label><select id={`server-status-${table.id}`} name="status" defaultValue="AVAILABLE"><option value="AVAILABLE">{t("availableStatus")}</option></select><button type="submit">{t("save")}</button></form>}
                  </div>;
                })}</div>
                {selectedTableRequired && selectedTable ? <div className="server-pos-selected-summary"><span className="server-pos-label">{t("selectedTable")}</span><strong>#{selectedTable.table_number} · {selectedTable.name || t("table")}</strong><span className={`server-pos-table-status ${tableStatusClasses[selectedTable.status] || ""}`}>{t(`${selectedTable.status.toLowerCase()}Status`)}</span></div> : <p className="server-pos-meta">{selectedTableRequired ? t("noEligibleTable") : t("notRequiredTable")}</p>}
              </div>}
              <form action={handleOrderSubmit}>
                <input type="hidden" name="items" value={JSON.stringify(cart)} />
                <input type="hidden" name="order_type" value={orderType} />
                <input type="hidden" name="table_id" value={selectedTableRequired ? selectedTableId : ""} />
                <div className="server-pos-cart">
                {cart.length ? cart.map((item) => <div className="server-pos-cart-row" key={item.id}><div><strong>{item.name}</strong><small className="server-pos-station">{item.station === "BAR" ? t("bar") : t("kitchen")} · {formatCurrency(item.price)}</small></div><div className="server-pos-quantity"><button type="button" aria-label={`${t("decrease")} ${item.name}`} onClick={() => updateQuantity(item.id, item.quantity - 1)}>-</button><span>{item.quantity}</span><button type="button" aria-label={`${t("increase")} ${item.name}`} onClick={() => updateQuantity(item.id, item.quantity + 1)}>+</button><button type="button" className="server-pos-remove" aria-label={`${t("remove")} ${item.name}`} onClick={() => updateQuantity(item.id, 0)}>x</button></div></div>) : <p className="server-pos-meta">{t("cartEmpty")}</p>}
                </div>
                <label><span className="server-pos-label">{t("notes")}</span><textarea className="server-pos-textarea" name="notes" rows="3" value={notes} onChange={(event) => setNotes(event.target.value)} placeholder={t("guestNotes")} /></label>
                <div className="server-pos-totals"><div className="server-pos-total-row"><span>{t("subtotal")}</span><strong>{formatCurrency(activeCartTotal)}</strong></div><div className="server-pos-total-row total"><span>{t("total")}</span><strong>{formatCurrency(activeCartTotal)}</strong></div></div>
                {state.error && <div className="server-pos-message error" role="alert">{translateServerError(state.error, t)}</div>}
                {checkoutError && <div className="server-pos-message error" role="alert">{checkoutError}</div>}
                {state.existingOrder && <div className="server-pos-message error" role="alert"><p>{t("serverExistingOrderNotSubmitted").replace("{orderNumber}", state.existingOrder.order_number).replace("{amount}", formatCurrency(state.existingOrder.total))}</p><a href="/orders" target="_blank" rel="noreferrer">{t("orders")}</a></div>}
                {state.success && <div className="server-pos-message success" role="status">{t("orderCreatedDue")} {formatCurrency(state.orderTotal)}</div>}
                <button type="submit" className="server-pos-submit" disabled={pending || !cart.length || (selectedTableRequired && !selectedTableId)}>{pending ? t("creatingOrder") : t("createOrder")}</button>
              </form>
              {state.success && state.orderId && paymentOpen && <section className="server-pos-payment" aria-labelledby="server-payment-title">
                <div className="server-pos-payment-heading"><div><span className="server-pos-label">{t("payment")}</span><h3 id="server-payment-title">{t("completePayment")}</h3></div><button type="button" className="server-pos-payment-close" onClick={() => setPaymentOpen(false)}>{t("close")}</button></div>
                <div className="server-pos-payment-summary"><span>{t("orderNumber")}: {state.orderNumber || state.orderId}<br />{t("orderTotal")}</span><strong>{formatCurrency(paymentTotal)}</strong></div>
                <div className="server-pos-payment-methods">{availablePaymentMethods.map((option) => <button type="button" key={option.key} className={`server-pos-payment-method ${selectedPaymentOption.key === option.key ? "active" : ""}`} onClick={() => { setPaymentMethod(option.key); setSelectedPaymentAccountId(""); setPaymentError(""); setPendingPaymentId(""); setPendingPaymentStatus(""); setPaymentReference(""); refreshActivePaymentAccounts(); }}>{option.label}</button>)}</div>
                {canManagePaymentAccounts && <div className="server-pos-account-manager"><div className="server-pos-account-manager-heading"><strong>Manage Payment Accounts</strong><button type="button" className="server-pos-account-action" onClick={() => openAccountForm(null, selectedPaymentOption.key === "CASH" ? "TELEBIRR" : selectedPaymentOption.key)}>+ Add Account</button></div>{accountList.filter(isUsablePaymentAccount).map((account) => <div className="server-pos-account-row" key={account.id}><span>{account.name} · {account.account_number}</span><button type="button" className="server-pos-account-action" onClick={() => openAccountForm(account)}>Edit</button></div>)}</div>}
                {accountFormOpen && canManagePaymentAccounts && <div className="server-pos-account-modal" role="presentation"><div className="server-pos-account-dialog" role="dialog" aria-modal="true" aria-labelledby="server-account-dialog-title"><div className="server-pos-account-dialog-heading"><div><h3 id="server-account-dialog-title">{accountToEdit ? "Edit Payment Account" : "Add Payment Account"}</h3><p>Choose an account type and enter the details shown during payment.</p></div><button type="button" className="server-pos-account-dialog-close" aria-label="Close account dialog" onClick={() => { setAccountFormOpen(false); setAccountToEdit(null); setAccountError(""); }}>&times;</button></div><form className="server-pos-account-dialog-form" onSubmit={handleAccountSave}><label>Account type<select className="server-pos-input" value={accountFormType} onChange={(event) => setAccountFormType(event.target.value)}><option value="TELEBIRR">Telebirr</option><option value="CBE">CBE</option><option value="OTHER_BANK">Other Bank</option></select></label><label>Account Name<input className="server-pos-input" name="account_name" defaultValue={accountToEdit?.account_name || ""} required maxLength={160} /></label><label>Account Number<input className="server-pos-input" name="account_number" defaultValue={accountToEdit?.account_number || ""} required maxLength={80} /></label><p className="server-pos-account-help">CASH remains the existing cash payment flow and does not need an account.</p>{accountError && <div className="server-pos-message error" role="alert">{accountError}</div>}<div className="server-pos-account-dialog-actions"><button type="button" className="server-pos-account-cancel" onClick={() => { setAccountFormOpen(false); setAccountToEdit(null); setAccountError(""); }} disabled={accountPending}>Cancel</button><button type="submit" className="server-pos-submit" disabled={accountPending}>{accountPending ? "Saving..." : "Save"}</button></div></form></div></div>}
                {selectedPaymentOption.key === "CASH" ? <form className="server-pos-payment-form" onSubmit={handleCashPayment}>
                  <input type="hidden" name="order_id" value={state.orderId} />
                  <input type="hidden" name="amount" value={paymentTotal} />
                  <input type="hidden" name="method" value="CASH" />
                  <label>{t("cashReceived")}<input className="server-pos-input" name="cash_received" type="number" min={paymentTotal} step="0.01" value={cashReceived} onChange={(event) => setCashReceived(event.target.value)} required /></label>
                  <label>{t("changeAmount")}<input className="server-pos-input" value={formatCurrency(cashChange)} readOnly /></label>
                  <button type="submit" className="server-pos-submit" disabled={paymentPending}>{paymentPending ? t("recordingPayment") : t("confirmPayment")}</button>
                </form> : <>
                  {paymentAccountsForOption.length > 1 && <label className="server-pos-account-selector">Select account<select className="server-pos-input" value={selectedPaymentAccount?.id || ""} onChange={(event) => setSelectedPaymentAccountId(event.target.value)}>{paymentAccountsForOption.map((account) => <option value={account.id} key={account.id}>{account.name} · {account.account_number}</option>)}</select></label>}
                  <div className="server-pos-payment-account"><strong>{selectedPaymentOption.key === "TELEBIRR" ? t("payToTelebirr") : `Pay to ${selectedPaymentOption.label}`}</strong>{selectedPaymentAccount ? <><span>{selectedPaymentAccount.account_number}</span>{selectedPaymentAccount.account_name && <small>{selectedPaymentAccount.account_name}</small>}</> : accountPending ? <span>{t("loadingPaymentAccount")}</span> : <><span>{selectedPaymentOption.label} {t("accountNotConfigured")}</span>{!canManagePaymentAccounts && <small>{t("configureAccount")}</small>}</>}</div>
                  {!selectedPaymentAccount && canManagePaymentAccounts && <button type="button" className="server-pos-account-action" onClick={() => openAccountForm(null, selectedPaymentOption.key)}>+ Add {selectedPaymentOption.label} Account</button>}
                  <label className="server-pos-account-selector"><span>{t("transactionReference")}</span><input className="server-pos-input" value={paymentReference} onChange={(event) => setPaymentReference(event.target.value)} required /></label>
                  {!pendingPaymentId ? <form className="server-pos-payment-form" onSubmit={handlePendingPayment}><input type="hidden" name="order_id" value={state.orderId} /><input type="hidden" name="method" value={selectedPaymentOption.method} /><input type="hidden" name="account_id" value={selectedPaymentAccount?.id || ""} /><button type="submit" className="server-pos-submit" disabled={paymentPending || !selectedPaymentAccount || !paymentReference.trim()}>{paymentPending ? t("creatingPayment") : t("customerPaid")}</button></form> : <button type="button" className="server-pos-submit" onClick={confirmPendingPayment} disabled={paymentPending || pendingPaymentStatus === "COMPLETED" || !paymentReference.trim()}>{paymentPending ? t("confirmingPayment") : t("markAsPaid")}</button>}
                </>}
                <p className="server-pos-payment-status">{t("paymentStatus")}: <strong>{paymentStatusLabel(pendingPaymentStatus, t)}</strong></p>
                {paymentError && <div className="server-pos-message error" role="alert">{paymentError}</div>}
                {paymentMessage && <div className="server-pos-message success" role="status">{paymentMessage}</div>}
              </section>}
            </div>
          </aside>
        </div>
      </div>
    </div>
  );
}
