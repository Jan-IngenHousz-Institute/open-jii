import type { DefaultOptions } from "@tanstack/react-query";

/**
 * Its own module so a test can bind to the real values. Importing the provider
 * instead would run its module-level side effects — onlineManager, AsyncStorage,
 * the focus listener — which a hook test has no way to satisfy.
 */
export const queryDefaultOptions = {
  queries: {
    staleTime: 0,
    gcTime: Infinity,
    networkMode: "offlineFirst" as const,
    refetchOnMount: false,
    refetchOnReconnect: true,
    refetchOnWindowFocus: false,
    retry: 1,
  },
} satisfies DefaultOptions;
