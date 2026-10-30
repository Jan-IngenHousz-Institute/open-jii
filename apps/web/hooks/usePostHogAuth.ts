"use client";

import { useEffect, useRef, useSyncExternalStore } from "react";

import { flagPersonProperties } from "@repo/analytics";
import { useSession } from "@repo/auth/client";

import { getConsentStatus, subscribeToConsentStatus } from "../lib/cookie-consent";
import { usePostHog } from "../providers/posthog-context";
import { useMyOrganizations } from "./organization/useMyOrganizations/useMyOrganizations";

/**
 * Keeps PostHog in step with the signed-in user. It names them by id, as the phone app does, so one
 * researcher is one person, and keeps the email as a property because flag cohorts and the
 * internal-user filter match on it. Every flag evaluation carries their organization memberships,
 * so a flag can target an organization whatever they chose on the cookie banner. Their email goes
 * to PostHog only once they accept analytics cookies, which is also when they are identified and
 * their PostHog person is created.
 */
export function usePostHogAuth() {
  const posthog = usePostHog();
  const { data: session, isPending } = useSession();
  const { data: organizations, isPending: isOrganizationsPending } = useMyOrganizations();
  const consent = useSyncExternalStore(
    subscribeToConsentStatus,
    getConsentStatus,
    getConsentStatus,
  );

  // Flag overrides live in memory before consent, so PostHog's own state cannot say whether
  // the tab still carries a user who has since signed out.
  const hasFlagOverrides = useRef(false);

  const id = session?.user.id;
  const email = session?.user.email;
  const isGuest = session?.user.isAnonymous === true;
  const identifiedGuest = useRef(false);
  const isSignedOut = !isPending && !session;
  const hasConsented = consent === "accepted";

  useEffect(() => {
    if (!posthog || !isSignedOut) {
      return;
    }

    const isIdentified = posthog.get_property("$user_state") === "identified";
    if (isIdentified || hasFlagOverrides.current) {
      posthog.reset();
      hasFlagOverrides.current = false;
    }
  }, [posthog, isSignedOut]);

  useEffect(() => {
    if (posthog && id && hasConsented) {
      const properties = isGuest
        ? { is_guest: true }
        : { email, ...(identifiedGuest.current ? { is_guest: false } : {}) };
      if (posthog.get_distinct_id() !== id && posthog.get_property("$user_state") === "identified")
        posthog.reset();
      posthog.identify(id, properties);
      identifiedGuest.current = isGuest;
    }
  }, [posthog, id, email, isGuest, hasConsented]);

  // Rejecting cookies resets PostHog, which drops the overrides, so every consent change
  // re-applies them. A failed membership fetch still sends what is known rather than holding every
  // flag back.
  useEffect(() => {
    if (!posthog || !id || isOrganizationsPending) {
      return;
    }

    const hasAccepted = consent === "accepted";
    const properties = flagPersonProperties({
      email: hasAccepted ? email : undefined,
      isAnonymous: isGuest,
      organizationIds: organizations?.map(({ id }) => id) ?? [],
    });
    posthog.setPersonPropertiesForFlags(properties, true);
    hasFlagOverrides.current = true;

    // Stored on the person, so PostHog's release-condition picker can offer the properties.
    if (hasAccepted) {
      posthog.setPersonProperties(properties);
    }
  }, [posthog, id, email, isGuest, organizations, isOrganizationsPending, consent]);
}

/**
 * Client component that calls the PostHog auth hook
 */
export function PostHogIdentifier() {
  "use client";
  usePostHogAuth();
  return null;
}
