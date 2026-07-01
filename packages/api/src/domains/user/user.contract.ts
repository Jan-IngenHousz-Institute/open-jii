import { oc } from "@orpc/contract";
import { z } from "zod";

import {
  zCreateInvitationBody,
  zCreateUserProfileBody,
  zCreateUserProfileResponse,
  zDeletionBlockersResponse,
  zInvitation,
  zInvitationIdPathParam,
  zInvitationList,
  zListInvitationsQuery,
  zSearchUsersQuery,
  zUpdateInvitationRoleBody,
  zUser,
  zUserIdPathParam,
  zUserMetadataWebhookPayload,
  zUserMetadataWebhookResponse,
  zUserProfile,
  zUserProfileList,
} from "./user.schema";

export const userContract = {
  searchUsers: oc
    .route({ method: "GET", path: "/api/v1/users/search", successStatus: 200 })
    .input(zSearchUsersQuery)
    .output(zUserProfileList),
  getUser: oc
    .route({ method: "GET", path: "/api/v1/users/{id}", successStatus: 200 })
    .input(zUserIdPathParam)
    .output(zUser),
  createUserProfile: oc
    .route({ method: "POST", path: "/api/v1/users/profile", successStatus: 201 })
    .input(zCreateUserProfileBody)
    .output(zCreateUserProfileResponse),
  getUserProfile: oc
    .route({ method: "GET", path: "/api/v1/users/{id}/profile", successStatus: 200 })
    .input(zUserIdPathParam)
    .output(zUserProfile.omit({ userId: true, email: true })),
  deleteUser: oc
    .route({ method: "DELETE", path: "/api/v1/users/{id}", successStatus: 204 })
    .input(zUserIdPathParam)
    .output(z.void()),
  getDeletionBlockers: oc
    .route({ method: "GET", path: "/api/v1/users/{id}/deletion-blockers", successStatus: 200 })
    .input(zUserIdPathParam)
    .output(zDeletionBlockersResponse),
  getUserMetadata: oc
    .route({ method: "POST", path: "/api/v1/users/metadata", successStatus: 200 })
    .input(zUserMetadataWebhookPayload)
    .output(zUserMetadataWebhookResponse),
  createInvitation: oc
    .route({ method: "POST", path: "/api/v1/invitations", successStatus: 201 })
    .input(zCreateInvitationBody)
    .output(zInvitation),
  listInvitations: oc
    .route({ method: "GET", path: "/api/v1/invitations", successStatus: 200 })
    .input(zListInvitationsQuery)
    .output(zInvitationList),
  updateInvitationRole: oc
    .route({ method: "PATCH", path: "/api/v1/invitations/{invitationId}", successStatus: 200 })
    .input(zInvitationIdPathParam.merge(zUpdateInvitationRoleBody))
    .output(zInvitation),
  revokeInvitation: oc
    .route({ method: "DELETE", path: "/api/v1/invitations/{invitationId}", successStatus: 204 })
    .input(zInvitationIdPathParam)
    .output(z.void()),
};
