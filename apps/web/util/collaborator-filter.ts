import { isGranteeRow } from "@repo/api/domains/sharing/sharing.schema";
import type { GranteeDto, ResourceCollaboratorDto } from "@repo/api/domains/sharing/sharing.schema";

/** Matches a normalized term against the displayed grantee name and email. */
function matchesGrantee(grantee: GranteeDto, normalizedTerm: string): boolean {
  if (!normalizedTerm) return true;
  const name = (grantee.displayName ?? "").toLowerCase();
  const email = (grantee.email ?? "").toLowerCase();
  return name.includes(normalizedTerm) || email.includes(normalizedTerm);
}

/**
 * The same match for any row of the collaborators list. A summary row is matched on
 * the organization it names rather than exempted from the filter: exempting it would
 * leave "Members of Greenhouse Lab" sitting under a search for someone else, and
 * would make the "no matching collaborators" empty state unreachable for every
 * resource an organization owns.
 */
export function matchesCollaborator(row: ResourceCollaboratorDto, normalizedTerm: string): boolean {
  if (!normalizedTerm) return true;
  return isGranteeRow(row)
    ? matchesGrantee(row.grantee, normalizedTerm)
    : row.organizationName.toLowerCase().includes(normalizedTerm);
}
