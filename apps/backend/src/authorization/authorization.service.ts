import { Inject, Injectable } from "@nestjs/common";

import {
  and,
  eq,
  experiments,
  macros,
  organizationMembers,
  organizations,
  protocols,
  resourceGrants,
  teamMembers,
  workbooks,
} from "@repo/database";
import type { DatabaseInstance } from "@repo/database";
import type { ResourceType } from "@repo/database";

import { basePermissionCan, roleCan } from "./abilities";
import type { ResourceAction } from "./abilities";

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
    | "org-base-permission"
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
 * Resolution order (first match wins): owning-org role → org base permission →
 * per-resource grants (user → team → org) → public+read. No platform-admin tier.
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

    // 2. Owning-org membership. Owners/admins always have full access; plain
    //    members get the org's configurable base permission (none/read/admin).
    //    A denial here falls through to explicit grants below (which override).
    if (ownership.organizationId) {
      const memberRows = await this.db
        .select({
          role: organizationMembers.role,
          basePermission: organizations.basePermission,
        })
        .from(organizationMembers)
        .innerJoin(organizations, eq(organizations.id, organizationMembers.organizationId))
        .where(
          and(
            eq(organizationMembers.organizationId, ownership.organizationId),
            eq(organizationMembers.userId, userId),
          ),
        )
        .limit(1);
      if (memberRows.length > 0) {
        const { role, basePermission } = memberRows[0];
        // owner/admin → full control (roleCan grants "manage" only to them).
        if (roleCan(role, "manage")) {
          return { allow: true, reason: "org-role", role };
        }
        if (basePermissionCan(basePermission, req.action)) {
          return { allow: true, reason: "org-base-permission", role };
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
      if (roleCan(g.role, req.action)) {
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
      if (roleCan(g.role, req.action)) {
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
      if (roleCan(g.role, req.action)) {
        return { allow: true, reason: "resource-grant:org", role: g.role };
      }
    }

    // 4. Public resources are world-readable.
    if (ownership.visibility === "public" && req.action === "read") {
      return { allow: true, reason: "public" };
    }

    return { allow: false, reason: "forbidden" };
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
    // Experiments/macros/protocols/workbooks are org-scoped this phase; "device"
    // (sensors) is not yet wired for org ownership, so treat it as not-found.
    const table =
      resourceType === "experiment"
        ? experiments
        : resourceType === "macro"
          ? macros
          : resourceType === "protocol"
            ? protocols
            : resourceType === "workbook"
              ? workbooks
              : null;
    if (!table) {
      return null;
    }
    const rows = await this.db
      .select({ organizationId: table.organizationId, visibility: table.visibility })
      .from(table)
      .where(eq(table.id, resourceId))
      .limit(1);
    return rows.length > 0 ? rows[0] : null;
  }
}
