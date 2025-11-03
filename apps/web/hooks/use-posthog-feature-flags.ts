"use client";

import { FEATURE_FLAG_DEFAULTS } from "@/lib/posthog-config";
import type { FeatureFlagKey } from "@/lib/posthog-config";
import { useEffect, useState } from "react";

// Extend window type to include posthog
declare global {
  interface Window {
    posthog?: {
      __loaded?: boolean;
      isFeatureEnabled: (flagKey: string) => boolean | undefined;
      onFeatureFlags: (callback: () => void) => () => void;
    };
  }
}

/**
 * Hook to check if a PostHog feature flag is enabled
 * Handles loading, caching, and real-time updates from PostHog
 *
 * @param flagKey - The feature flag key to check
 * @returns boolean indicating if the flag is enabled (defaults to false while loading)
 *
 * @example
 * ```tsx
 * const isMultiLanguageEnabled = usePostHogFeatureFlag(FEATURE_FLAGS.MULTI_LANGUAGE);
 * if (!isMultiLanguageEnabled) return null;
 * return <MultiLanguageComponent />;
 * ```
 */
export function usePostHogFeatureFlag(flagKey: FeatureFlagKey): boolean {
  const [isEnabled, setIsEnabled] = useState<boolean>(false);

  useEffect(() => {
    let isMounted = true;
    let checkInterval: NodeJS.Timeout | undefined;
    let timeoutId: NodeJS.Timeout | undefined;
    let unsubscribe: (() => void) | undefined;

    const setupFeatureFlag = () => {
      const posthog = window.posthog;
      if (!posthog || !isMounted) return;

      // Listen for feature flag updates (this fires when flags are first loaded too)
      unsubscribe = posthog.onFeatureFlags(() => {
        if (!isMounted) return;
        const value = posthog.isFeatureEnabled(flagKey);
        // PostHog returns undefined if flag doesn't exist, false/true if it does
        // Nullish coalescing (??) only replaces null/undefined, not false
        setIsEnabled(value ?? FEATURE_FLAG_DEFAULTS[flagKey]);
      });
    };

    // Check if PostHog is already loaded
    if (window.posthog && typeof window.posthog.isFeatureEnabled === "function") {
      setupFeatureFlag();
    } else {
      // If not loaded yet, wait for it
      let attempts = 0;
      const maxAttempts = 20;

      checkInterval = setInterval(
        () => {
          attempts++;
          if (window.posthog && typeof window.posthog.isFeatureEnabled === "function") {
            if (checkInterval) clearInterval(checkInterval);
            setupFeatureFlag();
          } else if (attempts >= maxAttempts) {
            if (checkInterval) clearInterval(checkInterval);
            // Fall back to default value if PostHog never loads
            if (isMounted) {
              setIsEnabled(FEATURE_FLAG_DEFAULTS[flagKey]);
            }
          }
        },
        100 * Math.pow(1.5, Math.min(attempts, 5)),
      );

      // Cleanup timeout
      timeoutId = setTimeout(() => {
        if (checkInterval) clearInterval(checkInterval);
        if (isMounted) {
          setIsEnabled(FEATURE_FLAG_DEFAULTS[flagKey]);
        }
      }, 10000);
    }

    // Cleanup function to prevent memory leaks
    return () => {
      isMounted = false;
      if (checkInterval) clearInterval(checkInterval);
      if (timeoutId) clearTimeout(timeoutId);
      if (unsubscribe) unsubscribe();
    };
  }, [flagKey]);

  return isEnabled;
}
