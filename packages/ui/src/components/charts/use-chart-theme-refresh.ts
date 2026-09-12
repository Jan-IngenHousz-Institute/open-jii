"use client";

import { useSyncExternalStore } from "react";

import { invalidateThemeTokenCache, readThemeColor } from "./utils";

type Subscriber = () => void;

const subscribers = new Set<Subscriber>();
let rootObserver: MutationObserver | undefined;

/** Read alongside the root class, to catch a token overridden inline. */
const PROBE_TOKENS = ["--foreground", "--card", "--chart-1"] as const;

let lastProbe: string | undefined;

/**
 * What a theme change actually moves: the root class, plus a few tokens in case
 * one was overridden inline. The class alone is not enough, and the tokens
 * alone are not either, since they resolve empty without a stylesheet.
 *
 * The point is to ignore every other write to those attributes. The alert
 * banner's ResizeObserver sets `--banner-offset` on the root and the flow
 * editor sets `overflow` there, and notifying on those would remount a contour
 * plot, which keys on the version, every time the banner reflowed.
 */
function themeProbe(): string {
  const tokens = PROBE_TOKENS.map((token) => readThemeColor(token) ?? "");
  return [document.documentElement.className, ...tokens].join("|");
}

/**
 * Bumped once per theme change. A number rather than the class string, because
 * charts use it as a memo dependency and it is the invalidation that matters.
 */
let themeVersion = 0;

function themeVersionSnapshot(): number {
  return themeVersion;
}

function subscribeToThemeClass(subscriber: Subscriber): () => void {
  subscribers.add(subscriber);

  if (rootObserver === undefined) {
    rootObserver = new MutationObserver(() => {
      // Before probing, not after: the probe reads through the same cache, and
      // a stale entry would report the outgoing palette as unchanged.
      invalidateThemeTokenCache();

      const probe = themeProbe();
      if (probe === lastProbe) return;

      lastProbe = probe;
      themeVersion += 1;
      subscribers.forEach((notify) => notify());
    });
    rootObserver.observe(document.documentElement, {
      attributes: true,
      // `style` as well as `class`: a token can also move by being set inline
      // on the root. The probe above is what keeps the unrelated writes to that
      // attribute from counting as a theme change.
      attributeFilter: ["class", "style"],
    });
    lastProbe = themeProbe();
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
 * Anything that memoises a resolved colour has to put the returned version in
 * its dependency list, or it keeps the outgoing theme's palette.
 */
export function useChartThemeRefresh(): number {
  return useSyncExternalStore(subscribeToThemeClass, themeVersionSnapshot, () => 0);
}
