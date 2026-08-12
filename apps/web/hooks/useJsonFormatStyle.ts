"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { JsonFormatStyle } from "~/lib/json-format";
import { DEFAULT_JSON_FORMAT_STYLE, isJsonFormatStyle } from "~/lib/json-format";

const STORAGE_KEY = "openjii.json-format-style";
const CHANGE_EVENT = "openjii:json-format-style";

function read(): JsonFormatStyle {
  try {
    const stored = window.localStorage.getItem(STORAGE_KEY);
    return isJsonFormatStyle(stored) ? stored : DEFAULT_JSON_FORMAT_STYLE;
  } catch {
    return DEFAULT_JSON_FORMAT_STYLE;
  }
}

/**
 * User-wide preference for how JSON documents are laid out. Starts at the default
 * so SSR and the first client render agree, then syncs from storage on mount.
 * Editors that seed a document from this preference should wait for `isHydrated`
 * so they lay the text out once instead of rewriting it a frame later.
 */
export function useJsonFormatStyle() {
  const [style, setStyle] = useState<JsonFormatStyle>(DEFAULT_JSON_FORMAT_STYLE);
  const [isHydrated, setIsHydrated] = useState(false);
  const styleRef = useRef(style);
  styleRef.current = style;

  useEffect(() => {
    setStyle(read());
    setIsHydrated(true);
    // Same-tab peers take the value off the event. Re-reading storage here would
    // hand back the default whenever storage access throws, cancelling the
    // choice the user just made.
    const onChange = (event: Event) => {
      const detail = (event as CustomEvent<JsonFormatStyle>).detail;
      setStyle(isJsonFormatStyle(detail) ? detail : read());
    };
    // Another tab wrote storage, so reading it is the only way to learn the
    // value. Only for our own key, though: any other tab writing any other key
    // would otherwise re-read, and if our own write had been blocked that would
    // discard the in-memory choice. A null key means the tab cleared storage.
    const onStorage = (event: StorageEvent) => {
      if (event.key === STORAGE_KEY || event.key === null) setStyle(read());
    };
    window.addEventListener(CHANGE_EVENT, onChange);
    window.addEventListener("storage", onStorage);
    return () => {
      window.removeEventListener(CHANGE_EVENT, onChange);
      window.removeEventListener("storage", onStorage);
    };
  }, []);

  const updateStyle = useCallback((next: JsonFormatStyle) => {
    setStyle(next);
    try {
      window.localStorage.setItem(STORAGE_KEY, next);
    } catch {
      // Private mode or blocked storage; the in-memory preference still applies.
    }
    window.dispatchEvent(new CustomEvent<JsonFormatStyle>(CHANGE_EVENT, { detail: next }));
  }, []);

  const toggleStyle = useCallback(() => {
    updateStyle(styleRef.current === "compact" ? "expanded" : "compact");
  }, [updateStyle]);

  return { style, isHydrated, setStyle: updateStyle, toggleStyle };
}
