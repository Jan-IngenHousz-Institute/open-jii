"use client";

import { useSyncExternalStore } from "react";

import { STATUS_HISTORY_DAYS } from "@repo/monitoring/status-document";

// Tailwind's `sm` breakpoint, from below. Narrower strips would leave bars too thin to tap.
const NARROW = "(width < 40rem)";
const NARROW_DAYS = 30;

function subscribe(onChange: () => void) {
  const query = window.matchMedia(NARROW);
  query.addEventListener("change", onChange);

  return () => query.removeEventListener("change", onChange);
}

function isNarrow() {
  return window.matchMedia(NARROW).matches;
}

export function useVisibleDays() {
  return useSyncExternalStore(subscribe, isNarrow) ? NARROW_DAYS : STATUS_HISTORY_DAYS;
}
