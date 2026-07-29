import { z } from "zod";

/**
 * Resource types that expose a sharing (collaborators) surface. A subset of the
 * `resource_grants.resource_type` enum: devices are intentionally excluded for now
 * — they get scoped listing only, no share or publish surface yet.
 */
export const zSharingResourceType = z.enum(["experiment", "macro", "protocol", "workbook"]);

/**
 * Who a share can be granted to: individual users and whole organizations. Team
 * grantees arrive with team management (the DB enum and can() already support
 * `team`, so no backend change is needed later).
 */
export const zGranteeType = z.enum(["user", "organization"]);

/**
 * Role conferred by a grant. owner/admin ⇒ full control; member/viewer ⇒ read, plus
 * contributing data on an experiment.
 */
export const zGrantRole = z.enum(["owner", "admin", "member", "viewer"]);

export const zCollaboratorsPathParams = z.object({
  resourceType: zSharingResourceType,
  id: z.string().uuid().describe("ID of the resource being shared"),
});

export const zCollaboratorGrantPathParams = zCollaboratorsPathParams.extend({
  grantId: z.string().uuid().describe("ID of the grant to modify"),
});

/** Display info for a grant's grantee (a user or an organization). */
export const zGrantee = z.object({
  type: zGranteeType,
  displayName: z.string().nullable(),
  email: z.string().nullable(),
  avatarUrl: z.string().nullable(),
});

/**
 * A direct grant on a resource, enriched with its grantee's display info and the
 * computed "Outside Collaborator" flag:
 * - user grantee → true when they are not a member of the resource's owning org;
 * - organization grantee → true when the grantee org is not the owning org.
 */
export const zResourceGrant = z.object({
  id: z.string().uuid(),
  resourceType: zSharingResourceType,
  resourceId: z.string().uuid(),
  granteeType: zGranteeType,
  granteeId: z.string().uuid(),
  // Response role is the closed grant-role set, not free text: a malformed/legacy
  // DB row fails output validation loudly here instead of leaking an unknown role
  // to clients, and generated client types stay exhaustively narrow for the UI.
  role: zGrantRole,
  createdAt: z.string(),
  createdBy: z.string().uuid().nullable(),
  isOutsideCollaborator: z.boolean(),
  grantee: zGrantee,
});

export const zResourceGrantList = z.array(zResourceGrant);

export const zCreateCollaboratorBody = z.object({
  granteeType: zGranteeType,
  granteeId: z.string().uuid(),
  role: zGrantRole.default("member"),
});

export const zUpdateCollaboratorBody = z.object({
  role: zGrantRole,
});

/**
 * Query for the grantee picker's organization search. Deliberately narrow: it
 * exists to populate the "share with an organization" side of the collaborators
 * picker, so it is read-scoped to organizations the caller is a member of and
 * excludes personal workspaces (sharing with someone's personal org is just
 * sharing with that user).
 */
export const zSearchGranteeOrganizationsQuery = z.object({
  query: z.string().optional().describe("Name substring to match"),
  limit: z.coerce
    .number()
    .int()
    .min(1)
    .max(50)
    .optional()
    .default(20)
    .describe("Maximum number of organizations to return"),
});

/** An organization the caller may pick as a grantee. */
export const zGranteeOrganization = z.object({
  id: z.string().uuid(),
  name: z.string(),
  slug: z.string().nullable(),
});

export const zGranteeOrganizationList = z.array(zGranteeOrganization);

export type SharingResourceType = z.infer<typeof zSharingResourceType>;
export type SharingGranteeType = z.infer<typeof zGranteeType>;
export type GrantRole = z.infer<typeof zGrantRole>;
export type ResourceGrantDto = z.infer<typeof zResourceGrant>;
export type GranteeDto = z.infer<typeof zGrantee>;
export type CreateCollaboratorBody = z.infer<typeof zCreateCollaboratorBody>;
export type UpdateCollaboratorBody = z.infer<typeof zUpdateCollaboratorBody>;
export type SearchGranteeOrganizationsQuery = z.infer<typeof zSearchGranteeOrganizationsQuery>;
export type GranteeOrganizationDto = z.infer<typeof zGranteeOrganization>;
