"use client";

import { useSyncExternalStore } from "react";

import { invalidateThemeTokenCache, readThemeColor } from "./utils";

type Subscriber = () => void;

const subscribers = new Set<Subscriber>();
let rootObserver: MutationObserver | undefined;

const PROBE_TOKENS = ["--foreground", "--card", "--chart-1"] as const;

let lastProbe: string | undefined;

/**
 * Class and tokens together: the class alone misses an inline override, the
 * tokens alone resolve empty without a stylesheet. Comparing it stops unrelated
 * root writes counting as a theme change.
 */
function themeProbe(): string {
  const tokens = PROBE_TOKENS.map((token) => readThemeColor(token) ?? "");
  return [document.documentElement.className, ...tokens].join("|");
}

/** A number, not the class string: charts use it as a memo dependency. */
let themeVersion = 0;

function themeVersionSnapshot(): number {
  return themeVersion;
}

function subscribeToThemeClass(subscriber: Subscriber): () => void {
  subscribers.add(subscriber);

  if (rootObserver === undefined) {
    rootObserver = new MutationObserver(() => {
      // Before probing: the probe reads through this cache.
      invalidateThemeTokenCache();

      const probe = themeProbe();
      if (probe === lastProbe) return;

      lastProbe = probe;
      themeVersion += 1;
      subscribers.forEach((notify) => notify());
    });
    rootObserver.observe(document.documentElement, {
      attributes: true,
      // `style` too: a token can be overridden inline on the root.
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
 * A token that changes when the CSS palette does. `next-themes` swaps the root
 * class in an effect after its context consumers render, so its context alone
 * fires too early. Anything memoising a resolved colour must put the returned
 * version in its dependency list.
 */
export function useChartThemeRefresh(): number {
  return useSyncExternalStore(subscribeToThemeClass, themeVersionSnapshot, () => 0);
}
