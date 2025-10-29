"use client";

import type { ReactNode } from "react";
import { useEffect, useRef, useState } from "react";

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
  const [isInitialized, setIsInitialized] = useState(false);
  const initAttempted = useRef(false);

  useEffect(() => {
    // Prevent double initialization in strict mode
    if (initAttempted.current) return;
    initAttempted.current = true;

    // Skip initialization if no valid key
    if (!env.NEXT_PUBLIC_POSTHOG_KEY || env.NEXT_PUBLIC_POSTHOG_KEY.startsWith("phc_0000")) {
      console.warn("[PostHog] Skipping initialization - no valid API key configured");
      setIsInitialized(true);
      return;
    }

    // Dynamic import to avoid Turbopack bundling issues
    void import("posthog-js")
      .then((posthogModule) => {
        const posthog = posthogModule.default;

        // Check if already initialized (hot reload)
        if (posthog.__loaded) {
          setIsInitialized(true);
          return;
        }

        posthog.init(env.NEXT_PUBLIC_POSTHOG_KEY, POSTHOG_CLIENT_CONFIG);
      })
      .catch((error) => {
        console.error("[PostHog] Failed to initialize:", error);
      })
      .finally(() => {
        setIsInitialized(true);
      });
  }, []);

  // Render children immediately to avoid blocking app render
  // Feature flags will be loaded asynchronously
  if (!isInitialized) {
    return <>{children}</>;
  }

  return <>{children}</>;
}
