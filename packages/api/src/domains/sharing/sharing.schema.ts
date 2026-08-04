import { z } from "zod";

/**
 * Every value of the `resource_grants.resource_type` enum. Devices are shareable but
 * never publishable — see `zPublishableResourceType`, this set minus devices.
 */
export const zSharingResourceType = z.enum([
  "experiment",
  "macro",
  "protocol",
  "workbook",
  "device",
]);

/** Team grantees arrive with team management; the DB enum and `can()` already take them. */
export const zGranteeType = z.enum(["user", "organization"]);

/**
 * As stored and returned (mirrors `GRANT_ROLES` in `@repo/database`). `owner` is
 * read-only vocabulary: nothing writes it, but existing rows must still deserialize.
 */
export const zGrantRole = z.enum(["owner", "admin", "viewer"]);

/**
 * What a caller may grant: "Can edit" and "Can view", most access first. Narrower than
 * {@link zGrantRole} on purpose — readers accept a legacy `owner`, writers must not mint one.
 */
export const zShareableRole = z.enum(["admin", "viewer"]);

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
 * A direct grant plus its grantee's display info. `isOutsideCollaborator` is computed:
 * a user not in the owning org, or a grantee org that is not the owning org.
 */
export const zResourceGrant = z.object({
  id: z.string().uuid(),
  resourceType: zSharingResourceType,
  resourceId: z.string().uuid(),
  granteeType: zGranteeType,
  granteeId: z.string().uuid(),
  // Closed set, not free text: a malformed row fails output validation here rather
  // than leaking an unknown role to clients.
  role: zGrantRole,
  createdAt: z.string(),
  createdBy: z.string().uuid().nullable(),
  isOutsideCollaborator: z.boolean(),
  grantee: zGrantee,
});

/** Only grant rows have an id and a role, so only they have something to change or revoke. */
export const zResourceGrantRow = zResourceGrant.extend({ kind: z.literal("grant") });

/**
 * Synthesized from the owning organization's living owners, not from a grant. Owners
 * hold every action through the org role, so there is no tier, nothing to revoke, and
 * no leaving (that is an organization matter) — hence no id, role or outside flag.
 */
export const zResourceOwnerRow = z.object({
  kind: z.literal("owner"),
  granteeType: z.literal("user"),
  granteeId: z.string().uuid(),
  grantee: zGrantee,
});

export const zResourceCollaborator = z.discriminatedUnion("kind", [
  zResourceOwnerRow,
  zResourceGrantRow,
]);

/** Everyone the collaborators surface lists: the owners, then the grantees. */
export const zResourceGrantList = z.array(zResourceCollaborator);

export const zCreateCollaboratorBody = z.object({
  granteeType: zGranteeType,
  granteeId: z.string().uuid(),
  role: zShareableRole.default("viewer"),
});

export const zUpdateCollaboratorBody = z.object({
  role: zShareableRole,
});

/**
 * Scoped to organizations the caller belongs to, excluding personal workspaces —
 * sharing with someone's personal org is just sharing with that user.
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
export type ShareableRole = z.infer<typeof zShareableRole>;
export type ResourceGrantDto = z.infer<typeof zResourceGrantRow>;
export type ResourceOwnerDto = z.infer<typeof zResourceOwnerRow>;
export type ResourceCollaboratorDto = z.infer<typeof zResourceCollaborator>;
export type GranteeDto = z.infer<typeof zGrantee>;
export type CreateCollaboratorBody = z.infer<typeof zCreateCollaboratorBody>;
export type UpdateCollaboratorBody = z.infer<typeof zUpdateCollaboratorBody>;
export type SearchGranteeOrganizationsQuery = z.infer<typeof zSearchGranteeOrganizationsQuery>;
export type GranteeOrganizationDto = z.infer<typeof zGranteeOrganization>;
