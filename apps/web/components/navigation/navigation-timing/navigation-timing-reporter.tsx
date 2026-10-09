"use client";

import { useQueryClient } from "@tanstack/react-query";
import { usePathname } from "next/navigation";
import { useEffect, useRef } from "react";
import { navigationTiming, routeShape } from "~/lib/navigation-timing";
import { usePostHog } from "~/providers/posthog-context";

// Settled means this long with nothing fetching and no loading screen, the usual quiet window for
// timing single-page navigations. It also bridges a query that starts when another one lands.
const QUIET_MS = 100;
// A page that never goes quiet is reported as it stands after this.
const MAX_WAIT_MS = 30_000;

/**
 * Reports how long a client navigation took: until the new page was on screen, and until the
 * data it asked for had arrived. Field data for where people wait between pages.
 */
export function NavigationTimingReporter() {
  const pathname = usePathname();
  const queryClient = useQueryClient();
  // PostHog loads after the first render, so a navigation that settles later still reports.
  const posthog = usePostHog();
  const posthogRef = useRef(posthog);
  posthogRef.current = posthog;

  useEffect(() => {
    const navigation = navigationTiming.take(pathname);
    if (!navigation) {
      return;
    }

    const committedAt = performance.now();
    let lastQueryActivityAt = committedAt;
    let quietTimer: ReturnType<typeof setTimeout> | undefined;

    const isBusy = () => queryClient.isFetching() > 0 || navigationTiming.isLoadingScreenShown;

    const stop = () => {
      clearTimeout(quietTimer);
      clearTimeout(giveUpTimer);
      unsubscribe();
    };

    const report = () => {
      stop();
      const settledAt = Math.max(lastQueryActivityAt, navigationTiming.lastLoadingChangeAt);
      posthogRef.current?.capture("platform_navigation", {
        route: routeShape(pathname),
        navigation_type: navigation.type,
        committed_ms: Math.round(committedAt - navigation.startedAt),
        settled_ms: Math.round(settledAt - navigation.startedAt),
      });
    };

    const waitForQuiet = () => {
      clearTimeout(quietTimer);
      quietTimer = setTimeout(() => (isBusy() ? waitForQuiet() : report()), QUIET_MS);
    };

    const unsubscribe = queryClient.getQueryCache().subscribe(() => {
      lastQueryActivityAt = performance.now();
      waitForQuiet();
    });
    const giveUpTimer = setTimeout(report, MAX_WAIT_MS);
    waitForQuiet();

    return stop;
  }, [pathname, queryClient]);

  return null;
}
