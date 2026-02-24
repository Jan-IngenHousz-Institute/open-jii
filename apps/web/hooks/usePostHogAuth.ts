"use client";

import posthog from "posthog-js";
import { useEffect } from "react";

import { useSession } from "@repo/auth/client";

/**
 * Hook to identify the current user with PostHog analytics
 * Automatically identifies users when they log in and resets when they log out
 */
export function usePostHogAuth() {
  const { data: session } = useSession();

  useEffect(() => {
    if (session?.user.email) {
      posthog.identify(session.user.email, {
        email: session.user.email,
        name: session.user.name,
      });
    } else if (session === null) {
      // Session is null means unauthenticated (undefined means loading)
      posthog.reset();
    }
  }, [session]);
}

/**
 * Client component that calls the PostHog auth hook
 */
export function PostHogIdentifier() {
  "use client";
  usePostHogAuth();
  return null;
}
