import { oc } from "@orpc/contract";
import { z } from "zod";

import { zOrganizationIdPathParam } from "../organization.schema";
import {
  zCreateOrganizationJoinRequestBody,
  zDecideOrganizationJoinRequestBody,
  zOrganizationJoinRequest,
  zOrganizationJoinRequestList,
  zOrganizationJoinRequestPathParam,
} from "./organization-join-requests.schema";

/**
 * Asking to join a public organization. Better Auth has no join-request concept, so
 * this is a plain Nest domain over `organization_join_requests`; approval is one of
 * the two places where Nest writes a Better Auth model directly, because the member
 * row and the status flip have to land in the same transaction.
 */
export const organizationJoinRequestsContract = {
  /**
   * Public, non-personal organizations only. A duplicate submit returns the
   * existing pending request rather than colliding on the partial unique index.
   */
  createOrganizationJoinRequest: oc
    .route({
      method: "POST",
      path: "/api/v1/organizations/{id}/join-requests",
      successStatus: 201,
    })
    .input(zOrganizationIdPathParam.and(zCreateOrganizationJoinRequestBody))
    .output(zOrganizationJoinRequest),
  /** Owners and admins: pending requests first, then the decided history. */
  listOrganizationJoinRequests: oc
    .route({ method: "GET", path: "/api/v1/organizations/{id}/join-requests", successStatus: 200 })
    .input(zOrganizationIdPathParam)
    .output(zOrganizationJoinRequestList),
  /** Withdraw one's own pending request. */
  cancelMyOrganizationJoinRequest: oc
    .route({
      method: "DELETE",
      path: "/api/v1/organizations/{id}/join-requests/me",
      successStatus: 204,
    })
    .input(zOrganizationIdPathParam)
    .output(z.void()),
  decideOrganizationJoinRequest: oc
    .route({
      method: "PATCH",
      path: "/api/v1/organizations/{id}/join-requests/{requestId}",
      successStatus: 200,
    })
    .input(zOrganizationJoinRequestPathParam.merge(zDecideOrganizationJoinRequestBody))
    .output(zOrganizationJoinRequest),
};
