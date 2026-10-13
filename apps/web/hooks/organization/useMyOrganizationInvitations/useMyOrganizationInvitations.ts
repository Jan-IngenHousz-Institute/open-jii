"use client";

import { usePrincipal } from "@/components/auth/principal-context";
import { unwrapAuthResult } from "@/hooks/organization/auth-organization-result";
import { myOrganizationInvitationsQueryKey } from "@/hooks/organization/organization-cache";
import { useQuery } from "@tanstack/react-query";
import { liveInvitations } from "~/components/organizations/organization-invitation-state";

import { authClient } from "@repo/auth/client";

/**
 * Every invitation waiting for the signed-in account, whichever organization sent
 * it. Better Auth answers this one for the session's own address and refuses to be
 * given another, so there is no input: the principal in the key is the query.
 *
 * It filters to `status === "pending"` server-side but does not check expiry, and a
 * past-due invitation keeps its stored `pending` status — so liveness is applied
 * here, the same rule the Invited tab uses. Offering an expired one would produce a
 * row whose Accept can only fail.
 *
 * A refusal is an answer and is not retried: Better Auth returns 403 for an
 * unverified address unconditionally, ignoring `requireEmailVerificationOnInvitation`.
 * Callers must render that as an error rather than as an empty list.
 */
export const useMyOrganizationInvitations = (options?: { enabled?: boolean }) => {
  const { userId, isPending: isSessionPending } = usePrincipal();

  return useQuery({
    queryKey: myOrganizationInvitationsQueryKey(userId),
    queryFn: async () =>
      liveInvitations(unwrapAuthResult(await authClient.organization.listUserInvitations())),
    retry: false,
    enabled: (options?.enabled ?? true) && !isSessionPending && !!userId,
  });
};
