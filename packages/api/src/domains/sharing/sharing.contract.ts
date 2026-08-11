import { oc } from "@orpc/contract";
import { z } from "zod";

import {
  zCollaboratorGrantPathParams,
  zCollaboratorsPathParams,
  zCreateCollaboratorBody,
  zGranteeOrganizationList,
  zResourceGrantList,
  zSearchGranteeOrganizationsQuery,
  zUpdateCollaboratorBody,
} from "./sharing.schema";

/**
 * Generic per-resource sharing (collaborators) over the polymorphic
 * `resource_grants` table — one contract for every shareable type. Authorization is
 * `can(share)` inside each use-case rather than a static guard, because
 * `resourceType` is a runtime path value.
 *
 * Every operation is scoped to its resource, so a grant id from elsewhere cannot be
 * read or edited through it, and `listGrants` is gated on `share` rather than
 * `read` so collaborator identities are not enumerable on public resources.
 *
 * Mutations return the full updated list so the UI needs no follow-up fetch.
 */
export const sharingContract = {
  listGrants: oc
    .route({
      method: "GET",
      path: "/api/v1/{resourceType}/{id}/collaborators",
      successStatus: 200,
    })
    .input(zCollaboratorsPathParams)
    .output(zResourceGrantList),
  createGrant: oc
    .route({
      method: "POST",
      path: "/api/v1/{resourceType}/{id}/collaborators",
      successStatus: 201,
    })
    .input(zCollaboratorsPathParams.merge(zCreateCollaboratorBody))
    .output(zResourceGrantList),
  updateGrant: oc
    .route({
      method: "PATCH",
      path: "/api/v1/{resourceType}/{id}/collaborators/{grantId}",
      successStatus: 200,
    })
    .input(zCollaboratorGrantPathParams.merge(zUpdateCollaboratorBody))
    .output(zResourceGrantList),
  /**
   * Give up the caller's own direct grant ("leave"). The one sharing operation NOT
   * gated on `share`: the caller's own grant is the authority, so a "Can view"
   * grantee can remove themselves even though the collaborators list is invisible to
   * them. A uniform 404 when they hold no direct grant — including access held only
   * via an org grant or org membership (leaving an organization is a different
   * operation) — so nothing about the resource or its other grantees is disclosed.
   * Declared before `revokeGrant` so `me` is matched ahead of `{grantId}`.
   */
  leaveResource: oc
    .route({
      method: "DELETE",
      path: "/api/v1/{resourceType}/{id}/collaborators/me",
      successStatus: 204,
    })
    .input(zCollaboratorsPathParams)
    .output(z.void()),
  revokeGrant: oc
    .route({
      method: "DELETE",
      path: "/api/v1/{resourceType}/{id}/collaborators/{grantId}",
      successStatus: 204,
    })
    .input(zCollaboratorGrantPathParams)
    .output(z.void()),
  /**
   * Organization lookup for the grantee picker. Lives in the sharing domain rather
   * than a general `organizations` one because it exists solely to feed that picker
   * and is scoped accordingly — organizations the caller is a member of, personal
   * workspaces excluded.
   *
   * Its own path, not `/organizations/search`: the organizations domain owns
   * `/organizations/{id}`, and a literal segment inside somebody else's collection
   * resolves by controller registration order, which nothing here can guarantee.
   */
  searchGranteeOrganizations: oc
    .route({
      method: "GET",
      path: "/api/v1/grantee-organizations",
      successStatus: 200,
    })
    .input(zSearchGranteeOrganizationsQuery)
    .output(zGranteeOrganizationList),
};
