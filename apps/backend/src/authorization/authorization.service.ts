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
import type { DatabaseInstance } from "@repo/database";
import type { ResourceType } from "@repo/database";

export interface AccessRequest {
  resourceType: ResourceType;
  resourceId: string;
  action: ResourceAction;
}

export interface AccessDecision {
  allow: boolean;
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

  async can(userId: string, req: AccessRequest): Promise<AccessDecision> {
    // 1. Resolve the resource's owning org + visibility.
    const ownership = await this.loadOwnership(req.resourceType, req.resourceId);
    if (!ownership) {
      return { allow: false, reason: "not-found" };
    }

    // 2. Owning-org membership. The user's role in the owning org is evaluated
    //    against the Better Auth access-control matrix (owner/admin → full
    //    control, member → read). A denial here falls through to explicit
    //    grants below, which can raise access but never lower it.
    if (ownership.organizationId) {
      const memberRows = await this.db
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
          return { allow: true, reason: "org-role", role };
        }
      }
    }

    // 3. Per-resource grants, most-specific first: user → team → org. Per
    //    011-access-precedence.md, a grant to you outranks a team grant, which
    //    outranks an org grant. Each tier only wins if its role covers the action.
    const userGrants = await this.db
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
        return { allow: true, reason: "resource-grant:user", role: g.role };
      }
    }

    const teamGrants = await this.db
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
        return { allow: true, reason: "resource-grant:team", role: g.role };
      }
    }

    const orgGrants = await this.db
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
        return { allow: true, reason: "resource-grant:org", role: g.role };
      }
    }

    // 4. Public resources are world-readable.
    if (ownership.visibility === "public" && req.action === "read") {
      return { allow: true, reason: "public" };
    }

    return { allow: false, reason: "forbidden" };
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

  /** Public accessor for a resource's owning org + visibility (drives sharing UI). */
  getOwnership(resourceType: ResourceType, resourceId: string): Promise<ResourceOwnership | null> {
    return this.loadOwnership(resourceType, resourceId);
  }

  /** Load owning org + visibility for a resource. Returns null when not found. */
  private async loadOwnership(
    resourceType: ResourceType,
    resourceId: string,
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
    const rows = await this.db
      .select({ organizationId: table.organizationId, visibility: table.visibility })
      .from(table)
      .where(eq(table.id, resourceId))
      .limit(1);
    return rows.length > 0 ? rows[0] : null;
  }
}
