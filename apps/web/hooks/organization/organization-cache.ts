import { withPrincipal } from "@/hooks/principal-query-key";
import { orpc } from "@/lib/orpc";
import type { QueryClient, QueryKey } from "@tanstack/react-query";

/**
 * The organization screens read through two idioms at once: Nest endpoints via
 * oRPC (the directory, profiles, rosters, teams) and Better Auth directly for the
 * models whose state machines the plugin owns (invitations). Every Better Auth
 * write therefore has to invalidate the oRPC queries it moved, or a screen keeps
 * rendering the roster it had before the write landed.
 *
 * The families are listed per kind of write rather than as one blanket set, so a
 * team rename does not re-fetch the directory.
 */

/**
 * Better Auth reads sit under the `["auth", …]` namespace `useSignOut` clears, and
 * are principal-scoped for the same reason the oRPC ones are: the QueryClient is
 * module-level and survives a client-side sign-out.
 */
export const ORGANIZATION_AUTH_QUERY_KEY = ["auth", "organization"] as const;

/** Pending invitations of one organization, read through Better Auth. */
export function organizationInvitationsQueryKey(
  userId: string | undefined,
  organizationId: string,
): QueryKey {
  return withPrincipal([...ORGANIZATION_AUTH_QUERY_KEY, "invitations", organizationId], userId);
}

/**
 * The caller's own pending invitations, across every organization. Session-scoped
 * server-side — Better Auth answers for the signed-in address and refuses to take
 * another — so the principal segment is the only thing keeping the next user on
 * this browser from reading them as their own.
 */
export function myOrganizationInvitationsQueryKey(userId: string | undefined): QueryKey {
  return withPrincipal(myOrganizationInvitationsFamily(), userId);
}

/** Every principal's copy of that list, as a prefix. */
export function myOrganizationInvitationsFamily(): QueryKey {
  return [...ORGANIZATION_AUTH_QUERY_KEY, "my-invitations"];
}

/**
 * The Better Auth member-row map, as a prefix over every organization and principal.
 *
 * Load-bearing rather than cosmetic: that map is the only source of the `member` row
 * id a role write addresses, so a membership row created or removed without
 * refreshing it leaves a new member with no role control — and, after a
 * remove-then-rejoin, leaves a cached id pointing at the deleted row.
 */
export function organizationMemberRowFamily(): QueryKey {
  return [...ORGANIZATION_AUTH_QUERY_KEY, "member-rows"];
}

/**
 * Every Better Auth-backed organization read at once. Used when an organization
 * stops existing, where narrowing by id would only leave the rest behind.
 */
export function organizationAuthFamilies(): QueryKey[] {
  return [[...ORGANIZATION_AUTH_QUERY_KEY]];
}

/** Profile, directory and my-organizations: what an organization's own fields feed. */
export function organizationProfileFamilies(): QueryKey[] {
  return [
    orpc.organizations.listMyOrganizations.key(),
    orpc.organizations.listOrganizations.key(),
    orpc.organizations.getOrganization.key(),
    orpc.search.globalSearch.key(),
  ];
}

/**
 * Roster writes move the member counts the directory, the profile and
 * my-organizations all display, and the join-request queue (an approved request
 * leaves the pending list as a member arrives).
 */
export function organizationMembershipFamilies(): QueryKey[] {
  return [
    ...organizationProfileFamilies(),
    orpc.organizations.listOrganizationMembers.key(),
    orpc.organizations.listOrganizationJoinRequests.key(),
    // Losing a member drops them from every team they were on.
    orpc.organizations.listOrganizationTeams.key(),
    // A membership change can flip an existing direct grantee between internal and
    // outside collaborator, which the collaborators list renders as a badge.
    ...organizationTeamGranteeFamilies(),
    organizationMemberRowFamily(),
  ];
}

/**
 * Teams appear in the teams surface and, as grantees, in the sharing picker and
 * the collaborator rows — where a team grant renders its live member count.
 */
export function organizationTeamGranteeFamilies(): QueryKey[] {
  return [orpc.organizations.listGranteeTeams.key(), orpc.sharing.listGrants.key()];
}

export function organizationTeamFamilies(): QueryKey[] {
  return [
    orpc.organizations.listOrganizationTeams.key(),
    orpc.search.globalSearch.key(),
    ...organizationTeamGranteeFamilies(),
  ];
}

/**
 * Sequential rather than concurrent: `invalidateQueries` resolves once the
 * refetches it triggered settle, and awaiting them in order keeps a mutation's
 * `isPending` true until every screen it touched has caught up.
 */
export async function invalidateFamilies(
  queryClient: QueryClient,
  families: QueryKey[],
): Promise<void> {
  for (const queryKey of families) {
    await queryClient.invalidateQueries({ queryKey });
  }
}
