"use client";

import { unwrapAuthResult } from "@/hooks/organization/auth-organization-result";
import { useQuery } from "@tanstack/react-query";

import { authClient } from "@repo/auth/client";

/**
 * Hook to read a connected account's provider profile, for the GitHub username that
 * `accounts` does not store. Better Auth fetches it live with the token stored on the
 * row, so it fails for good once the person revokes openJII's access at the provider:
 * no retry, and kept for a long time once read.
 */
export function useAccountInfo(accountId: string, enabled: boolean) {
  return useQuery({
    queryKey: ["auth", "account-info", accountId],
    queryFn: async () => unwrapAuthResult(await authClient.accountInfo({ query: { accountId } })),
    enabled,
    retry: false,
    staleTime: 60 * 60 * 1000,
  });
}

/** The `login` field of a GitHub profile; the profile's type is only `object`. */
export function profileLogin(profile: object | undefined): string | undefined {
  if (!profile || !("login" in profile)) return undefined;
  return typeof profile.login === "string" ? profile.login : undefined;
}
