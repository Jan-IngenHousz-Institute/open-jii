import { Injectable } from "@nestjs/common";

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

import type { AdmitMemberInput, AdmitMemberOutcome } from "../models/organization-member.model";
import { normalizeOrgRole } from "../organization-access";
import type { MemberAdmissionPort } from "../ports/member-admission.port";

/** The organization roles, weakest first, for "does this outrank that". */
const ORG_ROLE_RANK = ["member", "admin", "owner"] as const;

@Injectable()
export class OrganizationMemberRepository implements MemberAdmissionPort {
  // The caller keeps this lock through its request/invitation transaction.
  async admit(
    tx: Transaction,
    { organizationId, userId, role }: AdmitMemberInput,
  ): Promise<AdmitMemberOutcome> {
    const locked = await tx
      .select({ id: organizations.id, type: organizations.type })
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
      await this.retireClaimedInvitations(tx, organizationId, userId, existing[0].role);
      return "already-member";
    }

    const [{ members }] = await tx
      .select({ members: count() })
      .from(organizationMembers)
      .where(eq(organizationMembers.organizationId, organizationId));

    // `>=`, matching Better Auth's own check: the limit is how many members an
    // organization may hold, so the hundredth admission is the last one that lands.
    if (locked[0].type !== "demo" && members >= ORGANIZATION_MEMBERSHIP_LIMIT) {
      return "organization-full";
    }

    const inserted = await tx
      .insert(organizationMembers)
      .values({ organizationId, userId, role })
      .onConflictDoNothing()
      .returning({ id: organizationMembers.id });

    await this.retireClaimedInvitations(tx, organizationId, userId, role);

    // The lock holds off every other admission through this primitive, so a conflict
    // here means one of Better Auth's own endpoints landed the row between the read
    // above and this insert. Either way they are a member, at whatever role they hold.
    return inserted.length > 0 ? "added" : "already-member";
  }

  private async retireClaimedInvitations(
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
          inArray(
            sql<string>`lower(${organizationInvitations.email})`,
            tx
              .select({ email: sql<string>`lower(${users.email})`.as("email") })
              .from(users)
              .where(eq(users.id, userId)),
          ),
        ),
      );
  }
}
