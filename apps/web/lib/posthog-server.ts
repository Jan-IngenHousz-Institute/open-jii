/**
 * Server-side PostHog utilities for Next.js
 * Re-exports from @repo/analytics/server for convenience
 */
import { cache } from "react";
import { auth } from "~/app/actions/auth";
import { env } from "~/env";

import type { FeatureFlagKey } from "@repo/analytics";
import { flagPersonProperties } from "@repo/analytics";
import {
  getPostHogServerClient,
  initializePostHogServer,
  isFeatureFlagEnabled as isFeatureFlagEnabledBase,
  reportException,
  shutdownPostHog as shutdownPostHogBase,
} from "@repo/analytics/server";

import { POSTHOG_SERVER_CONFIG } from "./posthog-config";
import { createServerOrpcClient } from "./server-orpc";

// Track initialization state
let initialized = false;

// A failure that repeats on every render, such as a CMS outage, reaches PostHog once a minute per
// server instance instead of adding a round trip to every request.
const REPORT_INTERVAL_MS = 60_000;
const MAX_TRACKED_ERRORS = 100;
const lastReportedAt = new Map<string, number>();

function isDueForReport(error: unknown): boolean {
  const key = error instanceof Error ? `${error.name}: ${error.message}` : String(error);
  const now = Date.now();
  const last = lastReportedAt.get(key);
  if (last !== undefined && now - last < REPORT_INTERVAL_MS) {
    return false;
  }

  // Re-inserted so the map stays in the order errors were last reported, oldest first.
  lastReportedAt.delete(key);
  if (lastReportedAt.size >= MAX_TRACKED_ERRORS) {
    const oldest = lastReportedAt.keys().next();
    if (!oldest.done) {
      lastReportedAt.delete(oldest.value);
    }
  }
  lastReportedAt.set(key, now);
  return true;
}

/**
 * Initialize PostHog server client (call once at app startup)
 */
async function ensureInitialized(): Promise<void> {
  if (initialized) return;

  const key = env.NEXT_PUBLIC_POSTHOG_KEY;
  if (!key || key === "phc_0000") {
    return;
  }

  initialized = await initializePostHogServer(key, POSTHOG_SERVER_CONFIG);
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
  await ensureInitialized();
  return isFeatureFlagEnabledBase(flagKey, distinctId, personProperties);
}

const fetchMyOrganizationIds = cache(async () => {
  try {
    const client = await createServerOrpcClient();
    const organizations = await client.organizations.listMyOrganizations();
    return organizations.map(({ id }) => id);
  } catch {
    return [];
  }
});

/**
 * Check a feature flag as the requesting user: signed in, as the same person the browser and the
 * backend evaluate, with their email and organization memberships; otherwise anonymously
 */
export async function isFeatureFlagEnabledForViewer(flagKey: FeatureFlagKey): Promise<boolean> {
  const session = await auth();
  if (!session) {
    return isFeatureFlagEnabled(flagKey);
  }

  const { id, email } = session.user;
  const organizationIds = await fetchMyOrganizationIds();
  return isFeatureFlagEnabled(
    flagKey,
    email || id,
    flagPersonProperties({ email, organizationIds }),
  );
}

/**
 * Report a server-side error to PostHog error tracking. Sent before resolving, since the Lambda
 * that renders the page is frozen once it responds.
 */
export async function reportServerError(
  error: unknown,
  properties: Record<string, unknown>,
): Promise<void> {
  if (!isDueForReport(error)) {
    return;
  }

  await ensureInitialized();
  await reportException(getPostHogServerClient(), error, {
    service: "web",
    environment: env.NEXT_PUBLIC_ENVIRONMENT,
    properties,
    immediate: true,
  });
}

/**
 * Shutdown the PostHog client (call this when the server is shutting down)
 */
export async function shutdownPostHog(): Promise<void> {
  lastReportedAt.clear();
  if (initialized) {
    await shutdownPostHogBase();
    initialized = false;
  }
}
