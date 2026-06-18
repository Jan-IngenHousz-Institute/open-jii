import { initContract } from "@ts-rest/core";

import {
  zCreateResourceGrantBody,
  zResourceAccess,
  zResourceGrant,
  zResourceGrantList,
  zResourceGrantPathParams,
  zRevokeGrantPathParams,
  zRevokeGrantResponse,
  zSharingErrorResponse,
} from "../schemas/sharing.schema";

const c = initContract();

/**
 * Generalized per-resource sharing, backed by resource_grants and gated by the
 * AuthorizationService. Works for any resource type (experiment/macro/…); a
 * grantee can be a user, an organization, or a team.
 */
export const sharingContract = c.router({
  getResourceAccess: {
    method: "GET",
    path: "/api/v1/resources/:resourceType/:resourceId/access",
    pathParams: zResourceGrantPathParams,
    responses: {
      200: zResourceAccess,
    },
    summary: "Get the caller's effective permissions on a resource",
    description: "Returns canRead/canUpdate/canDelete/canShare for the current user.",
  },

  listResourceGrants: {
    method: "GET",
    path: "/api/v1/resources/:resourceType/:resourceId/grants",
    pathParams: zResourceGrantPathParams,
    responses: {
      200: zResourceGrantList,
      403: zSharingErrorResponse,
      404: zSharingErrorResponse,
    },
    summary: "List grants on a resource",
    description: "Returns the grants (shares) on a resource. Requires read access to the resource.",
  },

  createResourceGrant: {
    method: "POST",
    path: "/api/v1/resources/:resourceType/:resourceId/grants",
    pathParams: zResourceGrantPathParams,
    body: zCreateResourceGrantBody,
    responses: {
      201: zResourceGrant,
      400: zSharingErrorResponse,
      403: zSharingErrorResponse,
      404: zSharingErrorResponse,
      409: zSharingErrorResponse,
    },
    summary: "Share a resource",
    description:
      "Grants a role on a resource to a user, organization, or team. Requires share access.",
  },

  revokeResourceGrant: {
    method: "DELETE",
    path: "/api/v1/resources/:resourceType/:resourceId/grants/:grantId",
    pathParams: zRevokeGrantPathParams,
    responses: {
      200: zRevokeGrantResponse,
      403: zSharingErrorResponse,
      404: zSharingErrorResponse,
    },
    summary: "Revoke a grant",
    description: "Removes a grant from a resource. Requires share access.",
  },
});
