/**
 * Server-side PostHog utilities for Next.js
 * Re-exports from @repo/analytics/server for convenience
 */
import { env } from "~/env";

import type { FeatureFlagKey } from "@repo/analytics";
import {
  initializePostHogServer,
  isFeatureFlagEnabled as isFeatureFlagEnabledBase,
  shutdownPostHog as shutdownPostHogBase,
} from "@repo/analytics/server";

import { POSTHOG_SERVER_CONFIG } from "./posthog-config";

// Track initialization state
let initialized = false;

/**
 * Initialize PostHog server client (call once at app startup)
 */
async function ensureInitialized(): Promise<void> {
  if (initialized) return;

  const key = env.NEXT_PUBLIC_POSTHOG_KEY;
  if (!key || key === "phc_0000") {
    return;
  }

  initialized = await initializePostHogServer(key, POSTHOG_SERVER_CONFIG);
}

/**
 * Check if a feature flag is enabled server-side
 * @param flagKey - The feature flag key to check
 * @param distinctId - User identifier (defaults to 'anonymous')
 * @returns Whether the flag is enabled (falls back to default on error)
 */
export async function isFeatureFlagEnabled(
  flagKey: FeatureFlagKey,
  distinctId = "anonymous",
): Promise<boolean> {
  await ensureInitialized();
  return isFeatureFlagEnabledBase(flagKey, distinctId);
}

/**
 * Shutdown the PostHog client (call this when the server is shutting down)
 */
export async function shutdownPostHog(): Promise<void> {
  if (initialized) {
    await shutdownPostHogBase();
    initialized = false;
  }
}
