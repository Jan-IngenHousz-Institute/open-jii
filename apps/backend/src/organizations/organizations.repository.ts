import { Inject, Injectable } from "@nestjs/common";

import type { MembershipStatus } from "@repo/api/schemas/organization.schema";
import {
  and,
  asc,
  count,
  desc,
  eq,
  experiments,
  ilike,
  inArray,
  macros,
  organizationJoinRequests,
  organizationMembers,
  organizations,
  profiles,
  protocols,
  sensors,
  users,
  workbooks,
} from "@repo/database";
import type { DatabaseInstance } from "@repo/database";

import { Result, tryCatch } from "../common/utils/fp-utils";

export interface OrganizationResourceItemRow {
  id: string;
  name: string;
  description: string | null;
  updatedAt: Date | null;
}

export interface OrganizationResourcesRows {
  experiments: OrganizationResourceItemRow[];
  macros: OrganizationResourceItemRow[];
  protocols: OrganizationResourceItemRow[];
  workbooks: OrganizationResourceItemRow[];
  devices: OrganizationResourceItemRow[];
}

export interface OrganizationRow {
  id: string;
  name: string;
  slug: string | null;
  logo: string | null;
  type: string | null;
  description: string | null;
  website: string | null;
  location: string | null;
  visibility: "private" | "public";
  createdAt: Date;
}

export interface OrganizationSummaryRow extends OrganizationRow {
  memberCount: number;
  membershipStatus: MembershipStatus;
}

export interface JoinRequestRow {
  id: string;
  organizationId: string;
  user: {
    id: string;
    firstName: string;
    lastName: string;
    email: string | null;
    avatarUrl: string | null;
  };
  message: string | null;
  status: "pending" | "approved" | "rejected" | "cancelled";
  decidedBy: string | null;
  decidedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

const ORG_FIELDS = {
  id: organizations.id,
  name: organizations.name,
  slug: organizations.slug,
  logo: organizations.logo,
  type: organizations.type,
  description: organizations.description,
  website: organizations.website,
  location: organizations.location,
  visibility: organizations.visibility,
  createdAt: organizations.createdAt,
};

const REQUEST_FIELDS = {
  id: organizationJoinRequests.id,
  organizationId: organizationJoinRequests.organizationId,
  userId: organizationJoinRequests.userId,
  message: organizationJoinRequests.message,
  status: organizationJoinRequests.status,
  decidedBy: organizationJoinRequests.decidedBy,
  decidedAt: organizationJoinRequests.decidedAt,
  createdAt: organizationJoinRequests.createdAt,
  updatedAt: organizationJoinRequests.updatedAt,
  firstName: profiles.firstName,
  lastName: profiles.lastName,
  email: users.email,
  avatarUrl: profiles.avatarUrl,
};

@Injectable()
export class OrganizationsRepository {
  constructor(@Inject("DATABASE") private readonly db: DatabaseInstance) {}

  findById(organizationId: string): Promise<Result<OrganizationRow | null>> {
    return tryCatch(async () => {
      const rows = await this.db
        .select(ORG_FIELDS)
        .from(organizations)
        .where(eq(organizations.id, organizationId))
        .limit(1);
      return rows.length > 0 ? rows[0] : null;
    });
  }

  /** Public directory rows, enriched with member counts + caller membership status. */
  listPublic(
    callerId: string,
    opts: { search?: string; limit: number; offset: number },
  ): Promise<Result<OrganizationSummaryRow[]>> {
    return tryCatch(async () => {
      const where = opts.search
        ? and(eq(organizations.visibility, "public"), ilike(organizations.name, `%${opts.search}%`))
        : eq(organizations.visibility, "public");
      const rows = await this.db
        .select(ORG_FIELDS)
        .from(organizations)
        .where(where)
        .orderBy(asc(organizations.name))
        .limit(opts.limit)
        .offset(opts.offset);
      return this.enrich(callerId, rows);
    });
  }

  /** Attach member counts + the caller's membership status to org rows. */
  async enrich(callerId: string, rows: OrganizationRow[]): Promise<OrganizationSummaryRow[]> {
    const ids = rows.map((r) => r.id);
    if (ids.length === 0) return [];

    const counts = await this.db
      .select({ organizationId: organizationMembers.organizationId, n: count() })
      .from(organizationMembers)
      .where(inArray(organizationMembers.organizationId, ids))
      .groupBy(organizationMembers.organizationId);
    const countByOrg = new Map(counts.map((c) => [c.organizationId, Number(c.n)]));

    const memberOf = await this.db
      .select({ organizationId: organizationMembers.organizationId })
      .from(organizationMembers)
      .where(
        and(
          eq(organizationMembers.userId, callerId),
          inArray(organizationMembers.organizationId, ids),
        ),
      );
    const memberSet = new Set(memberOf.map((m) => m.organizationId));

    const pending = await this.db
      .select({ organizationId: organizationJoinRequests.organizationId })
      .from(organizationJoinRequests)
      .where(
        and(
          eq(organizationJoinRequests.userId, callerId),
          eq(organizationJoinRequests.status, "pending"),
          inArray(organizationJoinRequests.organizationId, ids),
        ),
      );
    const pendingSet = new Set(pending.map((p) => p.organizationId));

    return rows.map((r) => ({
      ...r,
      memberCount: countByOrg.get(r.id) ?? 0,
      membershipStatus: memberSet.has(r.id) ? "member" : pendingSet.has(r.id) ? "pending" : "none",
    }));
  }

  /** The caller's role in an org, or null if not a member. */
  async memberRole(organizationId: string, userId: string): Promise<string | null> {
    const rows = await this.db
      .select({ role: organizationMembers.role })
      .from(organizationMembers)
      .where(
        and(
          eq(organizationMembers.organizationId, organizationId),
          eq(organizationMembers.userId, userId),
        ),
      )
      .limit(1);
    return rows.length > 0 ? rows[0].role : null;
  }

  /** An org's public entities, grouped by type (the public-resources showcase). */
  listPublicResources(
    organizationId: string,
    limit = 12,
  ): Promise<Result<OrganizationResourcesRows>> {
    return tryCatch(async () => {
      const [experimentRows, macroRows, protocolRows, workbookRows, deviceRows] = await Promise.all(
        [
          this.db
            .select({
              id: experiments.id,
              name: experiments.name,
              description: experiments.description,
              updatedAt: experiments.updatedAt,
            })
            .from(experiments)
            .where(
              and(
                eq(experiments.organizationId, organizationId),
                eq(experiments.visibility, "public"),
              ),
            )
            .orderBy(desc(experiments.updatedAt))
            .limit(limit),
          this.db
            .select({
              id: macros.id,
              name: macros.name,
              description: macros.description,
              updatedAt: macros.updatedAt,
            })
            .from(macros)
            .where(and(eq(macros.organizationId, organizationId), eq(macros.visibility, "public")))
            .orderBy(desc(macros.updatedAt))
            .limit(limit),
          this.db
            .select({
              id: protocols.id,
              name: protocols.name,
              description: protocols.description,
              updatedAt: protocols.updatedAt,
            })
            .from(protocols)
            .where(
              and(eq(protocols.organizationId, organizationId), eq(protocols.visibility, "public")),
            )
            .orderBy(desc(protocols.updatedAt))
            .limit(limit),
          this.db
            .select({
              id: workbooks.id,
              name: workbooks.name,
              description: workbooks.description,
              updatedAt: workbooks.updatedAt,
            })
            .from(workbooks)
            .where(
              and(eq(workbooks.organizationId, organizationId), eq(workbooks.visibility, "public")),
            )
            .orderBy(desc(workbooks.updatedAt))
            .limit(limit),
          this.db
            .select({
              id: sensors.id,
              name: sensors.name,
              description: sensors.location,
              updatedAt: sensors.updatedAt,
            })
            .from(sensors)
            .where(
              and(eq(sensors.organizationId, organizationId), eq(sensors.visibility, "public")),
            )
            .orderBy(desc(sensors.updatedAt))
            .limit(limit),
        ],
      );
      return {
        experiments: experimentRows,
        macros: macroRows,
        protocols: protocolRows,
        workbooks: workbookRows,
        devices: deviceRows,
      };
    });
  }

  findPendingRequest(
    organizationId: string,
    userId: string,
  ): Promise<Result<JoinRequestRow | null>> {
    return tryCatch(async () => {
      const rows = await this.hydrateRequests(
        and(
          eq(organizationJoinRequests.organizationId, organizationId),
          eq(organizationJoinRequests.userId, userId),
          eq(organizationJoinRequests.status, "pending"),
        ),
      );
      return rows.length > 0 ? rows[0] : null;
    });
  }

  findRequestById(
    organizationId: string,
    requestId: string,
  ): Promise<Result<JoinRequestRow | null>> {
    return tryCatch(async () => {
      const rows = await this.hydrateRequests(
        and(
          eq(organizationJoinRequests.id, requestId),
          eq(organizationJoinRequests.organizationId, organizationId),
        ),
      );
      return rows.length > 0 ? rows[0] : null;
    });
  }

  listPendingRequests(organizationId: string): Promise<Result<JoinRequestRow[]>> {
    return tryCatch(() =>
      this.hydrateRequests(
        and(
          eq(organizationJoinRequests.organizationId, organizationId),
          eq(organizationJoinRequests.status, "pending"),
        ),
      ),
    );
  }

  createRequest(
    organizationId: string,
    userId: string,
    message: string | undefined,
  ): Promise<Result<JoinRequestRow>> {
    return tryCatch(async () => {
      const [created] = await this.db
        .insert(organizationJoinRequests)
        .values({ organizationId, userId, message })
        .returning({ id: organizationJoinRequests.id });
      const rows = await this.hydrateRequests(eq(organizationJoinRequests.id, created.id));
      return rows[0];
    });
  }

  decideRequest(
    requestId: string,
    status: "approved" | "rejected" | "cancelled",
    decidedBy: string | null,
  ): Promise<Result<JoinRequestRow>> {
    return tryCatch(async () => {
      await this.db
        .update(organizationJoinRequests)
        .set({ status, decidedBy, decidedAt: new Date() })
        .where(eq(organizationJoinRequests.id, requestId));
      const rows = await this.hydrateRequests(eq(organizationJoinRequests.id, requestId));
      return rows[0];
    });
  }

  async isMember(organizationId: string, userId: string): Promise<boolean> {
    return (await this.memberRole(organizationId, userId)) !== null;
  }

  addMember(organizationId: string, userId: string, role = "member"): Promise<Result<void>> {
    return tryCatch(async () => {
      await this.db
        .insert(organizationMembers)
        .values({ organizationId, userId, role })
        .onConflictDoNothing({
          target: [organizationMembers.organizationId, organizationMembers.userId],
        });
    });
  }

  private async hydrateRequests(where: ReturnType<typeof and> | ReturnType<typeof eq>) {
    const rows = await this.db
      .select(REQUEST_FIELDS)
      .from(organizationJoinRequests)
      .leftJoin(profiles, eq(profiles.userId, organizationJoinRequests.userId))
      .leftJoin(users, eq(users.id, organizationJoinRequests.userId))
      .where(where)
      .orderBy(desc(organizationJoinRequests.createdAt));
    return rows.map(
      (r): JoinRequestRow => ({
        id: r.id,
        organizationId: r.organizationId,
        user: {
          id: r.userId,
          firstName: r.firstName ?? "",
          lastName: r.lastName ?? "",
          email: r.email,
          avatarUrl: r.avatarUrl,
        },
        message: r.message,
        status: r.status,
        decidedBy: r.decidedBy,
        decidedAt: r.decidedAt,
        createdAt: r.createdAt,
        updatedAt: r.updatedAt,
      }),
    );
  }
}
