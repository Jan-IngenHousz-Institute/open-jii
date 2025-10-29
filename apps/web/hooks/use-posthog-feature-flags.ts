"use client";

import { FEATURE_FLAG_DEFAULTS } from "@/lib/posthog-config";
import type { FeatureFlagKey } from "@/lib/posthog-config";
import { useEffect, useState } from "react";

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

    const initializePostHog = async () => {
      try {
        // Dynamically import posthog-js to avoid SSR issues
        const posthogModule = await import("posthog-js");
        const posthog = posthogModule.default;

        const setupFeatureFlag = () => {
          if (!isMounted) return;

          const value = posthog.isFeatureEnabled(flagKey);
          setIsEnabled(value ?? FEATURE_FLAG_DEFAULTS[flagKey]);

          // Listen for feature flag updates
          unsubscribe = posthog.onFeatureFlags(() => {
            if (!isMounted) return;
            const updatedValue = posthog.isFeatureEnabled(flagKey);
            setIsEnabled(updatedValue ?? FEATURE_FLAG_DEFAULTS[flagKey]);
          });
        };

        // Check if PostHog is initialized
        if (posthog.__loaded) {
          setupFeatureFlag();
        } else {
          // If not initialized yet, wait for it with exponential backoff
          let attempts = 0;
          const maxAttempts = 10;

          checkInterval = setInterval(
            () => {
              attempts++;

              if (posthog.__loaded) {
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

          // Cleanup timeout
          timeoutId = setTimeout(() => {
            if (checkInterval) clearInterval(checkInterval);
            if (isMounted) {
              console.warn("[usePostHogFeatureFlag] PostHog initialization timeout");
              setIsEnabled(FEATURE_FLAG_DEFAULTS[flagKey]);
            }
          }, 5000);
        }
      } catch (error) {
        console.error("[usePostHogFeatureFlag] Failed to load PostHog:", error);
        if (isMounted) {
          setIsEnabled(FEATURE_FLAG_DEFAULTS[flagKey]);
        }
      }
    };

    void initializePostHog();

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
