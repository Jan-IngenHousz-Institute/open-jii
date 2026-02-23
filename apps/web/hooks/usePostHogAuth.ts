"use client";

import posthog from "posthog-js";
import { useEffect } from "react";

import { useSession } from "@repo/auth/client";
import { useLocale } from "./useLocale";

/**
 * Hook to identify the current user with PostHog analytics
 * Automatically identifies users when they log in and resets when they log out
 * Also tracks the user's locale preference
 */
export function usePostHogAuth() {
  const { data: session } = useSession();
  const locale = useLocale();

  useEffect(() => {
    // Register locale as a super property first (sent with every event)
    if (locale) {
      posthog.register({ locale });
    }

    // Then handle authentication state
    if (session?.user.email) {
      posthog.identify(session.user.email, {
        email: session.user.email,
        name: session.user.name,
        locale: locale,
      });
    } else if (session === null) {
      // Session is null means unauthenticated (undefined means loading)
      posthog.reset();
      // Re-register locale after reset since reset clears super properties
      if (locale) {
        posthog.register({ locale });
      }
    }
  }, [session, locale]);
}


/**
 * Client component that calls the PostHog auth hook
 */
export function PostHogIdentifier() {
  "use client";
  usePostHogAuth();
  return null;
}
