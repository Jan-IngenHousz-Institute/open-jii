/** The access tier someone was given on an experiment. */
export interface AccessTerms {
  tier: "admin" | "viewer";
}

/**
 * Human-readable description of what someone was granted, for the transactional
 * "added to an experiment" / invitation emails.
 *
 * The wording matches the labels the collaborators UI uses — "Can edit" / "Can
 * view" — so the email and the screen agree. "Can view" also carries the right to
 * add measurements and annotations, which is why it reads as contributing.
 */
export function describeAccess({ tier }: AccessTerms): string {
  return tier === "admin"
    ? "a collaborator who can edit"
    : "a contributor who can view and add data";
}
