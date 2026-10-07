"use client";

import { useQueryClient } from "@tanstack/react-query";
import { usePathname } from "next/navigation";
import { usePostHog } from "posthog-js/react";
import { useEffect } from "react";
import { navigationTiming, routeShape } from "~/lib/navigation-timing";

/**
 * Reports how long a client navigation took: until the new page was on screen, and until the
 * data it asked for had arrived. Field data for where people wait between pages.
 */
export function NavigationTimingReporter() {
  const pathname = usePathname();
  const queryClient = useQueryClient();
  const posthog = usePostHog();

  useEffect(() => {
    const navigation = navigationTiming.take(pathname);
    if (!navigation) {
      return;
    }

    const committedAt = performance.now();
    let unsubscribe: (() => void) | undefined;

    const report = () => {
      unsubscribe?.();
      unsubscribe = undefined;
      if (!posthog.__loaded) {
        return;
      }
      posthog.capture("platform_navigation", {
        route: routeShape(pathname),
        navigation_type: navigation.type,
        committed_ms: Math.round(committedAt - navigation.startedAt),
        settled_ms: Math.round(performance.now() - navigation.startedAt),
      });
    };

    const isSettled = () => queryClient.isFetching() === 0;

    // The new page's queries start in this same commit, so look once they have.
    const timer = setTimeout(() => {
      if (isSettled()) {
        report();
        return;
      }
      unsubscribe = queryClient.getQueryCache().subscribe(() => {
        if (isSettled()) {
          report();
        }
      });
    }, 0);

    return () => {
      clearTimeout(timer);
      unsubscribe?.();
    };
  }, [pathname, posthog, queryClient]);

  return null;
}
