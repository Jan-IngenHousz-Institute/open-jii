import { Inject, Injectable } from "@nestjs/common";

import { grantRoleCan, orgRoleCan } from "@repo/auth/access";
import type { ResourceAction } from "@repo/auth/access";
import {
  and,
  eq,
  experiments,
  iotDevices,
  macros,
  organizationMembers,
  protocols,
  resourceGrants,
  teamMembers,
  workbooks,
} from "@repo/database";
import type { DatabaseInstance, DbOrTx } from "@repo/database";
import type { ResourceType } from "@repo/database";

import { mayTransferOutOfOrganization } from "../sharing/core/transfer-authority";

export interface AccessRequest {
  resourceType: ResourceType;
  resourceId: string;
  action: ResourceAction;
}

export interface AccessDecision {
  allow: boolean;
  /**
   * The owning organization this decision was resolved against, as read at
   * decision time. Callers that then act on the owning org must use this rather
   * than re-reading: a resource can be transferred between the two reads, and the
   * second one would be scoped to an organization nobody authorized against.
   * `null` when the resource has no owning org, or was not found.
   */
  organizationId: string | null;
  /** Machine-readable reason: why access was granted or denied. */
  reason:
    | "org-role"
    | "resource-grant:user"
    | "resource-grant:team"
    | "resource-grant:org"
    | "public"
    | "forbidden"
    | "not-found";
  role?: string;
}

export interface ResourceOwnership {
  organizationId: string | null;
  visibility: "private" | "public" | null;
}

/**
 * Single authorization entry point for org-scoped, per-resource access control.
 * Resolution order (first match wins): owning-org role (Better Auth access-control
 * matrix) → per-resource grants (user → team → org) → public+read. No
 * platform-admin tier.
 */
@Injectable()
export class AuthorizationService {
  constructor(@Inject("DATABASE") private readonly db: DatabaseInstance) {}

  /**
   * `executor` lets a caller re-ask this question **inside its own transaction**,
   * on the rows it already holds locked, rather than trusting an answer read
   * before the locks. Defaults to the shared handle, so ordinary callers are
   * unaffected. Precedence is untouched — this only decides which handle the same
   * reads run on, and there is deliberately no second implementation of it.
   */
  async can(
    userId: string,
    req: AccessRequest,
    executor: DbOrTx = this.db,
  ): Promise<AccessDecision> {
    // 1. Resolve the resource's owning org + visibility.
    const ownership = await this.loadOwnership(req.resourceType, req.resourceId, executor);
    if (!ownership) {
      return { allow: false, reason: "not-found", organizationId: null };
    }
    const organizationId = ownership.organizationId;

    // 2. Owning-org membership. The user's role in the owning org is evaluated
    //    against the Better Auth access-control matrix (owner/admin → full
    //    control, member → read). A denial here falls through to explicit
    //    grants below, which can raise access but never lower it.
    if (ownership.organizationId) {
      const memberRows = await executor
        .select({ role: organizationMembers.role })
        .from(organizationMembers)
        .where(
          and(
            eq(organizationMembers.organizationId, ownership.organizationId),
            eq(organizationMembers.userId, userId),
          ),
        )
        .limit(1);
      if (memberRows.length > 0) {
        const { role } = memberRows[0];
        if (orgRoleCan(role, req.resourceType, req.action)) {
          return { allow: true, reason: "org-role", role, organizationId };
        }
      }
    }

    // 3. Per-resource grants, most-specific first: user → team → org. Per
    //    011-access-precedence.md, a grant to you outranks a team grant, which
    //    outranks an org grant. Each tier only wins if its role covers the action.
    const userGrants = await executor
      .select({ role: resourceGrants.role })
      .from(resourceGrants)
      .where(
        and(
          eq(resourceGrants.resourceType, req.resourceType),
          eq(resourceGrants.resourceId, req.resourceId),
          eq(resourceGrants.granteeType, "user"),
          eq(resourceGrants.granteeId, userId),
        ),
      );
    for (const g of userGrants) {
      if (grantRoleCan(g.role, req.resourceType, req.action)) {
        return { allow: true, reason: "resource-grant:user", role: g.role, organizationId };
      }
    }

    const teamGrants = await executor
      .select({ role: resourceGrants.role })
      .from(resourceGrants)
      .innerJoin(teamMembers, eq(teamMembers.teamId, resourceGrants.granteeId))
      .where(
        and(
          eq(resourceGrants.resourceType, req.resourceType),
          eq(resourceGrants.resourceId, req.resourceId),
          eq(resourceGrants.granteeType, "team"),
          eq(teamMembers.userId, userId),
        ),
      );
    for (const g of teamGrants) {
      if (grantRoleCan(g.role, req.resourceType, req.action)) {
        return { allow: true, reason: "resource-grant:team", role: g.role, organizationId };
      }
    }

    const orgGrants = await executor
      .select({ role: resourceGrants.role })
      .from(resourceGrants)
      .innerJoin(
        organizationMembers,
        eq(organizationMembers.organizationId, resourceGrants.granteeId),
      )
      .where(
        and(
          eq(resourceGrants.resourceType, req.resourceType),
          eq(resourceGrants.resourceId, req.resourceId),
          eq(resourceGrants.granteeType, "organization"),
          eq(organizationMembers.userId, userId),
        ),
      );
    for (const g of orgGrants) {
      if (grantRoleCan(g.role, req.resourceType, req.action)) {
        return { allow: true, reason: "resource-grant:org", role: g.role, organizationId };
      }
    }

    // 4. Public resources are world-readable.
    if (ownership.visibility === "public" && req.action === "read") {
      return { allow: true, reason: "public", organizationId };
    }

    return { allow: false, reason: "forbidden", organizationId };
  }

  /**
   * Whether the user holds a **direct user grant** on the resource — the row
   * the leave endpoint (`DELETE …/collaborators/me`) would delete. This is
   * deliberately not an access question (`can()` answers those): access held
   * via org role, an organization grant, or public visibility has no row of
   * the caller's own, so it cannot be "left". Feeds the `canLeave` rendering
   * capability.
   */
  async hasDirectUserGrant(
    userId: string,
    resourceType: ResourceType,
    resourceId: string,
  ): Promise<boolean> {
    const rows = await this.db
      .select({ id: resourceGrants.id })
      .from(resourceGrants)
      .where(
        and(
          eq(resourceGrants.resourceType, resourceType),
          eq(resourceGrants.resourceId, resourceId),
          eq(resourceGrants.granteeType, "user"),
          eq(resourceGrants.granteeId, userId),
        ),
      )
      .limit(1);
    return rows.length > 0;
  }

  /**
   * Whether the user is a member (any role) of the given organization. Gates
   * creating a resource into a specific org; the default create path targets the
   * user's personal org, where they are always the owner.
   */
  async isOrgMember(userId: string, organizationId: string): Promise<boolean> {
    const rows = await this.db
      .select({ userId: organizationMembers.userId })
      .from(organizationMembers)
      .where(
        and(
          eq(organizationMembers.organizationId, organizationId),
          eq(organizationMembers.userId, userId),
        ),
      )
      .limit(1);
    return rows.length > 0;
  }

  /**
   * Whether the user has the standing to move a resource out of `organizationId`
   * — the organization side of the transfer gate, on top of `can(manage)`. Pass
   * the owning org an access decision was resolved against, never a fresh read.
   *
   * Lives here so the rendering capability and the transfer use-case ask the same
   * question; the use-case re-asks it inside its own transaction, where the answer
   * cannot go stale.
   */
  canTransferOut(userId: string, organizationId: string | null): Promise<boolean> {
    return mayTransferOutOfOrganization(this.db, organizationId, userId);
  }

  /** Public accessor for a resource's owning org + visibility (drives sharing UI). */
  getOwnership(resourceType: ResourceType, resourceId: string): Promise<ResourceOwnership | null> {
    return this.loadOwnership(resourceType, resourceId);
  }

  /** Load owning org + visibility for a resource. Returns null when not found. */
  private async loadOwnership(
    resourceType: ResourceType,
    resourceId: string,
    executor: DbOrTx = this.db,
  ): Promise<ResourceOwnership | null> {
    // Every shareable resource type (experiment/macro/protocol/workbook/device)
    // is org-scoped and resolvable to its owning org + visibility here.
    const table =
      resourceType === "experiment"
        ? experiments
        : resourceType === "macro"
          ? macros
          : resourceType === "protocol"
            ? protocols
            : resourceType === "workbook"
              ? workbooks
              : iotDevices;
    const rows = await executor
      .select({ organizationId: table.organizationId, visibility: table.visibility })
      .from(table)
      .where(eq(table.id, resourceId))
      .limit(1);
    return rows.length > 0 ? rows[0] : null;
  }
}
