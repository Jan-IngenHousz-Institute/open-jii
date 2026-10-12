"use client";

import type { PostHog } from "posthog-js";
import { createContext, useContext, useEffect, useState } from "react";

export const PostHogContext = createContext<PostHog | null>(null);

/** The started PostHog client, or null while it loads and wherever PostHog is off. */
export function usePostHog() {
  return useContext(PostHogContext);
}

/** Whether a flag is on, or undefined until PostHog has loaded and evaluated its flags. */
export function useFeatureFlagEnabled(flag: string): boolean | undefined {
  const posthog = usePostHog();
  const [enabled, setEnabled] = useState(() => posthog?.isFeatureEnabled(flag));

  useEffect(() => {
    if (!posthog) {
      return;
    }
    return posthog.onFeatureFlags(() => setEnabled(posthog.isFeatureEnabled(flag)));
  }, [posthog, flag]);

  return enabled;
}
