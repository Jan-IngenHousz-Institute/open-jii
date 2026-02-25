import { z } from "zod";

import { zExperimentMemberRole } from "./experiment.schema";

export const zUser = z.object({
  id: z.string().uuid(),
  name: z.string().nullable(),
  email: z.string().email().nullable(),
  emailVerified: z.boolean(),
  image: z.string().nullable(),
  createdAt: z.string().datetime(),
  registered: z.boolean(),
});

export const zUserList = z.array(zUser);

export const zSearchUsersQuery = z.object({
  query: z.string().optional().describe("Search query for name or email"),
  limit: z.coerce
    .number()
    .int()
    .min(1)
    .max(100)
    .optional()
    .default(50)
    .describe("Maximum number of users to return"),
  offset: z.coerce
    .number()
    .int()
    .min(0)
    .optional()
    .default(0)
    .describe("Number of users to skip for pagination"),
});

export const zCreateUserResponse = z.object({
  id: z.string().uuid(),
});

export const zCreateUserProfileBody = z.object({
  firstName: z.string().min(2).describe("First name"),
  lastName: z.string().min(2).describe("Last name"),
  bio: z.string().optional().describe("Bio"),
  organization: z.string().trim().optional().describe("Organization"),
  activated: z.boolean().optional().describe("Whether the profile is active or deactivated"),
});

export const zCreateUserProfileResponse = z.object({});

export const zUserProfile = z.object({
  userId: z.string().uuid(),
  firstName: z.string(),
  lastName: z.string(),
  bio: z.string().nullable(),
  organization: z.string().optional(),
  activated: z.boolean().nullable(),
  email: z.string().email().nullable(),
});

export const zUserProfileList = z.array(zUserProfile);

// Path parameters
export const zUserIdPathParam = z.object({
  id: z.string().uuid().describe("ID of the user"),
});

// Webhook Schemas
export const zWebhookAuthHeader = z.object({
  "x-api-key-id": z.string(),
  "x-databricks-signature": z.string(),
  "x-databricks-timestamp": z.string(),
});

export const zUserMetadataWebhookPayload = z.object({
  userIds: z.array(z.string().uuid()).min(1).max(100),
});

export const zUserMetadata = z.object({
  userId: z.string().uuid(),
  firstName: z.string(),
  lastName: z.string(),
  avatarUrl: z.string().nullable(),
});

export const zUserMetadataWebhookResponse = z.object({
  users: z.array(zUserMetadata),
  success: z.boolean(),
});

export const zWebhookSuccessResponse = z.object({
  success: z.boolean(),
  message: z.string(),
});

export const zWebhookErrorResponse = z.object({
  error: z.string(),
  message: z.string(),
  statusCode: z.number(),
});

// Infer types from Zod schemas
export type User = z.infer<typeof zUser>;
export type UserList = z.infer<typeof zUserList>;
export type UserProfileList = z.infer<typeof zUserProfileList>;
export type SearchUsersQuery = z.infer<typeof zSearchUsersQuery>;
export type UserIdPathParam = z.infer<typeof zUserIdPathParam>;
export type UserProfile = z.infer<typeof zUserProfile>;
export type CreateUserProfileBody = z.infer<typeof zCreateUserProfileBody>;
export type CreateUserProfileResponse = z.infer<typeof zCreateUserProfileResponse>;
export type WebhookAuthHeader = z.infer<typeof zWebhookAuthHeader>;
export type UserMetadataWebhookPayload = z.infer<typeof zUserMetadataWebhookPayload>;
export type UserMetadata = z.infer<typeof zUserMetadata>;
export type UserMetadataWebhookResponse = z.infer<typeof zUserMetadataWebhookResponse>;
export type WebhookSuccessResponse = z.infer<typeof zWebhookSuccessResponse>;
export type WebhookErrorResponse = z.infer<typeof zWebhookErrorResponse>;

// --- Invitation Schemas ---
export const zInvitationStatus = z.enum(["pending", "accepted", "revoked"]);
export const zInvitationResourceType = z.enum(["platform", "experiment"]);

export const zInvitation = z.object({
  id: z.string().uuid(),
  resourceType: zInvitationResourceType,
  resourceId: z.string().uuid().nullable(),
  email: z.string().email(),
  role: z.string(),
  status: zInvitationStatus,
  invitedBy: z.string().uuid(),
  invitedByName: z.string().optional(),
  resourceName: z.string().optional(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});

export const zInvitationList = z.array(zInvitation);

export const zCreateInvitationBody = z.object({
  resourceType: zInvitationResourceType,
  resourceId: z.string().uuid(),
  email: z.string().email("Must be a valid email address"),
  role: zExperimentMemberRole.optional().default("member"),
});

export const zUpdateInvitationRoleBody = z.object({
  role: zExperimentMemberRole.describe("New role to assign to the invitation"),
});

export const zInvitationIdPathParam = z.object({
  invitationId: z.string().uuid().describe("ID of the invitation"),
});

export const zListInvitationsQuery = z.object({
  resourceType: zInvitationResourceType,
  resourceId: z.string().uuid(),
});

// Invitation types
export type InvitationStatus = z.infer<typeof zInvitationStatus>;
export type InvitationResourceType = z.infer<typeof zInvitationResourceType>;
export type Invitation = z.infer<typeof zInvitation>;
export type CreateInvitationBody = z.infer<typeof zCreateInvitationBody>;
export type UpdateInvitationRoleBody = z.infer<typeof zUpdateInvitationRoleBody>;
export type InvitationIdPathParam = z.infer<typeof zInvitationIdPathParam>;
export type ListInvitationsQuery = z.infer<typeof zListInvitationsQuery>;
