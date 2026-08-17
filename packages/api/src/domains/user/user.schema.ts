import { z } from "zod";

import { zExperimentStatus } from "../experiment/experiment.schema";
import { zShareableRole, zSharingResourceType } from "../sharing/sharing.schema";

export const zUser = z.object({
  id: z.string().uuid(),
  name: z.string().nullable(),
  // Stored value returned as-is; format-validating on output can 500 the endpoint.
  email: z.string().nullable(),
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
  activated: z.boolean().optional().describe("Whether the profile is active or deactivated"),
  avatarUrl: z.string().nullable().optional().describe("Avatar URL seeded from OAuth provider"),
});

export const zCreateUserProfileResponse = z.object({});

export const zUserProfile = z.object({
  userId: z.string().uuid(),
  firstName: z.string(),
  lastName: z.string(),
  bio: z.string().nullable(),
  activated: z.boolean().nullable(),
  // Stored value returned as-is; format-validating on output can 500 user search.
  email: z.string().nullable(),
  avatarUrl: z.string().nullable().optional(),
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
  // Accept any string so one malformed id can't 400 the whole batch; the
  // backend filters to valid uuids and omits the rest.
  userIds: z.array(z.string()).min(1).max(500),
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

// A resource blocks account deletion while the user is the last person answerable for it —
// `blockingResourcesQuery` defines what that means. Carries the resource's other collaborators
// so the dialog can suggest who to hand admin to.
export const zDeletionBlocker = z.object({
  resourceType: zSharingResourceType,
  id: z.string().uuid(),
  name: z.string(),
  // Only experiments have a lifecycle status; the delete dialog badges it when present.
  status: zExperimentStatus.nullable(),
  candidates: z.array(zUserMetadata),
});

// A shared organization the user solely owns blocks too, whether or not it owns anything;
// never a personal workspace. A sibling of `resources` rather than a pseudo resource type,
// because it is cleared by promoting another owner or deleting it, never by the hand-off.
export const zDeletionBlockerOrganization = z.object({
  id: z.string().uuid(),
  name: z.string(),
  slug: z.string(),
});

export const zDeletionBlockersResponse = z.object({
  resources: z.array(zDeletionBlocker),
  organizations: z.array(zDeletionBlockerOrganization),
});

export type DeletionBlocker = z.infer<typeof zDeletionBlocker>;
export type DeletionBlockerOrganization = z.infer<typeof zDeletionBlockerOrganization>;
export type DeletionBlockersResponse = z.infer<typeof zDeletionBlockersResponse>;

export const zInvitationStatus = z.enum(["pending", "accepted", "revoked"]);
export const zInvitationResourceType = z.enum(["platform", "experiment"]);

/**
 * The access tier an invitation confers on acceptance. Accepting one writes a grant,
 * so this is the grantable role set under the name this domain uses for it — aliased
 * rather than restated, since a divergence would let an invitation promise a tier the
 * sharing surface cannot grant.
 */
export const zInvitationTier = zShareableRole;

export const zInvitation = z.object({
  id: z.string().uuid(),
  resourceType: zInvitationResourceType,
  resourceId: z.string().uuid().nullable(),
  email: z.string().email(),
  /** Access tier granted on acceptance. */
  tier: zInvitationTier,
  status: zInvitationStatus,
  invitedBy: z.string().uuid(),
  invitedByName: z.string().optional(),
  resourceName: z.string().optional(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});

export const zInvitationList = z.array(zInvitation);

/**
 * An invitation carries exactly one choice: the access tier the invitee gets on
 * acceptance. It defaults to the lower of the two, so an invite always confers
 * something without having to grant full control.
 */
export const zCreateInvitationBody = z.object({
  resourceType: zInvitationResourceType,
  resourceId: z.string().uuid(),
  email: z.string().email("Must be a valid email address"),
  tier: zInvitationTier.default("viewer").describe("Access tier to grant on acceptance"),
});

export const zInvitationIdPathParam = z.object({
  invitationId: z.string().uuid().describe("ID of the invitation"),
});

export const zListInvitationsQuery = z.object({
  resourceType: zInvitationResourceType,
  resourceId: z.string().uuid(),
});

export const zWhatsNewSeenResponse = z.object({
  lastSeenAt: z
    .string()
    .datetime()
    .nullable()
    .describe("ISO timestamp the user last opened the What's new panel; null = never seen"),
});

export const zMarkWhatsNewSeenBody = z.object({});

// Invitation types
export type InvitationStatus = z.infer<typeof zInvitationStatus>;
export type InvitationResourceType = z.infer<typeof zInvitationResourceType>;
export type InvitationTier = z.infer<typeof zInvitationTier>;
export type Invitation = z.infer<typeof zInvitation>;
export type CreateInvitationBody = z.infer<typeof zCreateInvitationBody>;
export type InvitationIdPathParam = z.infer<typeof zInvitationIdPathParam>;
export type ListInvitationsQuery = z.infer<typeof zListInvitationsQuery>;
export type WhatsNewSeenResponse = z.infer<typeof zWhatsNewSeenResponse>;
export type MarkWhatsNewSeenBody = z.infer<typeof zMarkWhatsNewSeenBody>;
