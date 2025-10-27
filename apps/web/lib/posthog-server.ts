import { PostHog } from "posthog-node";
import { env } from "~/env";

// Singleton PostHog client for server-side feature flag checks
let posthogClient: PostHog | null = null;

// Cache for feature flags with TTL
interface CacheEntry {
  value: boolean;
  timestamp: number;
}

const featureFlagCache = new Map<string, CacheEntry>();
const CACHE_TTL_MS = 60000; // 1 minute cache

// Test mode override - set this in your test setup
let testMode = false;
const testFeatureFlags = new Map<string, boolean>();

export function setTestMode(enabled: boolean): void {
  testMode = enabled;
}

export function setTestFeatureFlag(flagKey: string, value: boolean): void {
  testFeatureFlags.set(flagKey, value);
}

export function getPostHogClient(): PostHog {
  posthogClient ??= new PostHog(env.NEXT_PUBLIC_POSTHOG_KEY, {
    host: env.NEXT_PUBLIC_POSTHOG_HOST,
  });
  return posthogClient;
}

/**
 * Check if a feature flag is enabled server-side with caching
 * @param flagKey - The feature flag key to check
 * @param distinctId - User identifier (use 'anonymous' for unauthenticated)
 * @returns Promise<boolean> - Whether the flag is enabled
 */
export async function isFeatureFlagEnabled(
  flagKey: string,
  distinctId = "anonymous",
): Promise<boolean> {
  // Use test override if in test mode
  if (testMode) {
    return testFeatureFlags.get(flagKey) ?? false;
  }

  const cacheKey = `${flagKey}:${distinctId}`;
  const now = Date.now();

  // Check cache first
  const cached = featureFlagCache.get(cacheKey);
  if (cached && now - cached.timestamp < CACHE_TTL_MS) {
    return cached.value;
  }

  try {
    const client = getPostHogClient();
    const isEnabled = await client.isFeatureEnabled(flagKey, distinctId);
    const value = isEnabled ?? false;

    // Update cache
    featureFlagCache.set(cacheKey, { value, timestamp: now });

    return value;
  } catch (error) {
    console.error(`[PostHog Server] Error checking feature flag ${flagKey}:`, error);

    // Return cached value if available, otherwise fail closed
    if (cached) {
      return cached.value;
    }
    return false;
  }
}

/**
 * Clear the feature flag cache (useful for testing)
 */
export function clearFeatureFlagCache(): void {
  featureFlagCache.clear();
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
