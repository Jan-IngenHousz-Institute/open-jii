"use client";

import { useSyncExternalStore } from "react";

import { authClient } from "@repo/auth/client";

const subscribe = () => () => undefined;

/**
 * Hook returning the last used login method ("email", "github", "orcid",
 * "passkey") or null. The value comes from a non-httpOnly cookie, so the server
 * snapshot is null to keep SSR and hydration markup matching.
 */
export function useLastLoginMethod() {
  return useSyncExternalStore(
    subscribe,
    () => authClient.getLastUsedLoginMethod(),
    () => null,
  );
}
