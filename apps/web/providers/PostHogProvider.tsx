"use client";

import type { PostHog } from "posthog-js";
import type { ReactNode } from "react";
import { useEffect, useState } from "react";

import { env } from "../env";
import { getConsentStatus } from "../lib/cookie-consent";
import { loadPostHog } from "../lib/posthog-client";
import { POSTHOG_CLIENT_CONFIG } from "../lib/posthog-config";
import { PostHogContext } from "./posthog-context";

/**
 * PostHog provider component that initializes the PostHog client
 * Should be placed at the root of the application to ensure tracking works
 * Implements cookie consent management to comply with GDPR
 *
 * @example
 * ```tsx
 * <PostHogProvider>
 *   <App />
 * </PostHogProvider>
 * ```
 */
export function PostHogProvider({ children }: { children: ReactNode }) {
  const [client, setClient] = useState<PostHog | null>(null);

  useEffect(() => {
    const posthogKey = env.NEXT_PUBLIC_POSTHOG_KEY;

    // Skip initialization if no valid key
    if (!posthogKey || posthogKey.startsWith("phc_0000")) {
      return;
    }

    void loadPostHog().then((posthog) => {
      if (!posthog.__loaded) {
        // Get consent status from cookie
        const consentStatus = getConsentStatus();

        // Initialize PostHog with cookieless mode enabled by default
        // This ensures no cookies are set until user consents
        posthog.init(posthogKey, {
          ...POSTHOG_CLIENT_CONFIG,
          cookieless_mode: "on_reject", // Don't set cookies until opt-in
          persistence: consentStatus === "accepted" ? "localStorage+cookie" : "memory", // Use memory-only persistence until consent
          opt_out_capturing_by_default: consentStatus !== "accepted", // Don't capture events until consent
        });
      }
      setClient(posthog);
    });
  }, []);

  return <PostHogContext.Provider value={client}>{children}</PostHogContext.Provider>;
}
