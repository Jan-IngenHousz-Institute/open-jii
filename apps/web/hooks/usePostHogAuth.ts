"use client";

import posthog from "posthog-js";
import { useEffect, useRef, useSyncExternalStore } from "react";

import { flagPersonProperties } from "@repo/analytics";
import { useSession } from "@repo/auth/client";

import { getConsentStatus, subscribeToConsentStatus } from "../lib/cookie-consent";
import { useMyOrganizations } from "./organization/useMyOrganizations/useMyOrganizations";

/**
 * Keeps PostHog in step with the signed-in user. Every flag evaluation carries their email and
 * organization memberships, so a flag can target either whatever they chose on the cookie banner;
 * identifying them, which creates their PostHog person, waits for consent.
 */
export function usePostHogAuth() {
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

  const email = session?.user.email;
  const name = session?.user.name;
  const isSignedOut = !isPending && !session;
  const hasConsented = consent === "accepted";

  useEffect(() => {
    if (!isSignedOut) {
      return;
    }

    const isIdentified = posthog.get_property("$user_state") === "identified";
    if (isIdentified || hasFlagOverrides.current) {
      posthog.reset();
      hasFlagOverrides.current = false;
    }
  }, [isSignedOut]);

  useEffect(() => {
    if (email && hasConsented) {
      posthog.identify(email, { email, name });
    }
  }, [email, name, hasConsented]);

  // Both cookie-banner choices reset PostHog, so any consent change re-applies the overrides.
  // A failed membership fetch still sends the email rather than holding every flag back.
  useEffect(() => {
    if (!email || isOrganizationsPending) {
      return;
    }

    const properties = flagPersonProperties({
      email,
      organizationIds: organizations?.map(({ id }) => id) ?? [],
    });
    posthog.setPersonPropertiesForFlags(properties, true);
    hasFlagOverrides.current = true;

    // Stored on the person, so PostHog's release-condition picker can offer the properties.
    if (consent === "accepted") {
      posthog.setPersonProperties(properties);
    }
  }, [email, organizations, isOrganizationsPending, consent]);
}

/**
 * Client component that calls the PostHog auth hook
 */
export function PostHogIdentifier() {
  "use client";
  usePostHogAuth();
  return null;
}
