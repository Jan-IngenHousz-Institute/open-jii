"use client";

import { useSyncExternalStore } from "react";

import { invalidateThemeTokenCache } from "./utils";

type Subscriber = () => void;

const subscribers = new Set<Subscriber>();
let rootObserver: MutationObserver | undefined;

/**
 * Bumped once per theme change. A number rather than the class string because
 * charts use it as a memo dependency: the string is stable across a swap only
 * by accident, and it is the invalidation that matters, not its content.
 */
let themeVersion = 0;

function themeVersionSnapshot(): number {
  return themeVersion;
}

function subscribeToThemeClass(subscriber: Subscriber): () => void {
  subscribers.add(subscriber);

  if (rootObserver === undefined) {
    rootObserver = new MutationObserver(() => {
      // Before notifying, not after: the re-render this triggers reads tokens
      // synchronously, and a stale cache would hand it the outgoing palette.
      invalidateThemeTokenCache();
      themeVersion += 1;
      subscribers.forEach((notify) => notify());
    });
    rootObserver.observe(document.documentElement, {
      attributes: true,
      // `style` as well as `class`: a token can also move by being set inline on
      // the root, and the resolved palette is cached, so missing that would
      // leave every chart on the outgoing colours.
      attributeFilter: ["class", "style"],
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
 * Subscribe the calling chart to the class that supplies its CSS palette, and
 * return a token that changes when that palette does.
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
 * it directly. Anything that memoises a resolved colour must put the returned
 * version in its dependency list, or it keeps the outgoing theme's palette.
 */
export function useChartThemeRefresh(): number {
  return useSyncExternalStore(subscribeToThemeClass, themeVersionSnapshot, () => 0);
}
