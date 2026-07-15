"use client";

import { useEffect, useState } from "react";

import { authClient } from "@repo/auth/client";

/**
 * Hook returning the last used login method ("email", "github", "orcid",
 * "passkey") or null. Read in an effect: the value comes from a non-httpOnly
 * cookie, so reading during render would mismatch SSR markup.
 */
export function useLastLoginMethod() {
  const [method, setMethod] = useState<string | null>(null);

  useEffect(() => {
    setMethod(authClient.getLastUsedLoginMethod());
  }, []);

  return method;
}
