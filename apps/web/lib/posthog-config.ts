import type { PostHogConfig } from "posthog-js";

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
} satisfies Partial<PostHogConfig>;

/**
 * PostHog server configuration for Node.js
 */
export const POSTHOG_SERVER_CONFIG = {
  host: env.NEXT_PUBLIC_POSTHOG_HOST,
  flushAt: 20, // Batch events before sending
  flushInterval: 10000, // Flush every 10 seconds
} as const;
