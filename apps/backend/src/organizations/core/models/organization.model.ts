import type {
  GranteeTeam,
  OrganizationDeletionBlockers,
  MyOrganization,
  OrganizationDirectoryEntry,
  OrganizationMember,
  OrganizationMembershipStatus,
  OrganizationProfile,
  OrganizationResource,
  OrganizationResourceTotals,
  OrganizationTeam,
  OrganizationTeamGrant,
} from "@repo/api/domains/organization/organization.schema";

/**
 * The organization DTOs are the contract shapes verbatim — this domain is reads
 * over Better Auth's own models, so there is no separate persistence shape to map
 * from. Dates are the exception: repositories return `Date`, the controllers
 * serialize.
 */
export type OrganizationDirectoryEntryDto = OrganizationDirectoryEntry;
export type OrganizationProfileDto = Omit<OrganizationProfile, "createdAt"> & { createdAt: Date };
export type MyOrganizationDto = MyOrganization;
/**
 * Distributed over the union rather than mapped across it: `Omit` on a discriminated
 * union collapses it into one object with every type's meta optional, which would let
 * a protocol row carry a `status`.
 */
export type OrganizationResourceDto = OrganizationResource extends infer Row
  ? Row extends { updatedAt: string }
    ? Omit<Row, "updatedAt"> & { updatedAt: Date }
    : never
  : never;
export type OrganizationResourceTotalsDto = OrganizationResourceTotals;
export type OrganizationMemberDto = Omit<OrganizationMember, "joinedAt"> & { joinedAt: Date };
export type OrganizationTeamDto = Omit<OrganizationTeam, "createdAt"> & { createdAt: Date };
export type OrganizationTeamGrantDto = OrganizationTeamGrant;
export type GranteeTeamDto = GranteeTeam;
export type OrganizationDeletionBlockersDto = OrganizationDeletionBlockers;
export type MembershipStatus = OrganizationMembershipStatus;

/**
 * What global search merges on, plus the score it merges by. Picked rather than the whole
 * entry: the listing's counts are correlated subqueries the palette neither shows nor
 * should pay for on every keystroke.
 */
export type OrganizationSearchRow = Pick<
  OrganizationDirectoryEntryDto,
  "id" | "name" | "description" | "type"
> & { score: number };

/** Everything the read use-cases need to decide what a caller may see. */
export interface OrganizationAccessRow {
  id: string;
  slug: string | null;
  visibility: "private" | "public";
  /** The caller's stored role string, or `null` when they are not a member. */
  memberRole: string | null;
}
