/**
 * Server-side PostHog utilities for Next.js
 * Re-exports from @repo/analytics/server for convenience
 */
import { cache } from "react";
import { auth } from "~/app/actions/auth";
import { env } from "~/env";

import type { FeatureFlagKey, FlagUser } from "@repo/analytics";
import { flagPersonProperties } from "@repo/analytics";
import {
  initializePostHogServer,
  isFeatureFlagEnabled as isFeatureFlagEnabledBase,
  shutdownPostHog as shutdownPostHogBase,
} from "@repo/analytics/server";

import { POSTHOG_SERVER_CONFIG } from "./posthog-config";
import { createServerOrpcClient } from "./server-orpc";

// Track initialization state
let initialized = false;

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
  } catch (error) {
    console.error("[PostHog] Failed to load memberships for flag evaluation:", error);
    return [];
  }
});

/**
 * Check a feature flag for the signed-in user making this request, as the same person the browser
 * and the backend evaluate, with their email and organization memberships
 */
export async function isFeatureFlagEnabledForUser(
  flagKey: FeatureFlagKey,
  user: FlagUser,
): Promise<boolean> {
  const organizationIds = await fetchMyOrganizationIds();
  return isFeatureFlagEnabled(
    flagKey,
    user.email || user.id,
    flagPersonProperties({ email: user.email, organizationIds }),
  );
}

/**
 * Check a feature flag for whoever is making this request, anonymously when nobody is signed in
 */
export async function isFeatureFlagEnabledForViewer(flagKey: FeatureFlagKey): Promise<boolean> {
  const session = await auth();
  if (!session) {
    return isFeatureFlagEnabled(flagKey);
  }

  return isFeatureFlagEnabledForUser(flagKey, session.user);
}

/**
 * Shutdown the PostHog client (call this when the server is shutting down)
 */
export async function shutdownPostHog(): Promise<void> {
  if (initialized) {
    await shutdownPostHogBase();
    initialized = false;
  }
}
