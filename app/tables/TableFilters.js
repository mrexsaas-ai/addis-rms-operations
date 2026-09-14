"use client";

import { useEffect, useState } from "react";

const filters = [
  ["ALL", "All"],
  ["AVAILABLE", "Available"],
  ["OCCUPIED", "Occupied"],
  ["RESERVED", "Reserved"],
  ["CLEANING", "Cleaning"],
];

export default function TableFilters() {
  const [filter, setFilter] = useState("ALL");

  useEffect(() => {
    document.querySelectorAll("[data-table-status]").forEach((card) => {
      card.hidden = filter !== "ALL" && card.dataset.tableStatus !== filter;
    });
  }, [filter]);

  return (
    <div className="filter-chips" role="group" aria-label="Filter tables by status">
      {filters.map(([value, label]) => (
        <button type="button" className={filter === value ? "filter-chip active" : "filter-chip"} key={value} onClick={() => setFilter(value)}>
          {label}
        </button>
      ))}
    </div>
  );
}
