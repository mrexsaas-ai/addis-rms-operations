"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { useLanguage } from "@/app/i18n/LanguageProvider";
import { countRestaurantStatuses } from "@/lib/restaurant-lifecycle.mjs";
import { BUSINESS_TIME_ZONE } from "@/lib/business-date.mjs";
import { changeRestaurantStatus, getRestaurantStatusEvents } from "./actions";
import styles from "./platform.module.css";

const filters = [
  ["ALL", "platformFilterAll"],
  ["ACTIVE", "platformFilterActive"],
  ["INACTIVE", "platformFilterInactive"],
];

export default function PlatformDashboard({ restaurants }) {
  const { t } = useLanguage();
  const router = useRouter();
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState("ALL");
  const [selectedId, setSelectedId] = useState(restaurants[0]?.id || "");
  const [requestedStatus, setRequestedStatus] = useState(null);
  const [statusEvents, setStatusEvents] = useState(null);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [notice, setNotice] = useState("");
  const [isPending, startTransition] = useTransition();

  const summary = countRestaurantStatuses(restaurants);
  const matchingRestaurants = restaurants.filter((restaurant) => {
    if (filter !== "ALL" && restaurant.status !== filter) return false;
    const searchable = [restaurant.name, restaurant.businessLegalName, restaurant.ownerEmail]
      .filter(Boolean)
      .join(" ")
      .toLocaleLowerCase();
    return searchable.includes(search.trim().toLocaleLowerCase());
  });
  const selectedRestaurant = restaurants.find((restaurant) => restaurant.id === selectedId) || null;

  function confirmStatusChange() {
    if (!selectedRestaurant || !requestedStatus) return;

    startTransition(async () => {
      try {
        const result = await changeRestaurantStatus(selectedRestaurant.id, requestedStatus);
        setNotice(result?.changed
          ? requestedStatus === "ACTIVE" ? "platformRestaurantActivated" : "platformRestaurantDeactivated"
          : "platformStatusUnchanged");
        setRequestedStatus(null);
        router.refresh();
      } catch {
        setNotice("platformStatusChangeFailed");
        setRequestedStatus(null);
      }
    });
  }

  async function loadStatusHistory() {
    if (!selectedRestaurant) return;

    setHistoryLoading(true);
    try {
      setStatusEvents(await getRestaurantStatusEvents(selectedRestaurant.id));
    } catch {
      setNotice("platformHistoryLoadFailed");
    } finally {
      setHistoryLoading(false);
    }
  }

  function selectRestaurant(restaurantId) {
    setSelectedId(restaurantId);
    setStatusEvents(null);
    setNotice("");
  }

  return (
    <div className={styles.shell}>
      <header className={styles.header}>
        <div>
          <p className={styles.eyebrow}>{t("platformAreaLabel")}</p>
          <h1>{t("platformTitle")}</h1>
          <p className={styles.description}>{t("platformDescription")}</p>
        </div>
      </header>

      <section className={styles.summary} aria-label={t("platformSummary")}>
        <article className={styles.summaryItem}>
          <span>{t("platformTotalRestaurants")}</span>
          <strong>{summary.total}</strong>
        </article>
        <article className={styles.summaryItem}>
          <span>{t("platformActiveRestaurants")}</span>
          <strong>{summary.active}</strong>
        </article>
        <article className={styles.summaryItem}>
          <span>{t("platformInactiveRestaurants")}</span>
          <strong>{summary.inactive}</strong>
        </article>
      </section>

      {notice && <p className={styles.notice} role="status">{t(notice)}</p>}

      <section className={styles.workspace}>
        <div className={styles.listPane}>
          <div className={styles.toolbar}>
            <label className={styles.searchLabel}>
              <span className={styles.visuallyHidden}>{t("platformSearch")}</span>
              <input
                type="search"
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder={t("platformSearchPlaceholder")}
              />
            </label>
            <div className={styles.filters} role="group" aria-label={t("platformFilterRestaurants")}>
              {filters.map(([value, labelKey]) => (
                <button
                  type="button"
                  key={value}
                  className={filter === value ? styles.filterSelected : styles.filter}
                  aria-pressed={filter === value}
                  onClick={() => setFilter(value)}
                >
                  {t(labelKey)}
                </button>
              ))}
            </div>
          </div>

          <div className={styles.restaurantList}>
            {matchingRestaurants.map((restaurant) => (
              <button
                type="button"
                key={restaurant.id}
                className={restaurant.id === selectedId ? styles.restaurantSelected : styles.restaurantRow}
                aria-pressed={restaurant.id === selectedId}
                onClick={() => selectRestaurant(restaurant.id)}
              >
                <span className={styles.restaurantIdentity}>
                  <strong>{restaurant.name}</strong>
                  <small>{restaurant.businessLegalName || "—"}</small>
                </span>
                <span className={`${styles.status} ${restaurant.status === "ACTIVE" ? styles.statusActive : styles.statusInactive}`}>
                  {t(restaurant.status === "ACTIVE" ? "platformStatusActive" : "platformStatusInactive")}
                </span>
              </button>
            ))}
            {matchingRestaurants.length === 0 && (
              <p className={styles.empty}>{t(restaurants.length ? "platformNoMatches" : "platformNoRestaurants")}</p>
            )}
          </div>
        </div>

        <aside className={styles.details} aria-label={t("platformRestaurantDetails")}>
          {selectedRestaurant ? (
            <>
              <p className={styles.eyebrow}>{t("platformRestaurantDetails")}</p>
              <h2>{selectedRestaurant.name}</h2>
              <dl className={styles.detailList}>
                <div><dt>{t("platformBusinessName")}</dt><dd>{selectedRestaurant.businessLegalName || "—"}</dd></div>
                <div><dt>{t("platformOwnerEmail")}</dt><dd>{selectedRestaurant.ownerEmail || "—"}</dd></div>
                <div><dt>{t("platformCreated")}</dt><dd>{new Date(selectedRestaurant.createdAt).toLocaleDateString(undefined, { timeZone: BUSINESS_TIME_ZONE })}</dd></div>
                <div>
                  <dt>{t("platformStatus")}</dt>
                  <dd className={`${styles.status} ${selectedRestaurant.status === "ACTIVE" ? styles.statusActive : styles.statusInactive}`}>
                    {t(selectedRestaurant.status === "ACTIVE" ? "platformStatusActive" : "platformStatusInactive")}
                  </dd>
                </div>
              </dl>
              <button
                className={selectedRestaurant.status === "ACTIVE" ? styles.deactivateButton : styles.activateButton}
                type="button"
                onClick={() => setRequestedStatus(selectedRestaurant.status === "ACTIVE" ? "INACTIVE" : "ACTIVE")}
              >
                {t(selectedRestaurant.status === "ACTIVE" ? "platformDeactivate" : "platformActivate")}
              </button>
              <section className={styles.history} aria-label={t("platformStatusHistory")}>
                <div className={styles.historyHeading}>
                  <h3>{t("platformStatusHistory")}</h3>
                  <button type="button" className={styles.historyButton} disabled={historyLoading} onClick={loadStatusHistory}>
                    {t(historyLoading ? "platformSaving" : "platformLoadHistory")}
                  </button>
                </div>
                {statusEvents && (statusEvents.length ? (
                  <ol className={styles.historyList}>
                    {statusEvents.map((event) => (
                      <li key={event.id}>
                        <strong>{t(event.previous_status === "ACTIVE" ? "platformStatusActive" : "platformStatusInactive")} → {t(event.new_status === "ACTIVE" ? "platformStatusActive" : "platformStatusInactive")}</strong>
                        <time dateTime={event.created_at}>{new Date(event.created_at).toLocaleString(undefined, { timeZone: BUSINESS_TIME_ZONE })}</time>
                        <small>{t("platformActorId")}: {event.actor_user_id}</small>
                      </li>
                    ))}
                  </ol>
                ) : <p className={styles.historyEmpty}>{t("platformNoStatusEvents")}</p>)}
              </section>
            </>
          ) : (
            <p className={styles.empty}>{t("platformSelectRestaurant")}</p>
          )}
        </aside>
      </section>

      {requestedStatus && selectedRestaurant && (
        <div className={styles.dialogBackdrop} onMouseDown={(event) => {
          if (event.target === event.currentTarget && !isPending) setRequestedStatus(null);
        }}>
          <section className={styles.dialog} role="dialog" aria-modal="true" aria-labelledby="platform-confirm-title">
            <h2 id="platform-confirm-title">
              {t(requestedStatus === "INACTIVE" ? "platformConfirmDeactivateTitle" : "platformConfirmActivateTitle")}
            </h2>
            <p>
              {requestedStatus === "INACTIVE"
                ? t("platformConfirmDeactivateBody").replace("{restaurant}", selectedRestaurant.name)
                : t("platformConfirmActivateBody").replace("{restaurant}", selectedRestaurant.name)}
            </p>
            <div className={styles.dialogActions}>
              <button type="button" className={styles.cancelButton} disabled={isPending} onClick={() => setRequestedStatus(null)}>
                {t("platformCancel")}
              </button>
              <button type="button" className={styles.confirmButton} disabled={isPending} onClick={confirmStatusChange}>
                {t(isPending ? "platformSaving" : "platformConfirm")}
              </button>
            </div>
          </section>
        </div>
      )}
    </div>
  );
}