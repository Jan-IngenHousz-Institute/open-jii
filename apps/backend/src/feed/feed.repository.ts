import { Inject, Injectable } from "@nestjs/common";

import {
  and,
  desc,
  eq,
  exists,
  experimentMembers,
  experiments,
  macros,
  or,
  organizationMembers,
  organizations,
  protocols,
  workbooks,
} from "@repo/database";
import type { Column, DatabaseInstance, SQL } from "@repo/database";
import type { ResourceType } from "@repo/database";
import type { FeedItem, FeedItemKind } from "@repo/api/schemas/feed.schema";

import { listScopeCondition } from "../authorization/resource-scope";
import { Result, tryCatch } from "../common/utils/fp-utils";

/** A resource row shared shape across the four entity tables. */
interface ResourceRow {
  id: string;
  name: string;
  organizationId: string | null;
  visibility: "private" | "public";
  updatedAt: Date;
}

@Injectable()
export class FeedRepository {
  constructor(
    @Inject("DATABASE")
    private readonly database: DatabaseInstance,
  ) {}

  /**
   * A recency-ordered, non-isolated personal feed: recent resources I can reach
   * across ALL my organizations (mine + my orgs' + shared with me) merged with my
   * organization-membership events. Built from existing timestamps — no event log.
   */
  async getFeed(userId: string, limit = 20): Promise<Result<FeedItem[]>> {
    return tryCatch(async () => {
      const items: FeedItem[] = [];

      const expMemberExists = exists(
        this.database
          .select({ one: experimentMembers.userId })
          .from(experimentMembers)
          .where(
            and(
              eq(experimentMembers.experimentId, experiments.id),
              eq(experimentMembers.userId, userId),
            ),
          ),
      );
      const expAccessible = or(
        this.scope(
          "experiment",
          {
            id: experiments.id,
            createdBy: experiments.createdBy,
            organizationId: experiments.organizationId,
            visibility: experiments.visibility,
          },
          userId,
        ),
        expMemberExists,
      ) as SQL;

      items.push(
        ...(
          await this.database
            .select({ r: experiments, organizationName: organizations.name })
            .from(experiments)
            .leftJoin(organizations, eq(organizations.id, experiments.organizationId))
            .where(expAccessible)
            .orderBy(desc(experiments.updatedAt))
            .limit(limit)
        ).map((row) => this.toItem("experiment", row.r, row.organizationName)),
      );

      items.push(
        ...(
          await this.database
            .select({ r: protocols, organizationName: organizations.name })
            .from(protocols)
            .leftJoin(organizations, eq(organizations.id, protocols.organizationId))
            .where(
              this.scope(
                "protocol",
                {
                  id: protocols.id,
                  createdBy: protocols.createdBy,
                  organizationId: protocols.organizationId,
                  visibility: protocols.visibility,
                },
                userId,
              ),
            )
            .orderBy(desc(protocols.updatedAt))
            .limit(limit)
        ).map((row) => this.toItem("protocol", row.r, row.organizationName)),
      );

      items.push(
        ...(
          await this.database
            .select({ r: macros, organizationName: organizations.name })
            .from(macros)
            .leftJoin(organizations, eq(organizations.id, macros.organizationId))
            .where(
              this.scope(
                "macro",
                {
                  id: macros.id,
                  createdBy: macros.createdBy,
                  organizationId: macros.organizationId,
                  visibility: macros.visibility,
                },
                userId,
              ),
            )
            .orderBy(desc(macros.updatedAt))
            .limit(limit)
        ).map((row) => this.toItem("macro", row.r, row.organizationName)),
      );

      items.push(
        ...(
          await this.database
            .select({ r: workbooks, organizationName: organizations.name })
            .from(workbooks)
            .leftJoin(organizations, eq(organizations.id, workbooks.organizationId))
            .where(
              this.scope(
                "workbook",
                {
                  id: workbooks.id,
                  createdBy: workbooks.createdBy,
                  organizationId: workbooks.organizationId,
                  visibility: workbooks.visibility,
                },
                userId,
              ),
            )
            .orderBy(desc(workbooks.updatedAt))
            .limit(limit)
        ).map((row) => this.toItem("workbook", row.r, row.organizationName)),
      );

      const joined = await this.database
        .select({ id: organizations.id, name: organizations.name, joinedAt: organizationMembers.createdAt })
        .from(organizationMembers)
        .innerJoin(organizations, eq(organizations.id, organizationMembers.organizationId))
        .where(eq(organizationMembers.userId, userId))
        .orderBy(desc(organizationMembers.createdAt))
        .limit(limit);

      for (const row of joined) {
        items.push({
          kind: "organization-joined",
          id: row.id,
          title: row.name,
          organizationId: row.id,
          organizationName: row.name,
          visibility: null,
          timestamp: this.iso(row.joinedAt),
        });
      }

      return items.sort((a, b) => b.timestamp.localeCompare(a.timestamp)).slice(0, limit);
    });
  }

  private scope(
    resourceType: ResourceType,
    columns: { id: Column; createdBy: Column; organizationId: Column; visibility: Column },
    userId: string,
  ): SQL {
    return listScopeCondition(this.database, resourceType, columns, userId, "accessible") as SQL;
  }

  private toItem(
    kind: Exclude<FeedItemKind, "organization-joined">,
    row: ResourceRow,
    organizationName: string | null,
  ): FeedItem {
    return {
      kind,
      id: row.id,
      title: row.name,
      organizationId: row.organizationId ?? null,
      organizationName: organizationName ?? null,
      visibility: row.visibility,
      timestamp: this.iso(row.updatedAt),
    };
  }

  private iso(value: Date): string {
    return value.toISOString();
  }
}
