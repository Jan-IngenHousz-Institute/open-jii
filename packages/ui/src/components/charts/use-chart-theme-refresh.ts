"use client";

import { useSyncExternalStore } from "react";

type Subscriber = () => void;

const subscribers = new Set<Subscriber>();
let rootObserver: MutationObserver | undefined;

function themeClassSnapshot(): string {
  return typeof document === "undefined" ? "" : document.documentElement.className;
}

function subscribeToThemeClass(subscriber: Subscriber): () => void {
  subscribers.add(subscriber);

  if (rootObserver === undefined) {
    rootObserver = new MutationObserver(() => {
      subscribers.forEach((notify) => notify());
    });
    rootObserver.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ["class"],
    });
  }

  return () => {
    subscribers.delete(subscriber);
    if (subscribers.size === 0) {
      rootObserver?.disconnect();
      rootObserver = undefined;
    }
  };
}

/**
 * Subscribe the calling chart to the class that supplies its CSS palette.
 *
 * Chart palettes are resolved from CSS custom properties (`--chart-1..5`,
 * `--foreground`, `--border`, ...) at render time because Plotly cannot
 * read a CSS variable. `next-themes` changes the root class in an effect after
 * its context consumers render, so its context alone is too early. This shared
 * external store notifies all charts after the class is actually applied while
 * allocating only one observer, regardless of chart count.
 *
 * Called inside `useChartSizing`, which every chart component already uses;
 * components that resolve theme colours without sizing (LollipopChart) call
 * it directly.
 */
export function useChartThemeRefresh(): void {
  useSyncExternalStore(subscribeToThemeClass, themeClassSnapshot, () => "");
}
