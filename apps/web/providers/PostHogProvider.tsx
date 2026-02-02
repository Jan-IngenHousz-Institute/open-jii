"use client";

import posthog from "posthog-js";
import { PostHogProvider as PostHogProviderBase } from "posthog-js/react";
import type { ReactNode } from "react";
import { useEffect } from "react";

import { env } from "../env";
import { getConsentStatus } from "../lib/cookie-consent";
import { POSTHOG_CLIENT_CONFIG } from "../lib/posthog-config";

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
  useEffect(() => {
    const posthogKey = env.NEXT_PUBLIC_POSTHOG_KEY;

    // Skip if no valid key
    if (!posthogKey || posthogKey.startsWith("phc_0000")) {
      return;
    }

    // Get consent status from cookie
    const consentStatus = getConsentStatus();
    const hasConsent = consentStatus === "accepted";

    // Always initialize/reinitialize PostHog with current consent status
    // PostHog.init() is safe to call multiple times - it updates config
    posthog.init(posthogKey, {
      ...POSTHOG_CLIENT_CONFIG,
      cookieless_mode: "on_reject",
      persistence: hasConsent ? "localStorage+cookie" : "memory",
      opt_out_capturing_by_default: !hasConsent,
    });

    // Explicitly sync opt-in/out status after init
    if (hasConsent) {
      posthog.opt_in_capturing();
    }
  }, []);

  return <PostHogProviderBase client={posthog}>{children}</PostHogProviderBase>;
}
