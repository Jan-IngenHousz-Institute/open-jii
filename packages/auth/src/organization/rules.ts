import { isPersonalOrgSlug } from "@repo/database";

/**
 * Slug format for organizations: lowercase letters, digits and single interior
 * hyphens. Better Auth only checks that a slug is non-empty and unique, so this
 * is the whole format rule — and it has to stay narrow, because the slug shares a
 * namespace with the personal-organization slugs the platform mints itself.
 */
export const ORG_SLUG_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

/** Upper bound comes from the `organizations.slug` column. */
export const ORG_SLUG_MAX_LENGTH = 255;

export const ORG_SLUG_FORMAT_MESSAGE =
  "Slug may only contain lowercase letters, numbers and single hyphens between them.";

export const ORG_SLUG_RESERVED_MESSAGE =
  "Slugs starting with 'personal-' are reserved for personal workspaces.";

/**
 * Why `slug` cannot be used, or `null` when it can. Returning the reason rather
 * than a boolean keeps the message with the rule instead of at each call site.
 */
export function organizationSlugRejection(slug: string): string | null {
  if (slug.length > ORG_SLUG_MAX_LENGTH || !ORG_SLUG_PATTERN.test(slug)) {
    return ORG_SLUG_FORMAT_MESSAGE;
  }
  // Personal workspaces are excluded from the whole organization surface — no
  // members, no invitations, no teams, no deletion. An organization that fell
  // into this namespace by accident would be permanently unmanageable.
  if (isPersonalOrgSlug(slug)) {
    return ORG_SLUG_RESERVED_MESSAGE;
  }
  return null;
}

/**
 * The organization roles a caller may ask for. Better Auth accepts a comma-joined
 * multi-role string and validates it only after trimming, while gating who may hand
 * out the creator role on the *un-trimmed* string — so `" owner"` or `"member, owner"`
 * passes its check and is then stored verbatim. Everything that reads a role back
 * trims, so such a row would read as a full owner that Better Auth's own permission
 * check and last-owner counters do not recognise. One exact spelling, no whitespace
 * and no lists is what keeps the two readings the same.
 */
export const ORG_ROLES = ["owner", "admin", "member"] as const;

export type OrgRoleName = (typeof ORG_ROLES)[number];

export const ORG_ROLE_MESSAGE = `Role must be exactly one of ${ORG_ROLES.join(", ")}.`;

export function isCanonicalOrgRole(role: unknown): role is OrgRoleName {
  return typeof role === "string" && (ORG_ROLES as readonly string[]).includes(role);
}

/** The tokens a stored role string carries, whatever spelling it was written in. */
function roleTokens(role: string | null | undefined): string[] {
  return (role ?? "").split(",").map((token) => token.trim());
}

/** Whether a stored role string carries the org `owner` role. */
export function isOwnerRole(role: string | null | undefined): boolean {
  return roleTokens(role).includes("owner");
}

/**
 * Whether a stored role string may run the organization's membership surface —
 * who is invited, who is in, who asked to join. Owners and admins both; a plain
 * member only reads the roster.
 */
export function isMembershipManagerRole(role: string | null | undefined): boolean {
  const tokens = roleTokens(role);
  return tokens.includes("owner") || tokens.includes("admin");
}
