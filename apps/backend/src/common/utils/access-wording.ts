/** The access tier someone was given on an experiment. */
export interface AccessTerms {
  tier: "admin" | "viewer";
}

/**
 * Human-readable description of what someone was granted, for the invitation
 * emails. Tracks the collaborators UI's "Can edit" / "Can view" labels so the email
 * and the screen agree; "Can view" reads as contributing because that tier also
 * carries the right to add measurements and annotations.
 */
export function describeAccess({ tier }: AccessTerms): string {
  return tier === "admin"
    ? "a collaborator who can edit"
    : "a contributor who can view and add data";
}
