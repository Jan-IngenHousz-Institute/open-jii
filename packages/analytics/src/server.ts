import type { FeatureFlagKey } from "./feature-flags";
import { FEATURE_FLAG_DEFAULTS } from "./feature-flags";
import type { PostHogServerConfig, PostHogService, ServerEvent } from "./posthog-config";

/**
 * PostHog server client interface
 * This is a minimal interface to avoid direct dependency on posthog-node
 */
export interface PostHogServerClient {
  isFeatureEnabled(
    flagKey: string,
    distinctId: string,
    options?: { personProperties?: Record<string, string>; sendFeatureFlagEvents?: boolean },
  ): Promise<boolean | undefined>;
  captureException(
    error: unknown,
    distinctId?: string,
    additionalProperties?: Record<string, unknown>,
  ): void;
  // Sends before resolving, for serverless code that is frozen once it responds.
  captureExceptionImmediate(
    error: unknown,
    distinctId?: string,
    additionalProperties?: Record<string, unknown>,
  ): Promise<void>;
  // Everything captured while `fn` runs, across awaits, inherits this distinct id.
  withContext<T>(
    data: { distinctId?: string; properties?: Record<string, unknown> },
    fn: () => T,
    options?: { fresh?: boolean },
  ): T;
  getContext(): { distinctId?: string } | undefined;
  shutdown(): Promise<void>;
}

// Singleton PostHog client for server-side operations
let posthogClient: PostHogServerClient | null = null;

/**
 * Initialize PostHog server client
 * @param key - PostHog API key
 * @param config - PostHog server configuration
 * @returns Whether initialization was successful
 */
export async function initializePostHogServer(
  key: string | undefined,
  config: PostHogServerConfig,
): Promise<boolean> {
  // Don't create client if key is missing or placeholder
  if (!key || key === "phc_0000" || key.startsWith("phc_0000")) {
    return false;
  }

  try {
    // Dynamic import to avoid bundling posthog-node in frontend
    const { PostHog } = await import("posthog-node");
    posthogClient = new PostHog(key, config);
    return true;
  } catch (error) {
    console.error("[PostHog] Failed to initialize server client:", error);
    return false;
  }
}

/**
 * Get the PostHog server client
 * @returns PostHog client instance or null if not initialized
 */
export function getPostHogServerClient(): PostHogServerClient | null {
  return posthogClient;
}

/**
 * Check if a feature flag is enabled server-side
 * @param flagKey - The feature flag key to check
 * @param distinctId - User identifier (defaults to 'anonymous')
 * @param personProperties - Evaluated as the person's properties, over what PostHog has stored
 * @returns Whether the flag is enabled (falls back to default on error)
 */
export async function isFeatureFlagEnabled(
  flagKey: FeatureFlagKey,
  distinctId = "anonymous",
  personProperties?: Record<string, string>,
): Promise<boolean> {
  try {
    const client = getPostHogServerClient();

    // If client is null (not initialized), return default
    if (!client) {
      return FEATURE_FLAG_DEFAULTS[flagKey];
    }

    // Unless told otherwise, posthog-node records a $feature_flag_called event under the distinct
    // id, which creates the person before the user has consented.
    const isEnabled = await client.isFeatureEnabled(flagKey, distinctId, {
      personProperties,
      sendFeatureFlagEvents: false,
    });
    return isEnabled ?? FEATURE_FLAG_DEFAULTS[flagKey];
  } catch (error) {
    console.error(`[PostHog] Error checking feature flag ${flagKey}:`, error);
    return FEATURE_FLAG_DEFAULTS[flagKey];
  }
}

export interface ExceptionReport {
  service: PostHogService;
  environment: string;
  distinctId?: string;
  properties?: Record<string, unknown>;
  // For code frozen once it responds, such as a Lambda, which cannot wait for a batched flush.
  immediate?: boolean;
}

/**
 * Sends a server error to PostHog error tracking, tagged with the service and environment it came
 * from. It never throws, so a PostHog outage cannot change the response the error belongs to.
 */
export async function reportException(
  client: PostHogServerClient | null,
  error: unknown,
  report: ExceptionReport,
): Promise<void> {
  if (client === null) {
    return;
  }

  // Counted per user when the user is known, but never creates or updates a person.
  const properties = {
    ...report.properties,
    environment: report.environment,
    service: report.service,
    $process_person_profile: false,
  };

  try {
    // Without a user, posthog-node would give every report a fresh id and count each as another
    // user, so errors nobody is signed in for share one id per service.
    const distinctId =
      report.distinctId ?? client.getContext()?.distinctId ?? `${report.service}-server`;

    if (report.immediate) {
      await client.captureExceptionImmediate(error, distinctId, properties);
    } else {
      client.captureException(error, distinctId, properties);
    }
  } catch (failure) {
    console.error("[PostHog] Could not report an error:", failure);
  }
}

/**
 * Tags an exception posthog-node captured by itself, such as a crash outside any request, the way
 * `reportException` tags the ones it sends: with its environment and service, under the service's
 * own id, and without creating a person.
 */
export function tagUnreportedExceptions(
  service: PostHogService,
  environment: string,
): (event: ServerEvent | null) => ServerEvent | null {
  return (event) => {
    if (event?.event !== "$exception" || event.properties?.service !== undefined) {
      return event;
    }

    return {
      ...event,
      distinctId: `${service}-server`,
      properties: { ...event.properties, environment, service, $process_person_profile: false },
    };
  };
}

/**
 * Shutdown the PostHog client (call this when the server is shutting down)
 */
export async function shutdownPostHog(): Promise<void> {
  if (posthogClient) {
    await posthogClient.shutdown();
    posthogClient = null;
  }
}
