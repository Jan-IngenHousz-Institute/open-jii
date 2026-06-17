import { Inject, Injectable } from "@nestjs/common";

import {
  and,
  eq,
  experiments,
  macros,
  organizationMembers,
  protocols,
  resourceGrants,
  users,
  workbooks,
} from "@repo/database";
import type { DatabaseInstance } from "@repo/database";
import type { ResourceType } from "@repo/database";

import { isPlatformAdmin, roleCan } from "./abilities";
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
    | "platform-admin"
    | "org-role"
    | "resource-grant:user"
    | "resource-grant:org"
    | "public"
    | "forbidden"
    | "not-found";
  role?: string;
}

interface ResourceOwnership {
  organizationId: string | null;
  visibility: "private" | "public" | null;
}

/**
 * Single authorization entry point for org-scoped, per-resource access control.
 * Resolution order: platform admin → owning-org role → resource_grants → public+read.
 */
@Injectable()
export class AuthorizationService {
  constructor(@Inject("DATABASE") private readonly db: DatabaseInstance) {}

  async can(userId: string, req: AccessRequest): Promise<AccessDecision> {
    // 1. Platform admin: global staff bypass everything.
    const userRows = await this.db
      .select({ role: users.role })
      .from(users)
      .where(eq(users.id, userId))
      .limit(1);
    const userRole = userRows.length > 0 ? userRows[0].role : null;
    if (isPlatformAdmin(userRole)) {
      return { allow: true, reason: "platform-admin", role: userRole ?? undefined };
    }

    // 2. Resolve the resource's owning org + visibility.
    const ownership = await this.loadOwnership(req.resourceType, req.resourceId);
    if (!ownership) {
      return { allow: false, reason: "not-found" };
    }

    // 3. Owning-org membership role.
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
      if (memberRows.length > 0 && roleCan(memberRows[0].role, req.action)) {
        return { allow: true, reason: "org-role", role: memberRows[0].role };
      }
    }

    // 4. Per-resource grants: direct to the user, or to an org the user belongs to.
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

    // 5. Public resources are world-readable.
    if (ownership.visibility === "public" && req.action === "read") {
      return { allow: true, reason: "public" };
    }

    return { allow: false, reason: "forbidden" };
  }

  /** Load owning org + visibility for a resource. Returns null when not found. */
  private async loadOwnership(
    resourceType: ResourceType,
    resourceId: string,
  ): Promise<ResourceOwnership | null> {
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
    // device ownership lands in P6 (sensors → devices).
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
