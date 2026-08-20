"use client";

import { unwrapAuthResult } from "@/hooks/organization/auth-organization-result";
import { ORGANIZATION_AUTH_QUERY_KEY } from "@/hooks/organization/organization-cache";
import { withPrincipal } from "@/hooks/principal-query-key";
import { useQuery } from "@tanstack/react-query";

import { authClient, useSession } from "@repo/auth/client";

/**
 * The organization's Better Auth membership rows, read for one thing the roster
 * endpoint does not carry: the id of the `member` row itself.
 *
 * Better Auth's role-update endpoint identifies a member by that row id, not by
 * user id, and the oRPC roster returns the profile-joined view (names, avatars,
 * outside collaborators) keyed by `userId`. So the two are read side by side and
 * joined on `userId` — the roster is what is rendered, this is what a write
 * addresses. Members only, so a refusal is an answer and is not retried.
 */
export const useOrganizationMemberRows = (
  organizationId: string,
  options?: { enabled?: boolean },
) => {
  const { data: session, isPending: isSessionPending } = useSession();
  const userId = session?.user.id;

  return useQuery({
    queryKey: withPrincipal(
      [...ORGANIZATION_AUTH_QUERY_KEY, "member-rows", organizationId],
      userId,
    ),
    queryFn: async () =>
      unwrapAuthResult(await authClient.organization.listMembers({ query: { organizationId } })),
    retry: false,
    enabled: (options?.enabled ?? true) && !!organizationId && !isSessionPending,
  });
};
