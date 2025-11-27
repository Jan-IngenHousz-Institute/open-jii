"use client";

import posthog from "posthog-js";
import { useEffect } from "react";

import { useSession } from "@repo/auth/client";

export function PostHogAuthWrapper() {
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

  return null;
}
