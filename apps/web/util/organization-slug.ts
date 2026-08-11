/**
 * The organization slug rules, mirrored client-side so the create and settings
 * forms can refuse a slug before asking the server.
 *
 * The server owns these rules (they live beside the Better Auth organization
 * plugin), but two things make a client copy load-bearing rather than cosmetic:
 * `/organization/check-slug` answers only "is it taken", bypassing the format and
 * reserved-namespace guards entirely, and the server's refusal messages are
 * untranslated English. The copy is deliberately data-only — the reason is a key,
 * so the message is localized where it is shown.
 */

/** Reserved namespace personal workspaces live in; nothing else may enter it. */
export const PERSONAL_ORG_SLUG_PREFIX = "personal-";

/** Lowercase letters, digits and single interior hyphens. */
export const ORG_SLUG_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

/** Upper bound comes from the `organizations.slug` column. */
export const ORG_SLUG_MAX_LENGTH = 255;

/** Why a slug cannot be used. Each maps to one i18n key at the call site. */
export type OrganizationSlugRejection = "required" | "format" | "tooLong" | "reserved";

/**
 * Why `slug` cannot be used, or `null` when it can. Order matters: an empty box
 * is "required" rather than a format complaint, and a reserved slug is reported
 * as reserved rather than as the format failure it also is not.
 */
export function organizationSlugRejection(slug: string): OrganizationSlugRejection | null {
  if (slug.length === 0) return "required";
  if (slug.length > ORG_SLUG_MAX_LENGTH) return "tooLong";
  if (!ORG_SLUG_PATTERN.test(slug)) return "format";
  // A slug in this namespace would mint an organization the whole product
  // surface misclassifies as a personal workspace: no members, no invitations,
  // no teams, and no way to delete it.
  if (slug.startsWith(PERSONAL_ORG_SLUG_PREFIX)) return "reserved";
  return null;
}

/**
 * Best-effort slug for a name, offered as the field's initial value. Only ever a
 * suggestion — it is validated like anything the user types, so a name that
 * reduces to nothing simply leaves the field empty rather than producing a slug
 * the server would refuse.
 */
export function suggestOrganizationSlug(name: string): string {
  return (
    name
      .toLowerCase()
      .normalize("NFKD")
      // Strip combining marks so "Universität" becomes "universitat", not "universit-t".
      .replace(/\p{M}+/gu, "")
      .replace(/[^a-z0-9]+/gu, "-")
      .replace(/^-+|-+$/gu, "")
      .slice(0, ORG_SLUG_MAX_LENGTH)
      .replace(/-+$/gu, "")
  );
}
