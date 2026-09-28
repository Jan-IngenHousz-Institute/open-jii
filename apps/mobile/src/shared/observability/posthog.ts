import { onlineManager } from "@tanstack/react-query";
import PostHog from "posthog-react-native";
import { addLogSink, createLogger } from "~/shared/observability/logger";
import { createPostHogLogSink } from "~/shared/observability/posthog-log-sink";
import { getEnvName, getEnvVar } from "~/shared/stores/environment-store";

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
let removeLogSink: (() => void) | null = null;

// Read when needed rather than at load, so a test can play either kind of build.
function isDevelopmentBuild(): boolean {
  return typeof __DEV__ !== "undefined" && __DEV__;
}

type PostHogOptions = NonNullable<ConstructorParameters<typeof PostHog>[1]>;
type BeforeSend = Extract<
  NonNullable<PostHogOptions["before_send"]>,
  (...args: never[]) => unknown
>;
type CaptureEvent = Parameters<BeforeSend>[0];

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

// Console autocapture records the SDK's own failed uploads, and the offline guard below fails
// every flush while the phone has no network; left in, they outnumber the app's real errors.
export function dropSdkNoise(event: CaptureEvent): CaptureEvent {
  if (event?.event !== "$exception") return event;
  const exceptions = event.properties?.$exception_list;
  const isSdkFailure =
    Array.isArray(exceptions) &&
    exceptions.some(
      (exception) =>
        isRecord(exception) &&
        typeof exception.type === "string" &&
        exception.type.startsWith("PostHogFetch"),
    );
  return isSdkFailure ? null : event;
}

// One PostHog project serves dev and prod, and the environment is picked at runtime, so every
// event names the one it was sent from at the moment it is sent.
export function tagEnvironment(event: CaptureEvent): CaptureEvent {
  if (event === null) return null;
  return {
    ...event,
    properties: {
      ...event.properties,
      environment: getEnvName(),
      service: "mobile",
    },
  };
}

export function getPostHogClient(): PostHog {
  if (client) return client;

  const POSTHOG_API_KEY = getEnvVar("POSTHOG_API_KEY");

  client = new PostHog(POSTHOG_API_KEY, {
    host: POSTHOG_HOST,
    // A Metro build on a developer's machine sends nothing, since every environment shares one
    // PostHog project.
    before_send: isDevelopmentBuild() ? [() => null] : [dropSdkNoise, tagEnvironment],
    // Error log lines reach PostHog through the log sink below, with their real Error, so
    // console autocapture would only report them a second time.
    errorTracking: {
      autocapture: {
        uncaughtExceptions: true,
        unhandledRejections: true,
        console: [],
        // Crashes in native code, such as the USB serial and Bluetooth modules, through
        // @posthog/react-native-plugin. The native SDK sends these itself, past before_send, so a
        // development build leaves them off.
        nativeCrashes: !isDevelopmentBuild(),
      },
    },
    logs: { serviceName: "mobile" },
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

  // Development builds keep their logs on the console.
  if (!isDevelopmentBuild()) {
    removeLogSink = addLogSink(createPostHogLogSink(client, getEnvName));
  }

  return client;
}

/** The client once the provider has started it, for code that must not start it itself. */
export function getReadyPostHogClient(): PostHog | null {
  return client;
}

// Same convention as aws-iot-auth's _reset*ForTests.
export function _resetPostHogClientForTests(): void {
  removeLogSink?.();
  removeLogSink = null;
  client = null;
}
