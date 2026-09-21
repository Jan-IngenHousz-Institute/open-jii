import type {
  OrganizationDirectoryEntry,
  OrganizationMembershipStatus,
  OrganizationVisibility,
} from "@repo/api/domains/organization/organization.schema";

export type OrganizationOnboardingState =
  | { kind: "member" }
  | { kind: "pending"; organization: OrganizationDirectoryEntry }
  | { kind: "none" };

/**
 * Membership wins over a pending request: someone already in an organization is
 * onboarded, whatever else they have asked for. Otherwise the first pending row
 * in server order (own organizations first, then by name or relevance).
 */
export function deriveOnboardingState(
  entries: readonly OrganizationDirectoryEntry[],
): OrganizationOnboardingState {
  let pending: OrganizationDirectoryEntry | undefined;

  for (const entry of entries) {
    if (entry.membershipStatus === "member") return { kind: "member" };
    if (!pending && entry.membershipStatus === "pending_request") pending = entry;
  }

  return pending ? { kind: "pending", organization: pending } : { kind: "none" };
}

/**
 * Whether the caller may ask to join. A private organization they can see at all
 * is one they belong to, so the visibility check never hides a real opportunity.
 */
export function isJoinable(entry: {
  membershipStatus: OrganizationMembershipStatus;
  visibility: OrganizationVisibility;
}): boolean {
  return entry.membershipStatus === "none" && entry.visibility === "public";
}
