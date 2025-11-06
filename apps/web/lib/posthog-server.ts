import { PostHog } from "posthog-node";
import { env } from "~/env";

import type { FeatureFlagKey } from "./posthog-config";
import { FEATURE_FLAG_DEFAULTS, POSTHOG_SERVER_CONFIG } from "./posthog-config";

// Singleton PostHog client for server-side operations
let posthogClient: PostHog | null = null;

/**
 * Get or create the PostHog server client
 * @returns PostHog client instance or null if not properly configured
 */
function getPostHogClient(): PostHog | null {
  const key = env.NEXT_PUBLIC_POSTHOG_KEY;

  // Don't create client if key is missing or placeholder
  if (!key || key === "phc_0000") {
    return null;
  }

  posthogClient ??= new PostHog(key, POSTHOG_SERVER_CONFIG);

  return posthogClient;
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
  try {
    const client = getPostHogClient();

    // If client is null (invalid key), return default
    if (!client) {
      return FEATURE_FLAG_DEFAULTS[flagKey];
    }

    const isEnabled = await client.isFeatureEnabled(flagKey, distinctId);
    return isEnabled ?? FEATURE_FLAG_DEFAULTS[flagKey];
  } catch (error) {
    console.error(`[PostHog] Error checking feature flag ${flagKey}:`, error);
    return FEATURE_FLAG_DEFAULTS[flagKey];
  }
}

/**
 * Shutdown the PostHog client (call this when the server is shutting down)
 */
export async function shutdownPostHog(): Promise<void> {
  if (posthogClient) {
    await posthogClient.shutdown();
    posthogClient = null;
  }
}
