import { env } from "../env";

/**
 * PostHog feature flag configuration
 * Defines default values and behavior for feature flags
 */
export const FEATURE_FLAGS = {
  MULTI_LANGUAGE: "multi-language",
} as const;

export type FeatureFlagKey = (typeof FEATURE_FLAGS)[keyof typeof FEATURE_FLAGS];

/**
 * Default values for feature flags when PostHog is unavailable
 * Use conservative defaults (features disabled) for safety
 */
export const FEATURE_FLAG_DEFAULTS: Record<FeatureFlagKey, boolean> = {
  [FEATURE_FLAGS.MULTI_LANGUAGE]: false, // Default to single language
};

/**
 * PostHog client configuration for browser
 */
export const POSTHOG_CLIENT_CONFIG = {
  api_host: env.NEXT_PUBLIC_POSTHOG_HOST,
  ui_host: env.NEXT_PUBLIC_POSTHOG_HOST,
  person_profiles: "identified_only",
  defaults: "2025-05-24",
  capture_pageview: true,
  capture_pageleave: true,
  capture_exceptions: true,
  debug: false, // Set to true for debugging PostHog issues
  // Performance optimization
  loaded: (posthog: { __loaded?: boolean }) => {
    posthog.__loaded = true;
  },
} as const;

/**
 * Server-side PostHog configuration
 */
export const POSTHOG_SERVER_CONFIG = {
  host: env.NEXT_PUBLIC_POSTHOG_HOST,
  flushAt: 20, // Batch events
  flushInterval: 10000, // Flush every 10 seconds
};

/**
 * Cache configuration for server-side feature flags
 */
export const CACHE_CONFIG = {
  TTL_MS: 60_000, // 1 minute
  MAX_SIZE: 1000, // Maximum number of cached entries
  CLEANUP_INTERVAL_MS: 300_000, // Clean up stale entries every 5 minutes
} as const;

/**
 * Circuit breaker configuration for PostHog API calls
 */
export const CIRCUIT_BREAKER_CONFIG = {
  FAILURE_THRESHOLD: 5, // Number of failures before opening circuit
  SUCCESS_THRESHOLD: 2, // Number of successes to close circuit
  TIMEOUT_MS: 30_000, // 30 seconds before trying again
} as const;
