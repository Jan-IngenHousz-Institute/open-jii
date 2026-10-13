import type { SharingResourceType } from "@repo/api/domains/sharing/sharing.schema";

/** The access tier someone was given on a resource. */
export interface AccessTerms {
  tier: "admin" | "viewer";
  resourceType: SharingResourceType;
}

/**
 * Human-readable description of what someone was granted, for the access emails.
 * Tracks the collaborators UI's "Can edit" / "Can view" labels so the email and the
 * screen agree. On an experiment "Can view" reads as contributing because that tier
 * also carries the right to add measurements and annotations; on every other
 * resource it is read-only.
 */
export function describeAccess({ tier, resourceType }: AccessTerms): string {
  if (tier === "admin") return "a collaborator who can edit";

  return resourceType === "experiment"
    ? "a contributor who can view and add data"
    : "a collaborator who can view";
}
