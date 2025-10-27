"use client";

import { useEffect, useState } from "react";

/**
 * Hook to check if a PostHog feature flag is enabled
 * @param flagKey - The feature flag key to check
 * @returns boolean indicating if the flag is enabled, or null if not yet loaded
 */
export function usePostHogFeatureFlag(flagKey: string): boolean | null {
  const [isEnabled, setIsEnabled] = useState<boolean | null>(null);

  useEffect(() => {
    // Dynamically import posthog-js to avoid SSR issues
    void import("posthog-js")
      .then((posthogModule) => {
        const posthog = posthogModule.default;

        // Check if PostHog is initialized
        if (posthog.__loaded) {
          // Get initial value
          const initialValue = posthog.isFeatureEnabled(flagKey);
          setIsEnabled(initialValue ?? false);

          // Listen for feature flag updates
          posthog.onFeatureFlags(() => {
            const updatedValue = posthog.isFeatureEnabled(flagKey);
            setIsEnabled(updatedValue ?? false);
          });
        } else {
          // If not initialized yet, wait for it
          const checkInterval = setInterval(() => {
            if (posthog.__loaded) {
              clearInterval(checkInterval);
              const value = posthog.isFeatureEnabled(flagKey);
              setIsEnabled(value ?? false);

              posthog.onFeatureFlags(() => {
                const updatedValue = posthog.isFeatureEnabled(flagKey);
                setIsEnabled(updatedValue ?? false);
              });
            }
          }, 100);

          // Cleanup interval after 5 seconds if PostHog never initializes
          setTimeout(() => clearInterval(checkInterval), 5000);
        }
      })
      .catch((error) => {
        console.error("[usePostHogFeatureFlag] Failed to load PostHog:", error);
        setIsEnabled(false);
      });
  }, [flagKey]);

  return isEnabled;
}
