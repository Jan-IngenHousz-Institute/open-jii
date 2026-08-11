import { APIError } from "better-auth/api";

import { and, db, eq, isPersonalOrgSlug, organizationMembers, organizations } from "@repo/database";

import {
  ORG_ROLE_MESSAGE,
  isCanonicalOrgRole,
  isMembershipManagerRole,
  isOwnerRole,
  organizationSlugRejection,
} from "./rules";

/** The two directory states an organization can be in. */
export const ORGANIZATION_VISIBILITIES = ["private", "public"] as const;

export type OrganizationVisibility = (typeof ORGANIZATION_VISIBILITIES)[number];

/** Reject a slug Better Auth would otherwise accept (it only checks non-empty + unique). */
export function assertSlugAllowed(slug: string): void {
  const rejection = organizationSlugRejection(slug);
  if (rejection) {
    throw new APIError("BAD_REQUEST", { message: rejection });
  }
}

/**
 * Better Auth hands the hooks the role exactly as the caller wrote it, and its own
 * creator-role gate compares that string without trimming. Refusing anything but one
 * canonical spelling here is what makes that gate — and every later reading of the
 * stored role — agree on who is an owner.
 */
export function assertCanonicalOrgRole(role: unknown): void {
  if (!isCanonicalOrgRole(role)) {
    throw new APIError("BAD_REQUEST", { message: ORG_ROLE_MESSAGE });
  }
}

/**
 * The stored slug of an organization. Better Auth's update/invite hooks hand over
 * the *payload* and the caller's membership, never the current row, so whether the
 * target is a personal workspace has to be read back here.
 */
export async function findOrganizationSlug(organizationId: string): Promise<string | null> {
  const rows = await db
    .select({ slug: organizations.slug })
    .from(organizations)
    .where(eq(organizations.id, organizationId))
    .limit(1);
  return rows[0]?.slug ?? null;
}

/**
 * Personal workspaces are outside the organization product surface entirely: no
 * members, no invitations, no teams, no settings, no deletion. Enforced here rather
 * than in the UI because every one of these paths is a plain API call.
 */
export function assertNotPersonalOrganization(slug: string | null, what: string): void {
  if (isPersonalOrgSlug(slug)) {
    throw new APIError("BAD_REQUEST", {
      message: `Personal workspaces have no ${what}.`,
    });
  }
}

/** The caller's stored role in an organization, or `null` when they are not a member. */
export async function findMemberRole(
  organizationId: string,
  userId: string,
): Promise<string | null> {
  const rows = await db
    .select({ role: organizationMembers.role })
    .from(organizationMembers)
    .where(
      and(
        eq(organizationMembers.organizationId, organizationId),
        eq(organizationMembers.userId, userId),
      ),
    )
    .limit(1);
  return rows[0]?.role ?? null;
}

/**
 * Who may read an organization's pending invitations. Better Auth's own
 * `/organization/list-invitations` requires only *some* membership and then returns
 * the whole list — every invitee's address, role and expiry — so on its own it makes
 * that a member-readable surface. openJII treats Invited as a management view, and
 * this is the only thing that makes it one: the web client's gating decides what to
 * render, never what the endpoint will answer.
 *
 * Personal workspaces need no carve-out: invitations to one are refused at creation,
 * so there is never a list to read.
 */
export async function assertCanListInvitations(
  organizationId: string,
  userId: string,
): Promise<void> {
  if (!isMembershipManagerRole(await findMemberRole(organizationId, userId))) {
    // The same answer for a plain member and for a stranger: which of the two the
    // caller is would itself say whether the organization exists.
    throw new APIError("FORBIDDEN", {
      message: "Only an organization's owners and admins can see its pending invitations.",
    });
  }
}

/** Directory visibility is part of the organization's settings, so owners only. */
export function assertVisibilityChangeAllowed(value: unknown, memberRole: string): void {
  if (!isOwnerRole(memberRole)) {
    throw new APIError("FORBIDDEN", {
      message: "Only an organization owner can change its visibility.",
    });
  }
  if (!ORGANIZATION_VISIBILITIES.includes(value as OrganizationVisibility)) {
    throw new APIError("BAD_REQUEST", { message: "Visibility must be 'private' or 'public'." });
  }
}
