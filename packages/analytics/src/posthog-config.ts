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

/** The `service` property every app puts on its events, so one project can tell them apart. */
export type PostHogService = "web" | "backend" | "mobile";

/**
 * PostHog configuration interface for environment variables
 */
export interface PostHogEnvConfig {
  POSTHOG_KEY?: string;
  POSTHOG_HOST?: string;
}

/**
 * Create PostHog client configuration for browser
 * @param apiHost - The host for API requests (can be a reverse proxy path like '/ingest')
 * @param uiHost - The PostHog UI host for toolbar/links (e.g., 'https://eu.posthog.com')
 * @param options - Additional PostHog configuration options
 */
export function createPostHogClientConfig(
  apiHost: string,
  uiHost: string,
  options?: Partial<PostHogConfig>,
): Partial<PostHogConfig> {
  return {
    api_host: apiHost,
    ui_host: uiHost,
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
  // Reports an uncaught exception, flushes, then exits as Node would have.
  enableExceptionAutocapture?: boolean;
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
    enableExceptionAutocapture: options?.enableExceptionAutocapture ?? false,
  };
}
