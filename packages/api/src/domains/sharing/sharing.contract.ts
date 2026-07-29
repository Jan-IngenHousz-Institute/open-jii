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
 * Generic per-resource sharing (collaborators), backed by the polymorphic
 * `resource_grants` table and gated inside each use-case by
 * `can(userId, { resourceType, resourceId, action: "share" })` — no static guard,
 * since `resourceType` is a runtime path value. One contract serves
 * every shareable resource type (experiment/macro/protocol/workbook).
 *
 * Every operation is scoped to its resource, so a grant id from elsewhere cannot be
 * read or edited through it. listGrants is gated on `share` (not `read`) so
 * collaborator identities are not enumerable on public resources.
 *
 * Mutations return the full updated collaborators list so the UI can render it
 * without a follow-up fetch.
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
   * Give up the caller's own direct grant ("leave"). The one sharing operation
   * NOT gated on `share`: the caller's own grant is the authority, so a viewer
   * ("Can view") can remove themselves even though they can never see the
   * collaborators list. 404 when the caller holds no direct grant — including
   * access held only via an organization grant or org membership (leaving an
   * organization is a different operation) — so nothing about the resource's
   * existence or other grantees is disclosed. Declared before `revokeGrant` so
   * the literal `me` segment is matched ahead of `{grantId}`.
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
   * Organization lookup for the grantee picker's "share with an organization"
   * option. Lives in the sharing domain (not a general `organizations` domain)
   * because it exists solely to feed that picker and is scoped accordingly —
   * organizations the caller is a member of, personal workspaces excluded. A
   * full organizations domain (CRUD, members, teams, base permission) is Phase
   * 4's to design; it should absorb this route then.
   */
  searchGranteeOrganizations: oc
    .route({
      method: "GET",
      path: "/api/v1/organizations/search",
      successStatus: 200,
    })
    .input(zSearchGranteeOrganizationsQuery)
    .output(zGranteeOrganizationList),
};
