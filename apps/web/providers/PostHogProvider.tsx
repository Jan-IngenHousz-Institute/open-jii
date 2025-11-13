"use client";

import posthog from "posthog-js";
import { PostHogProvider as PostHogProviderBase } from "posthog-js/react";
import type { ReactNode } from "react";
import { useEffect } from "react";

import { env } from "../env";
import { POSTHOG_CLIENT_CONFIG } from "../lib/posthog-config";

/**
 * PostHog provider component that initializes the PostHog client
 * Should be placed at the root of the application to ensure tracking works
 *
 * @example
 * ```tsx
 * <PostHogProvider>
 *   <App />
 * </PostHogProvider>
 * ```
 */
export function PostHogProvider({ children }: { children: ReactNode }) {
  useEffect(() => {
    const posthogKey = env.NEXT_PUBLIC_POSTHOG_KEY;

    // Skip initialization if no valid key or already initialized
    if (!posthogKey || posthogKey.startsWith("phc_0000") || posthog.__loaded) {
      return;
    }
    posthog.init(posthogKey, POSTHOG_CLIENT_CONFIG);
  }, []);

  return <PostHogProviderBase client={posthog}>{children}</PostHogProviderBase>;
}
