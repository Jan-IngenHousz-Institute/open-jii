import { z } from "zod";

import { zSharingResourceType } from "../sharing/sharing.schema";

/** Mirrors the `organization_type` enum; organizations may leave it unset. */
export const zOrganizationType = z.enum([
  "research_institute",
  "non_profit",
  "private_company",
  "government_agency",
  "university",
]);

/** Directory listing state. Private organizations are invisible to non-members. */
export const zOrganizationVisibility = z.enum(["private", "public"]);

/** Canonical organization roles (Better Auth's `member` model). */
export const zOrganizationRole = z.enum(["owner", "admin", "member"]);

/**
 * What the caller's relationship to an organization is, which is all the directory
 * needs to pick between "Join", "Requested" and "Open". Deliberately not a role:
 * the directory shows public organizations to people who are not in them.
 */
export const zOrganizationMembershipStatus = z.enum(["none", "pending_request", "member"]);

export const zOrganizationIdPathParam = z.object({
  id: z.string().uuid().describe("ID of the organization"),
});

export const zOrganizationDirectoryQuery = z.object({
  search: z.string().trim().max(200).optional().describe("Name or description substring"),
  limit: z.coerce.number().int().min(1).max(50).optional().default(20),
  offset: z.coerce.number().int().min(0).optional().default(0),
});

/** A directory row: public, non-personal organizations only. */
export const zOrganizationDirectoryEntry = z.object({
  id: z.string().uuid(),
  name: z.string(),
  slug: z.string().nullable(),
  logo: z.string().nullable(),
  type: zOrganizationType.nullable(),
  description: z.string().nullable(),
  location: z.string().nullable(),
  memberCount: z.number().int(),
  /** Everything the organization owns, summed across all five owned types. */
  resourceCount: z.number().int(),
  membershipStatus: zOrganizationMembershipStatus,
});

export const zOrganizationDirectory = z.object({
  organizations: z.array(zOrganizationDirectoryEntry),
  /** Total matching rows, so the client can page without a second endpoint. */
  total: z.number().int(),
});

/** The organization profile page. Private organizations 404 for non-members. */
export const zOrganizationProfile = z.object({
  id: z.string().uuid(),
  name: z.string(),
  slug: z.string().nullable(),
  logo: z.string().nullable(),
  type: zOrganizationType.nullable(),
  description: z.string().nullable(),
  website: z.string().nullable(),
  location: z.string().nullable(),
  visibility: zOrganizationVisibility,
  memberCount: z.number().int(),
  /** The caller's own role, or `null` when they are not a member. */
  role: zOrganizationRole.nullable(),
  membershipStatus: zOrganizationMembershipStatus,
});

/** An organization the caller belongs to. Personal workspaces are included, flagged. */
export const zMyOrganization = z.object({
  id: z.string().uuid(),
  name: z.string(),
  slug: z.string().nullable(),
  description: z.string().nullable(),
  visibility: zOrganizationVisibility,
  role: zOrganizationRole,
  isPersonal: z.boolean(),
  memberCount: z.number().int(),
  /** Everything the organization owns, summed across all five owned types. */
  resourceCount: z.number().int(),
});

export const zMyOrganizationList = z.array(zMyOrganization);

/** Profile fields every people-shaped row in this domain carries. */
const zOrganizationPerson = z.object({
  userId: z.string().uuid(),
  firstName: z.string(),
  lastName: z.string(),
  // Stored value returned as-is; format-validating on output can 500 the list.
  email: z.string().nullable(),
  avatarUrl: z.string().nullable(),
});

export const zOrganizationMember = zOrganizationPerson.extend({
  /** Stored verbatim: Better Auth may hold a comma-joined multi-role string. */
  role: z.string(),
  joinedAt: z.string().datetime(),
});

/**
 * Someone with a direct grant on one of the organization's resources who is not a
 * member of it — GitHub's "outside collaborator". Derived from `resource_grants`,
 * so there is nothing to manage here; the access lives on the resource.
 */
export const zOutsideCollaborator = zOrganizationPerson.extend({
  resourceCount: z.number().int().describe("How many of the org's resources they hold a grant on"),
});

export const zOrganizationMembers = z.object({
  members: z.array(zOrganizationMember),
  outsideCollaborators: z.array(zOutsideCollaborator),
});

export const zOrganizationResourceType = z.enum(["experiment", "macro", "protocol", "workbook"]);

/**
 * One row of the organization's resources showcase. Deliberately a thin common
 * shape rather than four full DTOs: the showcase links out to each resource's own
 * page, which is where the type-specific detail lives.
 */
export const zOrganizationResource = z.object({
  type: zOrganizationResourceType,
  id: z.string().uuid(),
  name: z.string(),
  description: z.string().nullable(),
  visibility: zOrganizationVisibility,
  updatedAt: z.string().datetime(),
});

export const zOrganizationResources = z.object({
  resources: z.array(zOrganizationResource),
});

/**
 * What still stands between an organization and deletion, one row per resource type
 * that holds at least one of its resources.
 *
 * Deliberately not the resources showcase: that is access-scoped and covers four
 * types, while the delete guard counts all five — devices included, which have no
 * sharing surface to appear in a showcase at all. An organization owning nothing but
 * a device would otherwise look deletable right up to the confirmation.
 *
 * Counts, not rows: the remedy is per resource type ("transfer or delete your
 * devices"), and a device has no page to link to anyway.
 */
export const zOrganizationDeletionBlocker = z.object({
  resourceType: zSharingResourceType,
  count: z.number().int().positive(),
});

export const zOrganizationDeletionBlockers = z.object({
  /** Only the types that actually hold something; an empty array means deletable. */
  blockers: z.array(zOrganizationDeletionBlocker),
  total: z.number().int(),
});

export const zOrganizationTeamMember = zOrganizationPerson;

export const zOrganizationTeam = z.object({
  id: z.string().uuid(),
  name: z.string(),
  organizationId: z.string().uuid(),
  createdAt: z.string().datetime(),
  members: z.array(zOrganizationTeamMember),
});

export const zOrganizationTeamList = z.array(zOrganizationTeam);

/** A team the caller may pick as a grantee: teams of the resource's owning org. */
export const zGranteeTeam = z.object({
  id: z.string().uuid(),
  name: z.string(),
  organizationId: z.string().uuid(),
  memberCount: z.number().int(),
});

export const zGranteeTeamList = z.array(zGranteeTeam);

/**
 * Path params for the share-gated team picker. `resourceType` excludes devices —
 * they have no sharing surface — and mirrors the sharing contract's path shape.
 */
export const zGranteeTeamsPathParams = z.object({
  resourceType: z.enum(["experiment", "macro", "protocol", "workbook", "device"]),
  id: z.string().uuid().describe("ID of the resource being shared"),
});

export type OrganizationType = z.infer<typeof zOrganizationType>;
export type OrganizationVisibility = z.infer<typeof zOrganizationVisibility>;
export type OrganizationRole = z.infer<typeof zOrganizationRole>;
export type OrganizationMembershipStatus = z.infer<typeof zOrganizationMembershipStatus>;
export type OrganizationDirectoryQuery = z.infer<typeof zOrganizationDirectoryQuery>;
export type OrganizationDirectoryEntry = z.infer<typeof zOrganizationDirectoryEntry>;
export type OrganizationDirectory = z.infer<typeof zOrganizationDirectory>;
export type OrganizationProfile = z.infer<typeof zOrganizationProfile>;
export type MyOrganization = z.infer<typeof zMyOrganization>;
export type MyOrganizationList = z.infer<typeof zMyOrganizationList>;
export type OrganizationMember = z.infer<typeof zOrganizationMember>;
export type OutsideCollaborator = z.infer<typeof zOutsideCollaborator>;
export type OrganizationMembers = z.infer<typeof zOrganizationMembers>;
export type OrganizationResourceType = z.infer<typeof zOrganizationResourceType>;
export type OrganizationResource = z.infer<typeof zOrganizationResource>;
export type OrganizationResources = z.infer<typeof zOrganizationResources>;
export type OrganizationDeletionBlocker = z.infer<typeof zOrganizationDeletionBlocker>;
export type OrganizationDeletionBlockers = z.infer<typeof zOrganizationDeletionBlockers>;
export type OrganizationTeam = z.infer<typeof zOrganizationTeam>;
export type OrganizationTeamList = z.infer<typeof zOrganizationTeamList>;
export type GranteeTeam = z.infer<typeof zGranteeTeam>;
export type GranteeTeamList = z.infer<typeof zGranteeTeamList>;
