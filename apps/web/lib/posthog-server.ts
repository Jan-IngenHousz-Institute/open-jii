import { PostHog } from "posthog-node";
import { env } from "~/env";

import type { FeatureFlagKey } from "./posthog-config";
import {
  CACHE_CONFIG,
  CIRCUIT_BREAKER_CONFIG,
  FEATURE_FLAG_DEFAULTS,
  POSTHOG_SERVER_CONFIG,
} from "./posthog-config";

// Singleton PostHog client for server-side feature flag checks
let posthogClient: PostHog | null = null;

// Cache for feature flags with TTL and LRU eviction
interface CacheEntry {
  value: boolean;
  timestamp: number;
  accessCount: number;
}

class FeatureFlagCache {
  private cache = new Map<string, CacheEntry>();
  private cleanupInterval: NodeJS.Timeout | null = null;

  constructor() {
    this.startCleanup();
  }

  get(key: string): boolean | null {
    const entry = this.cache.get(key);
    if (!entry) return null;

    const now = Date.now();
    if (now - entry.timestamp > CACHE_CONFIG.TTL_MS) {
      this.cache.delete(key);
      return null;
    }

    // Update access count for LRU
    entry.accessCount++;
    return entry.value;
  }

  set(key: string, value: boolean): void {
    // Evict least recently used if cache is full
    if (this.cache.size >= CACHE_CONFIG.MAX_SIZE) {
      this.evictLRU();
    }

    this.cache.set(key, {
      value,
      timestamp: Date.now(),
      accessCount: 0,
    });
  }

  private evictLRU(): void {
    let minAccessCount = Infinity;
    let lruKey: string | null = null;

    for (const [key, entry] of this.cache.entries()) {
      if (entry.accessCount < minAccessCount) {
        minAccessCount = entry.accessCount;
        lruKey = key;
      }
    }

    if (lruKey) {
      this.cache.delete(lruKey);
    }
  }

  clear(): void {
    this.cache.clear();
  }

  private startCleanup(): void {
    this.cleanupInterval = setInterval(() => {
      const now = Date.now();
      for (const [key, entry] of this.cache.entries()) {
        if (now - entry.timestamp > CACHE_CONFIG.TTL_MS) {
          this.cache.delete(key);
        }
      }
    }, CACHE_CONFIG.CLEANUP_INTERVAL_MS);
  }

  stopCleanup(): void {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
      this.cleanupInterval = null;
    }
  }
}

const featureFlagCache = new FeatureFlagCache();

// Circuit breaker for PostHog API
class CircuitBreaker {
  private failureCount = 0;
  private successCount = 0;
  private state: "CLOSED" | "OPEN" | "HALF_OPEN" = "CLOSED";
  private lastFailureTime = 0;

  async execute<T>(fn: () => Promise<T>): Promise<T> {
    if (this.state === "OPEN") {
      const now = Date.now();
      if (now - this.lastFailureTime < CIRCUIT_BREAKER_CONFIG.TIMEOUT_MS) {
        throw new Error("Circuit breaker is OPEN");
      }
      this.state = "HALF_OPEN";
    }

    try {
      const result = await fn();
      this.onSuccess();
      return result;
    } catch (error) {
      this.onFailure();
      throw error;
    }
  }

  private onSuccess(): void {
    this.failureCount = 0;
    if (this.state === "HALF_OPEN") {
      this.successCount++;
      if (this.successCount >= CIRCUIT_BREAKER_CONFIG.SUCCESS_THRESHOLD) {
        this.state = "CLOSED";
        this.successCount = 0;
      }
    }
  }

  private onFailure(): void {
    this.failureCount++;
    this.lastFailureTime = Date.now();
    if (this.failureCount >= CIRCUIT_BREAKER_CONFIG.FAILURE_THRESHOLD) {
      this.state = "OPEN";
      console.error(`[PostHog Server] Circuit breaker opened after ${this.failureCount} failures`);
    }
  }

  getState(): string {
    return this.state;
  }
}

const circuitBreaker = new CircuitBreaker();

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
  if (!env.NEXT_PUBLIC_POSTHOG_KEY) {
    throw new Error("NEXT_PUBLIC_POSTHOG_KEY is not configured");
  }
  posthogClient ??= new PostHog(env.NEXT_PUBLIC_POSTHOG_KEY, POSTHOG_SERVER_CONFIG);
  return posthogClient;
}

/**
 * Check if a feature flag is enabled server-side with caching and circuit breaker
 * @param flagKey - The feature flag key to check
 * @param distinctId - User identifier (use 'anonymous' for unauthenticated)
 * @returns Promise<boolean> - Whether the flag is enabled
 */
export async function isFeatureFlagEnabled(
  flagKey: FeatureFlagKey,
  distinctId = "anonymous",
): Promise<boolean> {
  const cacheKey = `${flagKey}:${distinctId}`;

  // Check cache first (before test mode check to ensure caching works in tests)
  const cachedValue = featureFlagCache.get(cacheKey);
  if (cachedValue !== null) {
    return cachedValue;
  }

  // Use test override if in test mode
  if (testMode) {
    const value = testFeatureFlags.get(flagKey) ?? FEATURE_FLAG_DEFAULTS[flagKey];
    // Cache the test value
    featureFlagCache.set(cacheKey, value);
    return value;
  }

  try {
    const client = getPostHogClient();
    const value = await circuitBreaker.execute(async () => {
      const isEnabled = await client.isFeatureEnabled(flagKey, distinctId);
      return isEnabled ?? FEATURE_FLAG_DEFAULTS[flagKey];
    });

    // Update cache
    featureFlagCache.set(cacheKey, value);

    return value;
  } catch (error) {
    console.error(`[PostHog Server] Error checking feature flag ${flagKey}:`, error);

    // Return default value on error (fail closed)
    return FEATURE_FLAG_DEFAULTS[flagKey];
  }
}

/**
 * Clear the feature flag cache (useful for testing)
 */
export function clearFeatureFlagCache(): void {
  featureFlagCache.clear();
}

/**
 * Get circuit breaker state for monitoring
 */
export function getCircuitBreakerState(): string {
  return circuitBreaker.getState();
}

/**
 * Shutdown the PostHog client (call this when the server is shutting down)
 */
export async function shutdownPostHog(): Promise<void> {
  if (posthogClient) {
    await posthogClient.shutdown();
    posthogClient = null;
  }
  featureFlagCache.stopCleanup();
}
