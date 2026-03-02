import PostHog from "posthog-react-native";
import { getEnvVar } from "~/stores/environment-store";


/**
 * PostHog host — use the official endpoint directly.
 * The reverse-proxy (/ingest) is only useful for the web app
 * (to dodge ad-blockers). On mobile there's no need for it.
 */
const POSTHOG_HOST = "https://eu.i.posthog.com";

/**
 * Singleton PostHog client for the mobile app.
 * Initialized lazily so the environment store has time to rehydrate.
 */
let client: PostHog | null = null;

export function getPostHogClient(): PostHog {
  if (client) return client;

  const POSTHOG_API_KEY = getEnvVar("POSTHOG_API_KEY");

  client = new PostHog(POSTHOG_API_KEY, {
    host: POSTHOG_HOST,
    // Autocapture uncaught exceptions, unhandled rejections, and console.error
    errorTracking: {
      autocapture: {
        uncaughtExceptions: true,
        unhandledRejections: true,
        console: ["error"],
      },
    },
    // Capture app lifecycle events (install, update, open, background)
    captureAppLifecycleEvents: true,
    // Don't preload feature flags — we're focused on crash logging
    preloadFeatureFlags: false,
    // Flush quickly so crash events aren't lost
    flushAt: 5,
    flushInterval: 5000,
  });

  return client;
}
