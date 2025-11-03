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
 * @returns boolean indicating if the flag is enabled, or null if not yet loaded
 *
 * @example
 * ```tsx
 * const isMultiLanguageEnabled = usePostHogFeatureFlag(FEATURE_FLAGS.MULTI_LANGUAGE);
 * if (isMultiLanguageEnabled === null) return <Skeleton />;
 * if (!isMultiLanguageEnabled) return null;
 * return <MultiLanguageComponent />;
 * ```
 */
export function usePostHogFeatureFlag(flagKey: FeatureFlagKey): boolean | null {
  const [isEnabled, setIsEnabled] = useState<boolean | null>(null);

  useEffect(() => {
    let isMounted = true;
    let checkInterval: NodeJS.Timeout | undefined;
    let timeoutId: NodeJS.Timeout | undefined;
    let unsubscribe: (() => void) | undefined;

    const setupFeatureFlag = () => {
      const posthog = window.posthog;
      if (!posthog || !isMounted) return;

      const value = posthog.isFeatureEnabled(flagKey);
      setIsEnabled(value ?? FEATURE_FLAG_DEFAULTS[flagKey]);

      // Listen for feature flag updates
      try {
        unsubscribe = posthog.onFeatureFlags(() => {
          if (!isMounted) return;
          const updatedValue = posthog.isFeatureEnabled(flagKey);
          setIsEnabled(updatedValue ?? FEATURE_FLAG_DEFAULTS[flagKey]);
        });
      } catch (error) {
        console.warn("[usePostHogFeatureFlag] Could not subscribe to feature flag updates:", error);
      }
    };

    // Check if PostHog is already loaded (check for actual methods, not just __loaded flag)
    if (window.posthog && typeof window.posthog.isFeatureEnabled === "function") {
      setupFeatureFlag();
    } else {
      // If not loaded yet, wait for it with exponential backoff
      let attempts = 0;
      const maxAttempts = 20; // Increased from 10

      checkInterval = setInterval(
        () => {
          attempts++;
          if (window.posthog && typeof window.posthog.isFeatureEnabled === "function") {
            if (checkInterval) clearInterval(checkInterval);
            setupFeatureFlag();
          } else if (attempts >= maxAttempts) {
            if (checkInterval) clearInterval(checkInterval);
            // Fail to default value if PostHog never loads
            if (isMounted) {
              console.warn(
                `[usePostHogFeatureFlag] PostHog not loaded after ${maxAttempts} attempts, using default`,
              );
              setIsEnabled(FEATURE_FLAG_DEFAULTS[flagKey]);
            }
          }
        },
        100 * Math.pow(1.5, Math.min(attempts, 5)),
      ); // Exponential backoff

      // Cleanup timeout - increased from 5s to 10s
      timeoutId = setTimeout(() => {
        if (checkInterval) clearInterval(checkInterval);
        if (isMounted) {
          console.warn("[usePostHogFeatureFlag] PostHog initialization timeout");
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
