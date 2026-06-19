import { Inject, Injectable } from "@nestjs/common";

import {
  and,
  eq,
  experiments,
  macros,
  organizationMembers,
  protocols,
  resourceGrants,
  sensors,
  teamMembers,
  workbooks,
} from "@repo/database";
import type { DatabaseInstance } from "@repo/database";
import type { ResourceType } from "@repo/database";

import { roleCan } from "./abilities";
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
    | "resource-grant:user"
    | "resource-grant:org"
    | "resource-grant:team"
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
 * Resolution order: owning-org role → resource_grants → public+read.
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

    // 2. Owning-org membership role.
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

    // 3. Per-resource grants: direct to the user, or to an org the user belongs to.
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
    // resourceType is exhaustive over the resource_grants enum; the last arm is
    // "device" (sensors).
    const table =
      resourceType === "experiment"
        ? experiments
        : resourceType === "macro"
          ? macros
          : resourceType === "protocol"
            ? protocols
            : resourceType === "workbook"
              ? workbooks
              : sensors;
    const rows = await this.db
      .select({ organizationId: table.organizationId, visibility: table.visibility })
      .from(table)
      .where(eq(table.id, resourceId))
      .limit(1);
    return rows.length > 0 ? rows[0] : null;
  }
}
