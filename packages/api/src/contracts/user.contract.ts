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
  zCreateInvitationBody,
  zUpdateInvitationRoleBody,
  zInvitationIdPathParam,
  zListInvitationsQuery,
  zDeletionBlockersResponse,
  zWhatsNewSeenResponse,
  zMarkWhatsNewSeenBody,
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

  getDeletionBlockers: {
    method: "GET",
    path: "/api/v1/users/:id/deletion-blockers",
    pathParams: zUserIdPathParam,
    responses: {
      200: zDeletionBlockersResponse,
      403: zErrorResponse,
      404: zErrorResponse,
    },
    summary: "List account-deletion blockers",
    description:
      "Returns the experiments where the user is the only admin (blocking account deletion), each with its other members as transfer candidates",
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

  createInvitation: {
    method: "POST",
    path: "/api/v1/invitations",
    body: zCreateInvitationBody,
    responses: {
      201: zInvitation,
      400: zErrorResponse,
      403: zErrorResponse,
      409: zErrorResponse,
    },
    summary: "Create invitation",
    description: "Creates an invitation for a user to join a resource.",
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

  getWhatsNewSeen: {
    method: "GET",
    path: "/api/v1/whats-new/seen",
    responses: {
      200: zWhatsNewSeenResponse,
      401: zErrorResponse,
      404: zErrorResponse,
    },
    summary: "Get the caller's What's new last-seen timestamp",
    description:
      "Returns the timestamp the authenticated user last opened the What's new panel, used to compute the unread indicator. null means the user has never opened it.",
  },

  markWhatsNewSeen: {
    method: "POST",
    path: "/api/v1/whats-new/seen",
    body: zMarkWhatsNewSeenBody,
    responses: {
      200: zWhatsNewSeenResponse,
      401: zErrorResponse,
      404: zErrorResponse,
    },
    summary: "Mark What's new as seen",
    description:
      "Sets the authenticated user's What's new last-seen timestamp to now, clearing the unread indicator across their devices. Returns the new timestamp.",
  },
});
