"use client";

import { useEffect, useState } from "react";
import { useLanguage } from "../i18n/LanguageProvider";
import { MenuCategoryLabel } from "./MenuCategory";

export default function MenuFilters({ categories, totalItems }) {
  const { t } = useLanguage();
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState("ALL");

  useEffect(() => {
    const normalizedQuery = query.trim().toLowerCase();
    document.querySelectorAll("[data-menu-item]").forEach((card) => {
      const matchesQuery = !normalizedQuery || card.dataset.name.includes(normalizedQuery);
      const matchesCategory = category === "ALL" || card.dataset.category === category;
      card.hidden = !(matchesQuery && matchesCategory);
    });
  }, [category, query]);

  return (
    <section className="catalog-toolbar" aria-label={t("menuFilters")}>
      <label className="catalog-search">
        <span>{t("searchMenu")}</span>
        <input
          type="search"
          placeholder={t("searchByItem")}
          value={query}
          onChange={(event) => setQuery(event.target.value)}
        />
      </label>
      <div className="filter-chips" role="group" aria-label={t("filterByCategory")}>
        <button type="button" className={category === "ALL" ? "filter-chip active" : "filter-chip"} onClick={() => setCategory("ALL")}>
          <span>{t("all")}</span><span className="filter-count">{totalItems}</span>
        </button>
        {categories.map((item) => (
          <button type="button" className={category === item.id ? "filter-chip active" : "filter-chip"} key={item.id} onClick={() => setCategory(item.id)}>
            <span>{item.id === "UNCATEGORIZED" ? t("uncategorized") : <MenuCategoryLabel name={item.name} />}</span><span className="filter-count">{item.count}</span>
          </button>
        ))}
      </div>
    </section>
  );
}
