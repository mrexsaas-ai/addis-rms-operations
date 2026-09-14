"use client";

import { useEffect, useState } from "react";

export default function MenuFilters({ categories, totalItems }) {
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
    <section className="catalog-toolbar" aria-label="Menu filters">
      <label className="catalog-search">
        <span>Search menu</span>
        <input
          type="search"
          placeholder="Search by item name..."
          value={query}
          onChange={(event) => setQuery(event.target.value)}
        />
      </label>
      <div className="filter-chips" role="group" aria-label="Filter by category">
        <button type="button" className={category === "ALL" ? "filter-chip active" : "filter-chip"} onClick={() => setCategory("ALL")}>
          All <span>{totalItems}</span>
        </button>
        {categories.map((item) => (
          <button type="button" className={category === item.id ? "filter-chip active" : "filter-chip"} key={item.id} onClick={() => setCategory(item.id)}>
            {item.name} <span>{item.count}</span>
          </button>
        ))}
      </div>
    </section>
  );
}
