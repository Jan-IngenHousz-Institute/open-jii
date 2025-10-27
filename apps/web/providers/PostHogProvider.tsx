"use client";

import type { ReactNode } from "react";
import { useEffect, useState } from "react";

import { env } from "../env";

export function PostHogProvider({ children }: { children: ReactNode }) {
  const [isInitialized, setIsInitialized] = useState(false);

  useEffect(() => {
    // Skip initialization if no valid key

    if (!env.NEXT_PUBLIC_POSTHOG_KEY || env.NEXT_PUBLIC_POSTHOG_KEY.startsWith("phc_0000")) {
      console.warn("[PostHog] Skipping initialization - no valid API key configured");
      setIsInitialized(true);
      return;
    }

    // Dynamic import to avoid Turbopack bundling issues
    void import("posthog-js").then((posthogModule) => {
      const posthog = posthogModule.default;

      posthog.init(env.NEXT_PUBLIC_POSTHOG_KEY, {
        api_host: "/ingest",
        ui_host: env.NEXT_PUBLIC_POSTHOG_HOST,
        person_profiles: "identified_only",
        defaults: "2025-05-24",
        capture_pageview: true,
        capture_pageleave: true,
        capture_exceptions: true,
        debug: env.NODE_ENV === "development",
      });

      setIsInitialized(true);
    });
  }, []);

  // Don't render children until PostHog is initialized to ensure tracking works
  if (!isInitialized) {
    return <>{children}</>;
  }

  return <>{children}</>;
}
