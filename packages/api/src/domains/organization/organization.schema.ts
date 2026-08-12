import { z } from "zod";

import { zExperimentStatus } from "../experiment/experiment.schema";
import { zMacroLanguage } from "../macro/macro.schema";
import { zSensorFamily } from "../protocol/protocol.schema";
import { zGrantRole, zSharingResourceType } from "../sharing/sharing.schema";

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
});

/**
 * A directory row: non-personal organizations that are public **or** that the caller
 * belongs to. "All organizations" means all the ones they can see, which is the same
 * promise the experiments listing makes — a private organization you are a member of
 * is not a secret from you.
 */
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
  /**
   * Carried, not assumed. The directory used to be public-only, so a row's visibility
   * was knowable without asking; now that a member's private organizations appear here
   * too, a row that did not say would be rendered as public and lose its badge.
   */
  visibility: zOrganizationVisibility,
  membershipStatus: zOrganizationMembershipStatus,
});

export const zOrganizationDirectory = z.object({
  organizations: z.array(zOrganizationDirectoryEntry),
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
  /**
   * Everything the organization owns, summed across all five owned types — the same
   * total the directory row reports, so the profile and the listing cannot disagree
   * about how big the same organization is.
   */
  resourceCount: z.number().int(),
  /** When the organization was created, for the profile's "on openJII since" row. */
  createdAt: z.string().datetime(),
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

export const zOrganizationMembers = z.object({
  members: z.array(zOrganizationMember),
});

/**
 * Adding somebody who already has an account. An invitation exists to reach an
 * address with no account behind it, so a registered user needs none: there is a
 * user id to attach the membership to, and the person doing the adding already
 * holds the authority to do it.
 *
 * `role` is bounded by the caller's own: only an owner may hand out `owner`.
 */
export const zAddOrganizationMemberBody = z.object({
  userId: z.string().uuid().describe("ID of the registered user to admit"),
  role: zOrganizationRole.default("member"),
});

export const zOrganizationResourceType = z.enum(["experiment", "macro", "protocol", "workbook"]);

/** What every showcase row carries, whatever its type. */
const zOrganizationResourceBase = z.object({
  id: z.string().uuid(),
  name: z.string(),
  description: z.string().nullable(),
  visibility: zOrganizationVisibility,
  updatedAt: z.string().datetime(),
});

/**
 * One row of the organization's resources showcase. Still thin — the showcase links
 * out to each resource's own page, which is where the full detail lives — but
 * discriminated on `type` rather than flattened, because the one extra fact worth
 * showing per row is a different fact for each type: an experiment's lifecycle
 * status, a protocol's sensor family, a macro's language. A single stringly `meta`
 * would have the four pretend to share a vocabulary they do not.
 *
 * A workbook adds nothing: there is no second column on its table worth a row.
 * Every field here is on the resource's own table, so nothing is cross-fetched.
 */
export const zOrganizationResource = z.discriminatedUnion("type", [
  zOrganizationResourceBase.extend({
    type: z.literal("experiment"),
    status: zExperimentStatus,
  }),
  zOrganizationResourceBase.extend({
    type: z.literal("protocol"),
    family: zSensorFamily,
  }),
  zOrganizationResourceBase.extend({
    type: z.literal("macro"),
    language: zMacroLanguage,
  }),
  zOrganizationResourceBase.extend({ type: z.literal("workbook") }),
]);

/**
 * How many of each type the caller may read, alongside the capped rows. Scoped to
 * the caller exactly as the rows are, so a group header can never promise more than
 * the "view all" behind it would show.
 *
 * A total `Record` over the four showcase types: a fifth type added to the enum
 * fails to compile until it is counted too.
 */
export const zOrganizationResourceTotals = z.object({
  experiment: z.number().int(),
  protocol: z.number().int(),
  macro: z.number().int(),
  workbook: z.number().int(),
}) satisfies z.ZodType<Record<z.infer<typeof zOrganizationResourceType>, number>>;

export const zOrganizationResources = z.object({
  resources: z.array(zOrganizationResource),
  totals: zOrganizationResourceTotals,
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

/**
 * One resource a team can reach because the team itself was named on a grant — the
 * team → resources direction, which `listGranteeTeams` answers in reverse.
 *
 * `resourceType` is the grant enum rather than the showcase's four: a team can hold
 * a grant on a device too, and a footer counting "N resources" that quietly omitted
 * one would understate what deleting the team withdraws.
 */
export const zOrganizationTeamGrant = z.object({
  id: z.string().uuid().describe("ID of the grant row"),
  teamId: z.string().uuid(),
  resourceType: zSharingResourceType,
  resourceId: z.string().uuid(),
  /**
   * Always something to render. A device is the one type whose `name` is nullable, so
   * an unnamed one falls back server-side to its thing name — never to a placeholder,
   * because the read inner-joins the resource: a blank name is a naming gap, and a
   * resource that has gone is not in this list at all.
   */
  resourceName: z.string(),
  role: zGrantRole,
});

export const zOrganizationTeamGrantList = z.array(zOrganizationTeamGrant);

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
export type OrganizationMembers = z.infer<typeof zOrganizationMembers>;
export type AddOrganizationMemberBody = z.infer<typeof zAddOrganizationMemberBody>;
export type OrganizationResourceType = z.infer<typeof zOrganizationResourceType>;
export type OrganizationResource = z.infer<typeof zOrganizationResource>;
export type OrganizationResourceTotals = z.infer<typeof zOrganizationResourceTotals>;
export type OrganizationResources = z.infer<typeof zOrganizationResources>;
export type OrganizationDeletionBlocker = z.infer<typeof zOrganizationDeletionBlocker>;
export type OrganizationDeletionBlockers = z.infer<typeof zOrganizationDeletionBlockers>;
export type OrganizationTeamMember = z.infer<typeof zOrganizationTeamMember>;
export type OrganizationTeam = z.infer<typeof zOrganizationTeam>;
export type OrganizationTeamList = z.infer<typeof zOrganizationTeamList>;
export type OrganizationTeamGrant = z.infer<typeof zOrganizationTeamGrant>;
export type OrganizationTeamGrantList = z.infer<typeof zOrganizationTeamGrantList>;
export type GranteeTeam = z.infer<typeof zGranteeTeam>;
export type GranteeTeamList = z.infer<typeof zGranteeTeamList>;
