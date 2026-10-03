"use client";

import { useRef, useState } from "react";
import { useLanguage } from "../i18n/LanguageProvider";
import { refreshMenuImageUrl } from "./actions";

const MAX_IMAGE_BYTES = 5 * 1024 * 1024;

export function MenuFileInput({ id, name = "image", accept = ".jpg,.jpeg,image/jpeg" }) {
  const { t } = useLanguage();
  const inputRef = useRef(null);
  const [fileName, setFileName] = useState("");

  return (
    <div className="menu-file-picker">
      <input
        ref={inputRef}
        id={id}
        name={name}
        type="file"
        accept={accept}
        className="menu-file-input"
        onChange={(event) => setFileName(event.currentTarget.files?.[0]?.name || "")}
      />
      <button type="button" className="menu-file-button" onClick={() => inputRef.current?.click()}>
        {t("chooseFile")}
      </button>
      <span className="menu-file-name" aria-live="polite">
        {fileName || t("noFileChosen")}
      </span>
    </div>
  );
}

export function MenuItemImage({ src, alt, imageClassName, fallbackClassName }) {
  return (
    <MenuItemImageState
      key={src || ""}
      src={src}
      alt={alt}
      imageClassName={imageClassName}
      fallbackClassName={fallbackClassName}
    />
  );
}

function MenuItemImageState({ src, alt, imageClassName, fallbackClassName }) {
  const { t } = useLanguage();
  const [imageSrc, setImageSrc] = useState(src || null);
  const [missing, setMissing] = useState(!src);
  const [refreshError, setRefreshError] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const refreshAttempts = useRef(0);

  async function refreshImage() {
    if (!imageSrc || refreshing) return;
    if (refreshAttempts.current >= 2) {
      setRefreshError(true);
      return;
    }

    refreshAttempts.current += 1;
    setRefreshing(true);
    setRefreshError(false);
    try {
      const refreshedUrl = await refreshMenuImageUrl(imageSrc);
      if (!refreshedUrl) {
        setMissing(true);
        return;
      }
      setImageSrc(refreshedUrl);
    } catch {
      setRefreshError(true);
    } finally {
      setRefreshing(false);
    }
  }

  function retryImage() {
    refreshAttempts.current = 0;
    refreshImage();
  }

  if (missing) {
    return <div className={fallbackClassName}>{t("imageUnavailable")}</div>;
  }

  if (refreshError) {
    return (
      <div className={fallbackClassName} role="group" aria-label={t("imageUnavailable")}>
        <span>{t("imageUnavailable")}</span>
        <button type="button" onClick={retryImage} disabled={refreshing}>
          {refreshing ? t("imageRetrying") : t("imageRetry")}
        </button>
      </div>
    );
  }

  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      className={imageClassName}
      src={imageSrc}
      alt={alt}
      onError={refreshImage}
    />
  );
}

export function MenuActionFeedback({ errorCode }) {
  const { t } = useLanguage();
  if (errorCode !== "menuSaveFailed") return null;

  return <p className="form-error" role="alert">{t(errorCode)}</p>;
}

export default function MenuImageForm({ children, className }) {
  const { t } = useLanguage();
  const [error, setError] = useState("");

  function validateImage(event) {
    const file = event.currentTarget.elements.image?.files?.[0];
    setError("");

    if (!file) return true;
    if (file.type !== "image/jpeg" || !/\.(jpg|jpeg)$/i.test(file.name)) {
      setError(t("jpegOnlyError"));
      event.preventDefault();
      return false;
    }
    if (file.size > MAX_IMAGE_BYTES) {
      setError(t("imageTooLargeError"));
      event.preventDefault();
      return false;
    }
    return true;
  }

  return (
    <form className={className} action="/api/menu" method="post" encType="multipart/form-data" onSubmit={validateImage}>
      {children}
      {error && <p className="form-error" role="alert">{error}</p>}
    </form>
  );
}
