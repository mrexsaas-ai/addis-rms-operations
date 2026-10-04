"use client";

import { useEffect, useState } from "react";
import { useLanguage } from "../i18n/LanguageProvider";

const filters = [
  ["ALL", "all"],
  ["AVAILABLE", "available"],
  ["OCCUPIED", "occupied"],
  ["RESERVED", "reserved"],
  ["CLEANING", "cleaning"],
];

export default function TableFilters() {
  const { t } = useLanguage();
  const [filter, setFilter] = useState("ALL");

  useEffect(() => {
    document.querySelectorAll("[data-table-status]").forEach((card) => {
      card.hidden = filter !== "ALL" && card.dataset.tableStatus !== filter;
    });
  }, [filter]);

  return (
    <div className="filter-chips" role="group" aria-label={t("filterTablesByStatus")}>
      {filters.map(([value, label]) => (
        <button type="button" className={filter === value ? "filter-chip active" : "filter-chip"} key={value} onClick={() => setFilter(value)}>
          {t(label)}
        </button>
      ))}
    </div>
  );
}
