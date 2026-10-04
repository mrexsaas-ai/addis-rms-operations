"use client";

import { useLanguage } from "../i18n/LanguageProvider";

export function categoryTranslationKey(name) {
  const normalized = String(name || "").trim().toLowerCase().replace(/[_-]+/g, " ").replace(/\s+/g, " ");
  if (normalized === "fastfood" || normalized === "fast food") return "fastFoodCategory";
  if (normalized === "hotdrink" || normalized === "hot drink") return "hotDrinkCategory";
  if (normalized === "uncategorized") return "uncategorized";
  return "";
}

export function MenuCategoryLabel({ name }) {
  const { t } = useLanguage();
  const key = categoryTranslationKey(name);
  return key ? t(key) : name;
}

export function MenuCategoryOptions({ categories, includeUncategorized = true }) {
  const { t } = useLanguage();
  return (
    <>
      {includeUncategorized && <option value="">{t("uncategorized")}</option>}
      {categories.map((category) => {
        const key = categoryTranslationKey(category.name);
        return <option value={category.id} key={category.id}>{key ? t(key) : category.name}</option>;
      })}
    </>
  );
}
