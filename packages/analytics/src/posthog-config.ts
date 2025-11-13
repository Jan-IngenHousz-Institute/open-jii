/**
 * PostHog configuration types and utilities
 */

/**
 * PostHog configuration interface (subset of actual PostHogConfig)
 * This avoids direct dependency on posthog-js types
 */
export interface PostHogConfig {
  api_host?: string;
  ui_host?: string;
  person_profiles?: "always" | "never" | "identified_only";
  capture_pageview?: boolean;
  capture_pageleave?: boolean;
  capture_exceptions?: boolean;
  debug?: boolean;
  [key: string]: unknown;
}

/**
 * PostHog configuration interface for environment variables
 */
export interface PostHogEnvConfig {
  POSTHOG_KEY?: string;
  POSTHOG_HOST?: string;
}

/**
 * Create PostHog client configuration for browser
 */
export function createPostHogClientConfig(
  host: string,
  options?: Partial<PostHogConfig>,
): Partial<PostHogConfig> {
  return {
    api_host: host,
    ui_host: host,
    person_profiles: "identified_only",
    capture_pageview: true,
    capture_pageleave: true,
    capture_exceptions: true,
    debug: false, // Set to true for debugging PostHog issues
    ...options,
  };
}

/**
 * PostHog server configuration for Node.js
 */
export interface PostHogServerConfig {
  host: string;
  flushAt?: number; // Batch events before sending
  flushInterval?: number; // Flush interval in milliseconds
}

/**
 * Create PostHog server configuration
 */
export function createPostHogServerConfig(
  host: string,
  options?: Partial<PostHogServerConfig>,
): PostHogServerConfig {
  return {
    host,
    flushAt: options?.flushAt ?? 20,
    flushInterval: options?.flushInterval ?? 10000,
  };
}
