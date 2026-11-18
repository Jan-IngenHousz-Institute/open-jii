"use client";

import { unwrapAuthResult } from "@/hooks/organization/auth-organization-result";
import { useQuery } from "@tanstack/react-query";

import { authClient } from "@repo/auth/client";

export const LINKED_ACCOUNTS_KEY = ["auth", "accounts"] as const;

/**
 * Hook to list the current user's `accounts` rows. `id` is the row id that unlinking and
 * the account-info lookup take; `accountId` is the provider's own id (an ORCID iD).
 */
export function useLinkedAccounts() {
  return useQuery({
    queryKey: LINKED_ACCOUNTS_KEY,
    queryFn: async () => unwrapAuthResult(await authClient.listAccounts()),
  });
}
