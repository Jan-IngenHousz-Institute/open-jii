import PostHog from "posthog-react-native";
import { getEnvName } from "~/stores/environment-store";

/**
 * PostHog API key — same project as the web app.
 * Shared key so mobile + web events land in one PostHog project.
 */
const POSTHOG_API_KEY = "phc_bAOjcJ4S1mw8I5bSlDHUDmNeOaLuo4dhPiqWmyNdWLd";

/**
 * Reverse proxy hosts per environment.
 * Routes through the web app's /ingest rewrite so requests
 * go to our domain first (same pattern as the Next.js reverse proxy).
 */
const PROXY_HOSTS: Record<string, string> = {
  prod: "https://openjii.org/ingest",
  dev: "https://dev.openjii.org/ingest",
};

function getPostHogHost(): string {
  try {
    const env = getEnvName();
    return PROXY_HOSTS[env] ?? PROXY_HOSTS.prod;
  } catch {
    // Store not rehydrated yet — fall back to prod
    return PROXY_HOSTS.prod;
  }
}

/**
 * Singleton PostHog client for the mobile app.
 * Initialized lazily so the environment store has time to rehydrate.
 */
let client: PostHog | null = null;

export async function getPostHogClient(): Promise<PostHog> {
  if (client) return client;

  client = await PostHog.initAsync(POSTHOG_API_KEY, {
    host: getPostHogHost(),
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

/**
 * Get the client synchronously (returns null if not yet initialized).
 * Useful for error boundaries and places where async isn't practical.
 */
export function getPostHogClientSync(): PostHog | null {
  return client;
}
