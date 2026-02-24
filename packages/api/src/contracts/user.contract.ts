import { initContract } from "@ts-rest/core";

import { zErrorResponse } from "../schemas/experiment.schema";
import {
  zUser,
  zUserProfileList,
  zSearchUsersQuery,
  zUserIdPathParam,
  zCreateUserProfileBody,
  zCreateUserProfileResponse,
  zUserProfile,
  zWebhookAuthHeader,
  zUserMetadataWebhookPayload,
  zUserMetadataWebhookResponse,
  zWebhookErrorResponse,
  zInvitation,
  zInvitationList,
  zCreateInvitationsBody,
  zUpdateInvitationRoleBody,
  zInvitationIdPathParam,
  zListInvitationsQuery,
} from "../schemas/user.schema";

const c = initContract();

export const userContract = c.router({
  searchUsers: {
    method: "GET",
    path: "/api/v1/users/search",
    query: zSearchUsersQuery,
    responses: {
      200: zUserProfileList,
      400: zErrorResponse,
    },
    summary: "Search users",
    description: "Search for users by name or email with pagination support",
  },

  getUser: {
    method: "GET",
    path: "/api/v1/users/:id",
    pathParams: zUserIdPathParam,
    responses: {
      200: zUser,
      404: zErrorResponse,
    },
    summary: "Get a user by ID",
    description: "Returns a single user by their unique identifier",
  },

  createUserProfile: {
    method: "POST",
    path: "/api/v1/users/profile",
    body: zCreateUserProfileBody,
    responses: {
      201: zCreateUserProfileResponse,
      400: zErrorResponse,
    },
    summary: "Create user profile",
    description: "Creates user profile and sets the user as registered",
  },

  getUserProfile: {
    method: "GET",
    path: "/api/v1/users/:id/profile",
    pathParams: zUserIdPathParam,
    responses: {
      200: zUserProfile,
      404: zErrorResponse,
    },
    summary: "Get user profile",
    description:
      "Returns the user's profile information including firstName, lastName, bio, and organization",
  },

  deleteUser: {
    method: "DELETE",
    path: "/api/v1/users/:id",
    pathParams: zUserIdPathParam,
    responses: {
      204: null,
      403: zErrorResponse,
      404: zErrorResponse,
    },
    summary: "Delete a user",
    description: "Deletes a user by their ID if allowed",
  },

  getUserMetadata: {
    method: "POST",
    path: "/api/v1/users/metadata",
    body: zUserMetadataWebhookPayload,
    headers: zWebhookAuthHeader,
    responses: {
      200: zUserMetadataWebhookResponse,
      400: zWebhookErrorResponse,
      401: zWebhookErrorResponse,
    },
    summary: "Get user metadata for Databricks pipelines",
    description:
      "Fetches user profile metadata (firstName, lastName, avatarUrl) for multiple user IDs to populate Databricks pipeline tables",
  },

  createInvitations: {
    method: "POST",
    path: "/api/v1/invitations",
    body: zCreateInvitationsBody,
    responses: {
      201: zInvitationList,
      400: zErrorResponse,
      403: zErrorResponse,
    },
    summary: "Create invitations",
    description: "Creates one or more invitations for users to join a resource. Skips duplicates.",
  },

  listInvitations: {
    method: "GET",
    path: "/api/v1/invitations",
    query: zListInvitationsQuery,
    responses: {
      200: zInvitationList,
      400: zErrorResponse,
      403: zErrorResponse,
    },
    summary: "List invitations",
    description: "Returns all pending invitations for a given resource.",
  },

  updateInvitationRole: {
    method: "PATCH",
    path: "/api/v1/invitations/:invitationId",
    pathParams: zInvitationIdPathParam,
    body: zUpdateInvitationRoleBody,
    responses: {
      200: zInvitation,
      400: zErrorResponse,
      403: zErrorResponse,
      404: zErrorResponse,
    },
    summary: "Update invitation role",
    description: "Updates the role on a pending invitation.",
  },

  revokeInvitation: {
    method: "DELETE",
    path: "/api/v1/invitations/:invitationId",
    pathParams: zInvitationIdPathParam,
    responses: {
      204: null,
      400: zErrorResponse,
      403: zErrorResponse,
      404: zErrorResponse,
    },
    summary: "Revoke invitation",
    description: "Revokes a pending invitation so it can no longer be accepted.",
  },
});
