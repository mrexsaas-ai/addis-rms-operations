"use server";

import { revalidatePath } from "next/cache";
import { createSupabaseServerClient } from "@/lib/supabase/server";

const adminRoles = ["ADMIN", "OWNER"];
const paymentMethods = ["CASH", "TELEBIRR", "BANK_TRANSFER"];
const languages = ["en", "am", "om", "ti"];
const accountTypes = ["BANK_TRANSFER", "TELEBIRR"];

async function getAdminContext() {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError) throw authError;
  if (!user) throw new Error("You must be signed in.");

  const { data: membership, error } = await supabase
    .from("restaurant_users")
    .select("restaurant_id, role")
    .eq("user_id", user.id)
    .limit(1)
    .maybeSingle();

  if (error) throw error;
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
  const name = requiredText(formData, "restaurant_name", "Restaurant name");
  const phone = optionalText(formData, "phone", 40);
  const address = optionalText(formData, "address", 255);
  const logoUrl = optionalText(formData, "logo_url", 500);
  const defaultLanguage = String(formData.get("default_language") || "en");

  if (!languages.includes(defaultLanguage)) {
    throw new Error("Choose a supported application language.");
  }

  const { error: restaurantError } = await supabase
    .from("restaurants")
    .update({ name, phone, address, logo_url: logoUrl, updated_at: new Date().toISOString() })
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
  const name = requiredText(formData, "name", "Bank name");
  const accountName = requiredText(formData, "account_name", "Account name");
  const accountNumber = requiredText(formData, "account_number", "Account number", 80);
  const branch = optionalText(formData, "branch", 120);
  const qrCodeUrl = optionalText(formData, "qr_code_url", 500);
  const isActive = formData.get("is_active") === "on";

  if (!accountTypes.includes(type)) throw new Error("Choose a supported account type.");

  const payload = {
    restaurant_id: restaurantId,
    type,
    name,
    account_name: accountName,
    account_number: accountNumber,
    branch,
    qr_code_url: qrCodeUrl,
    is_active: isActive,
    updated_at: new Date().toISOString(),
  };

  const query = id
    ? supabase.from("payment_accounts").update(payload).eq("id", id).eq("restaurant_id", restaurantId)
    : supabase.from("payment_accounts").insert(payload);
  const { error } = await query;

  if (error) throw error;

  revalidatePath("/admin/settings");
  return { message: id ? "Bank account updated." : "Bank account added." };
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
