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
    const sync = () => setStyle(read());
    window.addEventListener(CHANGE_EVENT, sync);
    window.addEventListener("storage", sync);
    return () => {
      window.removeEventListener(CHANGE_EVENT, sync);
      window.removeEventListener("storage", sync);
    };
  }, []);

  const updateStyle = useCallback((next: JsonFormatStyle) => {
    setStyle(next);
    try {
      window.localStorage.setItem(STORAGE_KEY, next);
    } catch {
      // Private mode or blocked storage; the in-memory preference still applies.
    }
    window.dispatchEvent(new Event(CHANGE_EVENT));
  }, []);

  const toggleStyle = useCallback(() => {
    updateStyle(styleRef.current === "compact" ? "expanded" : "compact");
  }, [updateStyle]);

  return { style, isHydrated, setStyle: updateStyle, toggleStyle };
}
