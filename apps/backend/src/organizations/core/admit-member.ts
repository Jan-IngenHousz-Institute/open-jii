import {
  ORGANIZATION_MEMBERSHIP_LIMIT,
  and,
  count,
  eq,
  gt,
  inArray,
  isNotPersonalOrgSql,
  organizationInvitations,
  organizationMembers,
  organizations,
  sql,
  users,
} from "@repo/database";
import type { Transaction } from "@repo/database";

import { normalizeOrgRole } from "./organization-access";

/**
 * What an admission did. `organization-full` is the only outcome the caller cannot
 * resolve by re-reading — the organization has to lose somebody first.
 */
export type AdmitMemberOutcome =
  | "added"
  | "already-member"
  | "organization-gone"
  | "organization-full";

/** The organization roles, weakest first, for "does this outrank that". */
const ORG_ROLE_RANK = ["member", "admin", "owner"] as const;

/**
 * What a caller is told when the cap turns an admission away, worded the same on every
 * path that can hit it — the number comes from the constant both this and Better Auth's
 * own limit read, so the message cannot name a different one.
 */
export const ORGANIZATION_FULL_MESSAGE =
  `This organization has reached its limit of ${ORGANIZATION_MEMBERSHIP_LIMIT} members. ` +
  `Remove someone before adding anyone else.`;

/**
 * Put somebody on an organization's roster, under the membership cap, from inside the
 * caller's transaction.
 *
 * The one place the three direct writers go through — adding a registered user,
 * accepting an invitation at sign-in, approving a join request. Better Auth enforces
 * `membershipLimit` on its own endpoints and knows nothing of these, so each of them
 * could walk an organization past the cap on its own, and two admissions arriving
 * together could cross it even where each one had checked.
 *
 * `FOR UPDATE` on the organization row is what makes the count mean anything: it
 * serializes admissions against each other, against Better Auth's own add-member and
 * accept endpoints (their membership insert takes `FOR KEY SHARE` on the same row,
 * which this conflicts with), and against the organization's deletion. Re-testing
 * non-personal inside the lock is there for the same reason — nobody may be added to a
 * personal workspace, and a slug read earlier can have changed since.
 *
 * The lock order is organization row → membership rows, and nothing else takes them
 * the other way round: the sharing and account-deletion paths claim
 * `organization_members` owner rows and never reach for the organization row, and an
 * admission only ever writes a row that did not exist.
 */
export async function admitMember(
  tx: Transaction,
  {
    organizationId,
    userId,
    role,
  }: {
    organizationId: string;
    userId: string;
    role: string;
  },
): Promise<AdmitMemberOutcome> {
  const locked = await tx
    .select({ id: organizations.id })
    .from(organizations)
    .where(and(eq(organizations.id, organizationId), isNotPersonalOrgSql()))
    .limit(1)
    .for("update");

  if (locked.length === 0) return "organization-gone";

  // Read before the cap, so somebody already on the roster is never told the
  // organization is full: there is nothing for them to do about it, and nothing to
  // admit either.
  const existing = await tx
    .select({ role: organizationMembers.role })
    .from(organizationMembers)
    .where(
      and(
        eq(organizationMembers.organizationId, organizationId),
        eq(organizationMembers.userId, userId),
      ),
    )
    .limit(1);

  if (existing.length > 0) {
    await retireClaimedInvitations(tx, organizationId, userId, existing[0].role);
    return "already-member";
  }

  const [{ members }] = await tx
    .select({ members: count() })
    .from(organizationMembers)
    .where(eq(organizationMembers.organizationId, organizationId));

  // `>=`, matching Better Auth's own check: the limit is how many members an
  // organization may hold, so the hundredth admission is the last one that lands.
  if (members >= ORGANIZATION_MEMBERSHIP_LIMIT) return "organization-full";

  const inserted = await tx
    .insert(organizationMembers)
    .values({ organizationId, userId, role })
    .onConflictDoNothing()
    .returning({ id: organizationMembers.id });

  await retireClaimedInvitations(tx, organizationId, userId, role);

  // The lock holds off every other admission through this primitive, so a conflict
  // here means one of Better Auth's own endpoints landed the row between the read
  // above and this insert. Either way they are a member, at whatever role they hold.
  return inserted.length > 0 ? "added" : "already-member";
}

/**
 * Close the pending invitations this admission has answered: the ones offering no more
 * than the role the person now holds. Left open they stay claimable, and claiming one
 * would re-run an admission nobody needs while holding a slot against
 * `invitationLimit`.
 *
 * An invitation offering *more* survives on purpose. Being admitted as a member is not
 * an answer to an offer of admin or owner — under the sign-in auto-accept rules those
 * two are exactly the roles that wait for a deliberate accept, and the accept page is
 * where the promotion is claimed.
 *
 * Marked accepted rather than deleted: they did join the organization it named, so the
 * inviter's Invited tab should say so rather than lose the row.
 *
 * This runs while {@link admitMember} holds the organization row, which is what keeps
 * the lock order one-way — every path reaches the organization row before any
 * invitation row, so a direct admission and an invitation being claimed cannot take
 * them in opposite orders.
 */
async function retireClaimedInvitations(
  tx: Transaction,
  organizationId: string,
  userId: string,
  heldRole: string,
): Promise<void> {
  const held = normalizeOrgRole(heldRole);
  const answered = ORG_ROLE_RANK.slice(0, ORG_ROLE_RANK.indexOf(held) + 1);

  await tx
    .update(organizationInvitations)
    .set({ status: "accepted" })
    .where(
      and(
        eq(organizationInvitations.organizationId, organizationId),
        eq(organizationInvitations.status, "pending"),
        // A lapsed invitation is already dead to every reader, and nobody accepted it.
        gt(organizationInvitations.expiresAt, new Date()),
        // A role-less invitation is a member invitation everywhere else, so it is one
        // here too. Anything the canonical spellings do not cover is left pending
        // rather than guessed at.
        inArray(sql`coalesce(${organizationInvitations.role}, 'member')`, [...answered]),
        // Case-insensitive, as everywhere else: Better Auth stores the address as the
        // inviter typed it.
        sql`lower(${organizationInvitations.email}) = (
          SELECT lower(${users.email}) FROM ${users} WHERE ${users.id} = ${userId}
        )`,
      ),
    );
}
