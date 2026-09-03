import { z } from "zod";

/**
 * Every value of the `resource_grants.resource_type` enum. Devices and device
 * groups are shareable but never publishable, see `zPublishableResourceType`.
 */
export const zSharingResourceType = z.enum([
  "experiment",
  "macro",
  "protocol",
  "workbook",
  "device",
  "device_group",
]);

/**
 * Who a grant can name. A team is always a team of the resource's **owning**
 * organization — validated on write — which is what keeps a team grantee from ever
 * being an outside collaborator.
 */
export const zGranteeType = z.enum(["user", "organization", "team"]);

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

/** Display info for a grant's grantee (a user, an organization or a team). */
export const zGrantee = z.object({
  type: zGranteeType,
  displayName: z.string().nullable(),
  email: z.string().nullable(),
  avatarUrl: z.string().nullable(),
  /**
   * How many people a team grantee actually admits — the one thing a team row
   * carries that a name does not. `null` for every other grantee type.
   */
  memberCount: z.number().int().nullable(),
});

/**
 * A direct grant plus its grantee's display info. `isOutsideCollaborator` is computed:
 * a user not in the owning org, or a grantee org that is not the owning org. A team
 * is never outside — it belongs to the owning org by construction.
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

/**
 * The grantee's standing in the resource's **owning** organization — the second
 * source their access can come from, and what lets a row say both. Never `owner`:
 * owners are listed individually and carry any grant of theirs on that row.
 */
export const zGranteeOwningOrganization = z.object({
  id: z.string().uuid(),
  name: z.string(),
  role: z.enum(["admin", "member"]),
});

/**
 * Only grant rows have an id and a role, so only they have something to change or
 * revoke. Anyone holding a grant gets one of these whatever their org role, so
 * `owningOrganization` is how the row states their *effective* access rather than
 * the grant's tier: an admin's "Can view" grant confers nothing they lack.
 */
export const zResourceGrantRow = zResourceGrant.extend({
  kind: z.literal("grant"),
  /** `null` for a grantee outside the owning organization — see `isOutsideCollaborator`. */
  owningOrganization: zGranteeOwningOrganization.nullable(),
});

/** A direct grant whose holder's organization role already subsumes it. */
export const zInertGrant = z.object({
  id: z.string().uuid(),
  role: zGrantRole,
});

/**
 * Synthesized from the owning organization's living owners, not from a grant: they
 * hold every action through the org role, so there is no tier and nothing to revoke.
 * Listed one by one, unlike admins and members, because an owner is the party
 * answerable for what the organization owns — a name, not a head count.
 *
 * `inertGrant` is a direct grant the same person holds anyway; highest-wins means it
 * never contributed, so it rides here to be labelled and cleared rather than shown as
 * a second row implying a tier that does nothing.
 */
export const zResourceOwnerRow = z.object({
  kind: z.literal("owner"),
  granteeType: z.literal("user"),
  granteeId: z.string().uuid(),
  /** The organization the role comes from, so the row can name its own source. */
  organizationName: z.string(),
  grantee: zGrantee,
  inertGrant: zInertGrant.nullable(),
});

/**
 * The owning organization's administrators whose access is purely their org role, as
 * one row: they all hold the same thing through the same source, so naming them one
 * by one says nothing a count does not.
 */
export const zResourceOrgAdminsRow = z.object({
  kind: z.literal("orgAdmins"),
  organizationId: z.string().uuid(),
  organizationName: z.string(),
  /**
   * Admins with no direct grant. Anyone holding one is broken out onto their own row
   * and left out of here, so nobody is counted in two places. Owners are excluded
   * throughout — a `member,owner` reads as owner and is listed individually.
   */
  adminCount: z.number().int(),
});

/**
 * Everyone else in the owning organization, as one row rather than one each: a
 * 200-member organization is a fact about the organization, not 200 collaborators.
 * Nothing to revoke, since membership is an organization matter.
 */
export const zResourceOrgMembersRow = z.object({
  kind: z.literal("orgMembers"),
  organizationId: z.string().uuid(),
  organizationName: z.string(),
  /** Members with no direct grant — same break-out rule as {@link zResourceOrgAdminsRow}. */
  memberCount: z.number().int(),
  // No tier field: `organizations.base_permission` is read nowhere in the access
  // path, so shipping it here would let a row state a permission nothing enforces.
  // What membership confers comes from the shared matrix, like every other tier.
});

export const zResourceCollaborator = z.discriminatedUnion("kind", [
  zResourceOwnerRow,
  zResourceOrgAdminsRow,
  zResourceOrgMembersRow,
  zResourceGrantRow,
]);

/** Everyone the surface lists: org-derived access first, then the direct grants. */
export const zResourceGrantList = z.array(zResourceCollaborator);

/**
 * Rows that name one grantee, as opposed to summarizing a group of them — the ones
 * carrying a `granteeId`. Narrowing on the negative instead (`kind !== "orgMembers"`)
 * silently admits every summary variant added later.
 */
export function isGranteeRow<T extends { kind: ResourceCollaboratorDto["kind"] }>(
  row: T,
  // Generic over the row type, so the backend's own variant — same union, but
  // `createdAt` is still a `Date` — narrows through this too.
): row is Extract<T, { kind: "owner" | "grant" }> {
  return row.kind === "owner" || row.kind === "grant";
}

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

/** Same discoverability rule as the global user search; scoped to one resource. */
export const zSearchGranteeUsersQuery = zCollaboratorsPathParams.extend({
  query: z.string().optional().describe("Name or email substring to match"),
  limit: z.coerce
    .number()
    .int()
    .min(1)
    .max(50)
    .optional()
    .default(20)
    .describe("Maximum number of users to return"),
});

/** An organization role as the picker reads it, strongest token first. */
export const zOrganizationMemberRole = z.enum(["owner", "admin", "member"]);

/**
 * A user the picker may offer, carrying the access they already hold here. Both
 * sources are needed to say whether a tier would raise anything: access resolution
 * is highest-wins, so a grant below what someone already has does nothing.
 */
export const zGranteeUser = z.object({
  userId: z.string().uuid(),
  firstName: z.string(),
  lastName: z.string(),
  email: z.string().nullable(),
  avatarUrl: z.string().nullable(),
  /** Their role in the resource's **owning** organization; `null` if not a member. */
  organizationRole: zOrganizationMemberRole.nullable(),
  /** A direct grant they already hold on this resource. */
  existingGrantRole: zGrantRole.nullable(),
});

export const zGranteeUserList = z.array(zGranteeUser);

export type SharingResourceType = z.infer<typeof zSharingResourceType>;
export type SharingGranteeType = z.infer<typeof zGranteeType>;
export type GrantRole = z.infer<typeof zGrantRole>;
export type ShareableRole = z.infer<typeof zShareableRole>;
export type ResourceGrantDto = z.infer<typeof zResourceGrantRow>;
export type ResourceOwnerDto = z.infer<typeof zResourceOwnerRow>;
export type ResourceOrgAdminsDto = z.infer<typeof zResourceOrgAdminsRow>;
export type ResourceOrgMembersDto = z.infer<typeof zResourceOrgMembersRow>;
export type ResourceCollaboratorDto = z.infer<typeof zResourceCollaborator>;
export type GranteeDto = z.infer<typeof zGrantee>;
export type CreateCollaboratorBody = z.infer<typeof zCreateCollaboratorBody>;
export type UpdateCollaboratorBody = z.infer<typeof zUpdateCollaboratorBody>;
export type SearchGranteeOrganizationsQuery = z.infer<typeof zSearchGranteeOrganizationsQuery>;
export type GranteeOrganizationDto = z.infer<typeof zGranteeOrganization>;
export type SearchGranteeUsersQuery = z.infer<typeof zSearchGranteeUsersQuery>;
export type OrganizationMemberRole = z.infer<typeof zOrganizationMemberRole>;
export type GranteeUserDto = z.infer<typeof zGranteeUser>;
