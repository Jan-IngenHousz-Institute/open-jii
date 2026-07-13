import { onlineManager } from "@tanstack/react-query";
import PostHog from "posthog-react-native";
import { createLogger } from "~/shared/observability/logger";
import { getEnvVar } from "~/shared/stores/environment-store";

const log = createLogger("posthog");

/**
 * PostHog host - use the official endpoint directly.
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
    // Don't preload feature flags - we're focused on crash logging
    preloadFeatureFlags: false,
    // Flush quickly so crash events aren't lost
    flushAt: 5,
    flushInterval: 5000,
  });

  // The SDK has no netinfo to detect offline, so it keeps retrying the flush
  // with no network. Gate its one network primitive (this.fetch, used for
  // events/flush/flags) on connectivity: reject while offline so nothing hits
  // the wire; events stay queued for the next online flush.
  const baseFetch = client.fetch.bind(client);
  client.fetch = (url, options) => {
    if (!onlineManager.isOnline()) {
      log.debug("offline - skipping request");
      return Promise.reject(new Error("offline: PostHog request skipped"));
    }
    return baseFetch(url, options);
  };

  return client;
}

// Same convention as aws-iot-auth's _reset*ForTests.
export function _resetPostHogClientForTests(): void {
  client = null;
}
