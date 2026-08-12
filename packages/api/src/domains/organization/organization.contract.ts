import { oc } from "@orpc/contract";

import {
  zAddOrganizationMemberBody,
  zGranteeTeamList,
  zGranteeTeamsPathParams,
  zMyOrganizationList,
  zOrganizationMember,
  zOrganizationDeletionBlockers,
  zOrganizationDirectory,
  zOrganizationDirectoryQuery,
  zOrganizationIdPathParam,
  zOrganizationMembers,
  zOrganizationProfile,
  zOrganizationResources,
  zOrganizationTeamGrantList,
  zOrganizationTeamList,
} from "./organization.schema";

/**
 * Reads over the Better Auth organization models, plus the one write on them that
 * has no Better Auth path: admitting a registered user outright. Everything with a
 * state machine behind it — invitations above all — still goes through
 * `authClient.organization.*`, because the plugin owns that machine.
 *
 * Personal workspaces are excluded from all of it except `listMyOrganizations`,
 * which needs them as the default target of the resource create pickers.
 */
export const organizationContract = {
  /**
   * The directory: non-personal organizations the caller may see — every public one,
   * plus the private ones they belong to. `membershipStatus` per row is what the join
   * CTA keys off.
   *
   * Unpaged, and every matching row comes back: this is the only listing of
   * organizations there is, so "all" has to mean all. The payload is therefore
   * unbounded in the number of organizations — an accepted trade.
   */
  listOrganizations: oc
    .route({ method: "GET", path: "/api/v1/organizations", successStatus: 200 })
    .input(zOrganizationDirectoryQuery)
    .output(zOrganizationDirectory),
  /**
   * Organizations the caller belongs to, personal workspace included and flagged.
   * Declared on the users domain path because it is a fact about the caller.
   */
  listMyOrganizations: oc
    .route({ method: "GET", path: "/api/v1/users/me/organizations", successStatus: 200 })
    .output(zMyOrganizationList),
  /**
   * A private organization answers 404 rather than 403 for non-members: a 403
   * would confirm that an organization with that id exists.
   */
  getOrganization: oc
    .route({ method: "GET", path: "/api/v1/organizations/{id}", successStatus: 200 })
    .input(zOrganizationIdPathParam)
    .output(zOrganizationProfile),
  /**
   * Resources showcase. Each type's access-scoped `findAll` does the filtering, so
   * an outsider sees the public rows and a member sees everything they may read.
   * `totals` counts the same access-scoped set the capped rows come from.
   */
  listOrganizationResources: oc
    .route({ method: "GET", path: "/api/v1/organizations/{id}/resources", successStatus: 200 })
    .input(zOrganizationIdPathParam)
    .output(zOrganizationResources),
  /** The roster. Members only: who belongs to an organization is not public. */
  listOrganizationMembers: oc
    .route({ method: "GET", path: "/api/v1/organizations/{id}/members", successStatus: 200 })
    .input(zOrganizationIdPathParam)
    .output(zOrganizationMembers),
  /**
   * What blocks this organization's deletion, across all five owned resource types.
   * Owner-only, because deleting is: it answers the same question the delete guard
   * asks, so the danger zone can refuse up front instead of after a confirmation.
   */
  getOrganizationDeletionBlockers: oc
    .route({
      method: "GET",
      path: "/api/v1/organizations/{id}/deletion-blockers",
      successStatus: 200,
    })
    .input(zOrganizationIdPathParam)
    .output(zOrganizationDeletionBlockers),
  /**
   * Admit a registered user straight onto the roster — the invite dialog's search
   * result, which is a person with an account rather than an address to reach.
   *
   * Owners and admins, bounded by their own role: an admin may admit members and
   * admins, only an owner may admit an owner. Somebody already on the roster is a
   * conflict, not a silent no-op — the dialog offered them as addable and needs to
   * be told it was wrong.
   */
  addOrganizationMember: oc
    .route({ method: "POST", path: "/api/v1/organizations/{id}/members", successStatus: 201 })
    .input(zOrganizationIdPathParam.merge(zAddOrganizationMemberBody))
    .output(zOrganizationMember),
  /** Teams with their members, for the teams surface. Members only. */
  listOrganizationTeams: oc
    .route({ method: "GET", path: "/api/v1/organizations/{id}/teams", successStatus: 200 })
    .input(zOrganizationIdPathParam)
    .output(zOrganizationTeamList),
  /**
   * What the organization's teams can reach: every grant naming one of them, across
   * all its teams in one read. Members only, the same gate as the teams themselves.
   *
   * One read for the whole organization rather than one per team, because both
   * callers want it that way — the teams grid needs a count on every card at once,
   * and a team's own page is a filter over the same answer.
   */
  listOrganizationTeamGrants: oc
    .route({ method: "GET", path: "/api/v1/organizations/{id}/team-grants", successStatus: 200 })
    .input(zOrganizationIdPathParam)
    .output(zOrganizationTeamGrantList),
  /**
   * The grantee picker's team source: teams of the resource's **owning** org, so a
   * team can never be granted access outside the organization it belongs to. Gated
   * on `can(share)` like the rest of the sharing surface rather than on membership.
   */
  listGranteeTeams: oc
    .route({
      method: "GET",
      path: "/api/v1/{resourceType}/{id}/grantee-teams",
      successStatus: 200,
    })
    .input(zGranteeTeamsPathParams)
    .output(zGranteeTeamList),
};
