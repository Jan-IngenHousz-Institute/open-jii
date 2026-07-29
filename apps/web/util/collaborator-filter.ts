import type { GranteeDto } from "@repo/api/domains/sharing/sharing.schema";

/**
 * Does a grant's grantee match the collaborators filter term?
 *
 * Matches the display name and, for a user grantee, the email — the two things the
 * row shows. The term is expected already trimmed and lower-cased, so a caller
 * filtering several lists normalizes once.
 */
export function matchesGrantee(grantee: GranteeDto, normalizedTerm: string): boolean {
  if (!normalizedTerm) return true;
  const name = (grantee.displayName ?? "").toLowerCase();
  const email = (grantee.email ?? "").toLowerCase();
  return name.includes(normalizedTerm) || email.includes(normalizedTerm);
}
