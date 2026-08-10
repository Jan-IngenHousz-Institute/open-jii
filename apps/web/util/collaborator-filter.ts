import type { GranteeDto } from "@repo/api/domains/sharing/sharing.schema";

/** Matches a normalized term against the displayed grantee name and email. */
export function matchesGrantee(grantee: GranteeDto, normalizedTerm: string): boolean {
  if (!normalizedTerm) return true;
  const name = (grantee.displayName ?? "").toLowerCase();
  const email = (grantee.email ?? "").toLowerCase();
  return name.includes(normalizedTerm) || email.includes(normalizedTerm);
}
