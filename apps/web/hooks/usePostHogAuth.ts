"use client";

import posthog from "posthog-js";
import { useEffect } from "react";

import { useSession } from "@repo/auth/client";

/**
 * Names the signed-in user by id, as the phone app does, so one researcher is one person; the email
 * stays as a property because flag cohorts and the internal-user filter match on it.
 */
export function usePostHogAuth() {
  const { data: session, isPending } = useSession();

  useEffect(() => {
    if (isPending) {
      return;
    }

    if (session) {
      posthog.identify(session.user.id, { email: session.user.email });
    } else {
      posthog.reset();
    }
  }, [session, isPending]);
}

/**
 * Client component that calls the PostHog auth hook
 */
export function PostHogIdentifier() {
  "use client";
  usePostHogAuth();
  return null;
}
