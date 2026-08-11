import { oc } from "@orpc/contract";

import {
  zGranteeTeamList,
  zGranteeTeamsPathParams,
  zMyOrganizationList,
  zOrganizationDeletionBlockers,
  zOrganizationDirectory,
  zOrganizationDirectoryQuery,
  zOrganizationIdPathParam,
  zOrganizationMembers,
  zOrganizationProfile,
  zOrganizationResources,
  zOrganizationTeamList,
} from "./organization.schema";

/**
 * Reads over the Better Auth organization models. Every write on those models goes
 * through `authClient.organization.*` instead — the plugin owns their state
 * machines — so this contract is deliberately GET-only.
 *
 * Personal workspaces are excluded from all of it except `listMyOrganizations`,
 * which needs them as the default target of the resource create pickers.
 */
export const organizationContract = {
  /**
   * The directory: public, non-personal organizations, whether or not the caller
   * belongs to them. `membershipStatus` per row is what the join CTA keys off.
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
   */
  listOrganizationResources: oc
    .route({ method: "GET", path: "/api/v1/organizations/{id}/resources", successStatus: 200 })
    .input(zOrganizationIdPathParam)
    .output(zOrganizationResources),
  /** Roster plus the derived outside-collaborator view. Members only. */
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
  /** Teams with their members, for the teams surface. Members only. */
  listOrganizationTeams: oc
    .route({ method: "GET", path: "/api/v1/organizations/{id}/teams", successStatus: 200 })
    .input(zOrganizationIdPathParam)
    .output(zOrganizationTeamList),
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
