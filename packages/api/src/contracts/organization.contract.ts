import { initContract } from "@ts-rest/core";

import {
  zCreateOrganizationJoinRequestBody,
  zListPublicOrganizationsQuery,
  zOrganizationAccess,
  zOrganizationErrorResponse,
  zOrganizationIdPathParam,
  zOrganizationJoinRequest,
  zOrganizationJoinRequestList,
  zOrganizationJoinRequestPathParam,
  zOrganizationResources,
  zOrganizationSummary,
  zOrganizationSummaryList,
} from "../schemas/organization.schema";

const c = initContract();

/**
 * Organization directory, public profiles, public-resource showcase, and
 * request-to-join. Org membership/role/invite stays on the Better Auth client;
 * this contract covers the discovery + join surfaces that aren't in that plugin.
 */
export const organizationContract = c.router({
  listPublicOrganizations: {
    method: "GET",
    path: "/api/v1/organizations/public",
    query: zListPublicOrganizationsQuery,
    responses: {
      200: zOrganizationSummaryList,
    },
    summary: "List public organizations (directory)",
    description:
      "Discoverable, request-to-join organizations. Each carries a member count and " +
      "the caller's membership status (member/pending/none).",
  },

  getOrganization: {
    method: "GET",
    path: "/api/v1/organizations/:id",
    pathParams: zOrganizationIdPathParam,
    responses: {
      200: zOrganizationSummary,
      403: zOrganizationErrorResponse,
      404: zOrganizationErrorResponse,
    },
    summary: "Get an organization profile",
    description: "Public orgs are visible to anyone; private orgs only to members.",
  },

  getOrganizationResources: {
    method: "GET",
    path: "/api/v1/organizations/:id/resources",
    pathParams: zOrganizationIdPathParam,
    responses: {
      200: zOrganizationResources,
      404: zOrganizationErrorResponse,
    },
    summary: "List an organization's public resources",
    description:
      "The org's public experiments/macros/protocols/workbooks/devices — its public " +
      "face ('what they're up to'). No membership required.",
  },

  getOrganizationAccess: {
    method: "GET",
    path: "/api/v1/organizations/:id/access",
    pathParams: zOrganizationIdPathParam,
    responses: {
      200: zOrganizationAccess,
      403: zOrganizationErrorResponse,
      404: zOrganizationErrorResponse,
    },
    summary: "List who inherits access through an organization",
    description:
      "The org's members (with role) + teams — the 'Organization access' tab for a " +
      "resource owned by this org. Requires membership of the organization.",
  },

  requestToJoin: {
    method: "POST",
    path: "/api/v1/organizations/:id/join-requests",
    pathParams: zOrganizationIdPathParam,
    body: zCreateOrganizationJoinRequestBody,
    responses: {
      201: zOrganizationJoinRequest,
      200: zOrganizationJoinRequest,
      403: zOrganizationErrorResponse,
      404: zOrganizationErrorResponse,
      409: zOrganizationErrorResponse,
    },
    summary: "Request to join a public organization",
    description: "Creates a pending join request (idempotent on an existing pending request).",
  },

  listJoinRequests: {
    method: "GET",
    path: "/api/v1/organizations/:id/join-requests",
    pathParams: zOrganizationIdPathParam,
    responses: {
      200: zOrganizationJoinRequestList,
      403: zOrganizationErrorResponse,
      404: zOrganizationErrorResponse,
    },
    summary: "List pending join requests (owner/admin)",
    description: "Pending requests for the organization. Requires owner/admin role.",
  },

  approveJoinRequest: {
    method: "POST",
    path: "/api/v1/organizations/:id/join-requests/:requestId/approve",
    pathParams: zOrganizationJoinRequestPathParam,
    body: c.type<Record<string, never>>(),
    responses: {
      200: zOrganizationJoinRequest,
      403: zOrganizationErrorResponse,
      404: zOrganizationErrorResponse,
    },
    summary: "Approve a join request (owner/admin)",
    description: "Approves the request and adds the user as an organization member.",
  },

  rejectJoinRequest: {
    method: "POST",
    path: "/api/v1/organizations/:id/join-requests/:requestId/reject",
    pathParams: zOrganizationJoinRequestPathParam,
    body: c.type<Record<string, never>>(),
    responses: {
      200: zOrganizationJoinRequest,
      403: zOrganizationErrorResponse,
      404: zOrganizationErrorResponse,
    },
    summary: "Reject a join request (owner/admin)",
    description: "Rejects the request without adding the user.",
  },

  cancelJoinRequest: {
    method: "DELETE",
    path: "/api/v1/organizations/:id/join-requests/:requestId",
    pathParams: zOrganizationJoinRequestPathParam,
    responses: {
      200: zOrganizationJoinRequest,
      403: zOrganizationErrorResponse,
      404: zOrganizationErrorResponse,
    },
    summary: "Cancel your own join request",
    description: "Cancels the caller's pending join request.",
  },
});
