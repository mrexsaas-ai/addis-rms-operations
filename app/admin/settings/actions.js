"use server";

import { revalidatePath } from "next/cache";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getAuthContext, requireActiveRestaurantAccess } from "@/lib/auth";
import { normalizeVerifyEtProvider } from "@/lib/payments/verify-et-provider.mjs";

const adminRoles = ["ADMIN", "OWNER"];
const paymentMethods = ["CASH", "TELEBIRR", "BANK_TRANSFER"];
const languages = ["en", "am", "om", "ti"];
const accountTypes = ["BANK_TRANSFER", "TELEBIRR"];
const businessTypes = ["Restaurant", "Cafe", "Hotel", "Other food-service business"];

async function getAdminContext() {
  const supabase = await createSupabaseServerClient();
  const { user, membership } = await requireActiveRestaurantAccess(supabase);

  if (!user) throw new Error("You must be signed in.");
  if (!membership || !adminRoles.includes(membership.role)) {
    throw new Error("You do not have permission to manage settings.");
  }

  return { supabase, restaurantId: membership.restaurant_id };
}

function requiredText(formData, name, label, maxLength = 160) {
  const value = String(formData.get(name) || "").trim();
  if (!value) throw new Error(`${label} is required.`);
  if (value.length > maxLength) throw new Error(`${label} is too long.`);
  return value;
}

function optionalText(formData, name, maxLength = 255) {
  const value = String(formData.get(name) || "").trim();
  if (value.length > maxLength) throw new Error("One of the fields is too long.");
  return value || null;
}

function checkedMethods(formData) {
  const methods = paymentMethods.filter((method) => formData.get(method) === "on");
  if (!methods.length) throw new Error("Select at least one payment method.");
  return methods;
}

export async function saveSettings(formData) {
  const { supabase, restaurantId } = await getAdminContext();
  const name = requiredText(formData, "restaurant_name", "Business display name");
  const businessLegalName = requiredText(formData, "business_legal_name", "Business name");
  const businessType = String(formData.get("business_type") || "").trim();
  const phone = optionalText(formData, "phone", 40);
  const address = optionalText(formData, "address", 255);
  const logoUrl = optionalText(formData, "logo_url", 500);
  const defaultLanguage = String(formData.get("default_language") || "en");

  if (!languages.includes(defaultLanguage)) {
    throw new Error("Choose a supported application language.");
  }
  if (!businessTypes.includes(businessType)) {
    throw new Error("Business category is not supported.");
  }

  const { error: restaurantError } = await supabase
    .from("restaurants")
    .update({ name, business_legal_name: businessLegalName, description: businessType, phone, address, logo_url: logoUrl, updated_at: new Date().toISOString() })
    .eq("id", restaurantId);

  if (restaurantError) throw restaurantError;

  const { error: settingsError } = await supabase
    .from("restaurant_settings")
    .upsert(
      {
        restaurant_id: restaurantId,
        default_language: defaultLanguage,
        receipt_language: "en",
        enabled_payment_methods: checkedMethods(formData),
        updated_at: new Date().toISOString(),
      },
      { onConflict: "restaurant_id" }
    );

  if (settingsError) throw settingsError;

  revalidatePath("/admin/settings");
  revalidatePath("/admin");
  return { message: "Settings saved successfully." };
}

export async function saveBankAccount(formData) {
  const { supabase, restaurantId } = await getAdminContext();
  const id = optionalText(formData, "id", 80);
  const type = String(formData.get("type") || "BANK_TRANSFER");
  const submittedName = requiredText(formData, "name", "Bank name");
  const accountName = requiredText(formData, "account_name", "Account name");
  const accountNumber = requiredText(formData, "account_number", "Account number", 80);
  const branch = optionalText(formData, "branch", 120);
  const submittedProvider = String(formData.get("verify_et_provider") || "").trim().toLowerCase();

  if (!accountTypes.includes(type)) throw new Error("Choose a supported account type.");
  if (submittedProvider && !normalizeVerifyEtProvider(submittedProvider)) {
    throw new Error("Choose a supported Verify.et provider or leave it manual-only.");
  }
  if (type === "TELEBIRR" && submittedProvider && submittedProvider !== "telebirr") {
    throw new Error("Telebirr accounts must use the Telebirr provider.");
  }
  if (type === "BANK_TRANSFER" && submittedProvider === "telebirr") {
    throw new Error("Telebirr is not a bank-transfer provider.");
  }

  const name = type === "TELEBIRR" ? "Telebirr" : submittedName;
  const verifyEtProvider = type === "TELEBIRR" ? "telebirr" : submittedProvider || null;
  const isActive = type === "TELEBIRR" ? true : formData.get("is_active") === "on";

  const payload = {
    restaurant_id: restaurantId,
    type,
    name,
    account_name: accountName,
    account_number: accountNumber,
    branch,
    verify_et_provider: verifyEtProvider,
    is_active: isActive,
    updated_at: new Date().toISOString(),
  };

  const query = id
    ? supabase.from("payment_accounts").update(payload).eq("id", id).eq("restaurant_id", restaurantId)
    : supabase.from("payment_accounts").insert(payload);
  const { data: account, error } = await query
    .select("id, restaurant_id, type, name, account_name, account_number, branch, verify_et_provider, is_active")
    .maybeSingle();

  if (error) throw error;
  if (!account) throw new Error("The payment account was not saved for this restaurant.");

  revalidatePath("/admin/settings");
  revalidatePath("/server");
  return { message: id ? "Bank account updated." : "Bank account added.", account };
}

export async function getActivePaymentAccounts() {
  const supabase = await createSupabaseServerClient();
  const { user, membership } = await getAuthContext(supabase);

  if (!user) throw new Error("You must be signed in.");
  if (!membership || !["ADMIN", "OWNER", "MANAGER", "SERVER"].includes(membership.role)) {
    throw new Error("You do not have permission to read payment accounts.");
  }

  const { data: accounts, error: accountsError } = await supabase
    .from("payment_accounts")
    .select("id, restaurant_id, type, name, account_name, account_number, branch, verify_et_provider, qr_code_url, is_active")
    .eq("restaurant_id", membership.restaurant_id)
    .eq("is_active", true)
    .order("created_at", { ascending: false });

  if (accountsError) throw accountsError;
  return { accounts: accounts || [] };
}

export async function deleteBankAccount(formData) {
  const { supabase, restaurantId } = await getAdminContext();
  const id = requiredText(formData, "id", "Account ID", 80);
  const { error } = await supabase
    .from("payment_accounts")
    .delete()
    .eq("id", id)
    .eq("restaurant_id", restaurantId);

  if (error) throw error;

  revalidatePath("/admin/settings");
  return { message: "Bank account deleted." };
}
