/**
 * Server-side PostHog utilities for Next.js
 * Re-exports from @repo/analytics/server for convenience
 */
import { cache } from "react";
import { env } from "~/env";

import type { FeatureFlagKey } from "@repo/analytics";
import { FEATURE_FLAG_DEFAULTS, flagPersonProperties } from "@repo/analytics";
import {
  evaluateFeatureFlag as evaluateFeatureFlagBase,
  getPostHogServerClient,
  initializePostHogServer,
  isFeatureFlagEnabled as isFeatureFlagEnabledBase,
  reportException,
  shutdownPostHog as shutdownPostHogBase,
} from "@repo/analytics/server";
import { authClient } from "@repo/auth/client";
import type { Session } from "@repo/auth/types";

import { POSTHOG_SERVER_CONFIG } from "./posthog-config";
import { createOrpcClientWithCookie, createServerOrpcClient } from "./server-orpc";

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

type ApiClient = ReturnType<typeof createOrpcClientWithCookie>;

/** The person's organization ids, or null when they could not be read. */
async function listOrganizationIds(client: ApiClient): Promise<string[] | null> {
  try {
    const organizations = await client.organizations.listMyOrganizations();
    return organizations.map(({ id }) => id);
  } catch (error) {
    console.error("[PostHog] Failed to load memberships for flag evaluation:", error);
    return null;
  }
}

const fetchMyOrganizationIds = cache(async () =>
  listOrganizationIds(await createServerOrpcClient()),
);

// Every platform render asks for the person's flags, at the cost of a membership read and a call to
// PostHog. Memberships and flag rules change far less often, so an answer serves a minute of renders
// on this server instance.
const FLAG_DECISION_TTL_MS = 60_000;
const MAX_FLAG_DECISIONS = 1_000;

class FlagDecisions {
  private readonly decisions = new Map<string, { isEnabled: boolean; expiresAt: number }>();

  get(key: string): boolean | undefined {
    const decision = this.decisions.get(key);
    if (decision === undefined || decision.expiresAt <= Date.now()) {
      this.decisions.delete(key);
      return undefined;
    }
    return decision.isEnabled;
  }

  set(key: string, isEnabled: boolean): void {
    if (this.decisions.size >= MAX_FLAG_DECISIONS) {
      const oldest = this.decisions.keys().next();
      if (!oldest.done) {
        this.decisions.delete(oldest.value);
      }
    }
    this.decisions.set(key, { isEnabled, expiresAt: Date.now() + FLAG_DECISION_TTL_MS });
  }

  clear(): void {
    this.decisions.clear();
  }
}

const flagDecisions = new FlagDecisions();

function isFeatureFlagEnabledForPerson(
  flagKey: FeatureFlagKey,
  session: NonNullable<Session>,
  organizationIds: string[],
): Promise<boolean> {
  const { id, email } = session.user;
  return isFeatureFlagEnabled(
    flagKey,
    email || id,
    flagPersonProperties({ email, organizationIds }),
  );
}

/**
 * Check a feature flag for this request's signed-in session, as the same person the backend
 * evaluates. The memberships are read with the request's own cookie, so pass only the session this
 * request resolved.
 */
export async function isFeatureFlagEnabledForSession(
  flagKey: FeatureFlagKey,
  session: NonNullable<Session>,
): Promise<boolean> {
  const key = `${flagKey}:${session.user.id}`;
  const cached = flagDecisions.get(key);
  if (cached !== undefined) {
    return cached;
  }

  const organizationIds = await fetchMyOrganizationIds();
  await ensureInitialized();
  const { id, email } = session.user;
  const decision = await evaluateFeatureFlagBase(
    flagKey,
    email || id,
    flagPersonProperties({ email, organizationIds: organizationIds ?? [] }),
  );

  // A fallback, from memberships that failed to load or a PostHog that did not answer, is used
  // once and not kept, so a passing outage does not hide a feature for a minute.
  if (organizationIds !== null && decision !== undefined) {
    flagDecisions.set(key, decision);
  }
  return decision ?? FEATURE_FLAG_DEFAULTS[flagKey];
}

async function readSession(requestHeaders: Headers): Promise<Session | null> {
  try {
    const { data } = await authClient.getSession({ fetchOptions: { headers: requestHeaders } });
    return data;
  } catch (error) {
    console.error("[PostHog] Failed to read the session for flag evaluation:", error);
    return null;
  }
}

/**
 * Check a feature flag for whoever sent a request, from that request's own headers rather than
 * `next/headers`, so the proxy can decide before any page renders. Anonymous when nobody is
 * signed in.
 */
export async function isFeatureFlagEnabledForRequest(
  flagKey: FeatureFlagKey,
  requestHeaders: Headers,
): Promise<boolean> {
  const session = await readSession(requestHeaders);
  if (!session) {
    return isFeatureFlagEnabled(flagKey);
  }

  const client = createOrpcClientWithCookie(requestHeaders.get("cookie") ?? "");
  return isFeatureFlagEnabledForPerson(flagKey, session, (await listOrganizationIds(client)) ?? []);
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
  flagDecisions.clear();
  if (initialized) {
    await shutdownPostHogBase();
    initialized = false;
  }
}
