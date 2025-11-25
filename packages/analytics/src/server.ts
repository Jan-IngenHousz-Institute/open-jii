import type { FeatureFlagKey } from "./feature-flags";
import { FEATURE_FLAG_DEFAULTS } from "./feature-flags";
import type { PostHogServerConfig } from "./posthog-config";

/**
 * PostHog server client interface
 * This is a minimal interface to avoid direct dependency on posthog-node
 */
interface PostHogServerClient {
  isFeatureEnabled(flagKey: string, distinctId: string): Promise<boolean | undefined>;
  shutdown(): Promise<void>;
}

// Singleton PostHog client for server-side operations
let posthogClient: PostHogServerClient | null = null;

/**
 * Initialize PostHog server client
 * @param key - PostHog API key
 * @param config - PostHog server configuration
 * @returns Whether initialization was successful
 */
export async function initializePostHogServer(
  key: string | undefined,
  config: PostHogServerConfig,
): Promise<boolean> {
  // Don't create client if key is missing or placeholder
  if (!key || key === "phc_0000" || key.startsWith("phc_0000")) {
    return false;
  }

  try {
    // Dynamic import to avoid bundling posthog-node in frontend
    const { PostHog } = await import("posthog-node");
    posthogClient = new PostHog(key, config);
    return true;
  } catch (error) {
    console.error("[PostHog] Failed to initialize server client:", error);
    return false;
  }
}

/**
 * Get the PostHog server client
 * @returns PostHog client instance or null if not initialized
 */
export function getPostHogServerClient(): PostHogServerClient | null {
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
    const client = getPostHogServerClient();

    // If client is null (not initialized), return default
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
