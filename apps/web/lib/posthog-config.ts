import {
  FEATURE_FLAGS,
  FEATURE_FLAG_DEFAULTS,
  createPostHogClientConfig,
  createPostHogServerConfig,
} from "@repo/analytics";
import type { FeatureFlagKey } from "@repo/analytics";

import { env } from "../env";

/**
 * Re-export feature flags for backward compatibility
 */
export { FEATURE_FLAGS, FEATURE_FLAG_DEFAULTS };
export type { FeatureFlagKey };

/**
 * PostHog client configuration for browser
 */
export const POSTHOG_CLIENT_CONFIG = createPostHogClientConfig(env.NEXT_PUBLIC_POSTHOG_HOST, {
  // Add any web-specific overrides here if needed
  debug: false,
});

/**
 * PostHog server configuration for Node.js
 */
export const POSTHOG_SERVER_CONFIG = createPostHogServerConfig(env.NEXT_PUBLIC_POSTHOG_HOST, {
  flushAt: 20,
  flushInterval: 10000,
});
