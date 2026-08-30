import { Inject, Injectable } from "@nestjs/common";

import {
  and,
  count,
  countDistinct,
  eq,
  experiments,
  inArray,
  isNull,
  macros,
  ne,
  or,
  organizationMembers,
  protocols,
  resourceGrants,
  workbookVersions,
  workbooks,
} from "@repo/database";
import type { DatabaseInstance } from "@repo/database";

import { tryCatch } from "../../../common/utils/fp-utils";
import type { Result } from "../../../common/utils/fp-utils";
import { accessibleResourceCondition } from "../../../common/utils/resource-access-scope";

export interface ExperimentOrganizationRow {
  experimentId: string;
  organizationId: string | null;
}

@Injectable()
export class MetricsRepository {
  constructor(
    @Inject("DATABASE")
    private readonly database: DatabaseInstance,
  ) {}

  /** Owning organization per experiment; feeds the institutions count and org scoping. */
  async getExperimentOrganizations(
    experimentIds: string[],
  ): Promise<Result<ExperimentOrganizationRow[]>> {
    return tryCatch(async () => {
      if (experimentIds.length === 0) {
        return [];
      }

      const rows = await this.database
        .select({ experimentId: experiments.id, organizationId: experiments.organizationId })
        .from(experiments)
        .where(inArray(experiments.id, experimentIds));

      return rows;
    });
  }

  async getOrganizationExperimentIds(organizationId: string): Promise<Result<string[]>> {
    return tryCatch(async () => {
      const rows = await this.database
        .select({ id: experiments.id })
        .from(experiments)
        .where(eq(experiments.organizationId, organizationId));

      return rows.map((row) => row.id);
    });
  }

  /** Experiments the user created or holds a direct grant on; membership is
   * sole-sourced in resource_grants. The attribution set for "your
   * experiments", deliberately narrower than view access. */
  async getUserExperimentIds(userId: string): Promise<Result<string[]>> {
    return tryCatch(async () => {
      const [created, granted] = await Promise.all([
        this.database
          .select({ id: experiments.id })
          .from(experiments)
          .where(eq(experiments.createdBy, userId)),
        this.database
          .select({ id: resourceGrants.resourceId })
          .from(resourceGrants)
          .where(
            and(
              eq(resourceGrants.resourceType, "experiment"),
              eq(resourceGrants.granteeType, "user"),
              eq(resourceGrants.granteeId, userId),
            ),
          ),
      ]);

      return Array.from(new Set([...created, ...granted].map((row) => row.id)));
    });
  }

  /**
   * Resources of one kind the caller may read, by the same predicate the list
   * pages filter with. Activity is only ever reported for these, so a caller
   * cannot learn how busy a resource they cannot see is.
   */
  async getVisibleProtocolIds(userId: string): Promise<Result<string[]>> {
    return this.visibleIds(userId, "protocol", protocols);
  }

  async getVisibleMacroIds(userId: string): Promise<Result<string[]>> {
    return this.visibleIds(userId, "macro", macros);
  }

  async getVisibleWorkbookIds(userId: string): Promise<Result<string[]>> {
    return this.visibleIds(userId, "workbook", workbooks);
  }

  /**
   * Workbook versions belonging to the given workbooks. A measurement records
   * the version that produced it, so the warehouse keys activity by version and
   * only Postgres can fold those back into a workbook.
   */
  async getWorkbookVersionMap(workbookIds: string[]): Promise<Result<Map<string, string>>> {
    return tryCatch(async () => {
      if (workbookIds.length === 0) {
        return new Map<string, string>();
      }

      const rows = await this.database
        .select({ versionId: workbookVersions.id, workbookId: workbookVersions.workbookId })
        .from(workbookVersions)
        .where(inArray(workbookVersions.workbookId, workbookIds));

      return new Map(rows.map((row) => [row.versionId, row.workbookId]));
    });
  }

  private async visibleIds(
    userId: string,
    resourceType: "protocol" | "macro" | "workbook",
    table: typeof protocols | typeof macros | typeof workbooks,
  ): Promise<Result<string[]>> {
    return tryCatch(async () => {
      const accessScope = accessibleResourceCondition({
        database: this.database,
        resourceType,
        resourceIdColumn: table.id,
        organizationIdColumn: table.organizationId,
        visibilityColumn: table.visibility,
        userId,
      });

      const rows = await this.database.select({ id: table.id }).from(table).where(accessScope);
      return rows.map((row) => row.id);
    });
  }

  async isOrganizationMember(userId: string, organizationId: string): Promise<Result<boolean>> {
    return tryCatch(async () => {
      const rows = await this.database
        .select({ value: count() })
        .from(organizationMembers)
        .where(
          and(
            eq(organizationMembers.userId, userId),
            eq(organizationMembers.organizationId, organizationId),
          ),
        );

      return (rows[0]?.value ?? 0) > 0;
    });
  }

  async countPublicExperiments(): Promise<Result<number>> {
    return tryCatch(async () => {
      const rows = await this.database
        .select({ value: count() })
        .from(experiments)
        .where(eq(experiments.visibility, "public"));

      return rows[0]?.value ?? 0;
    });
  }

  /** Experiments granted beyond creator and owning org. Seeded creator-control
   * grants (create-into-org and the org-backfill migration) and grants to the
   * experiment's own organization are internal staffing, not sharing. */
  async countSharedExperiments(): Promise<Result<number>> {
    return tryCatch(async () => {
      const rows = await this.database
        .select({ value: countDistinct(resourceGrants.resourceId) })
        .from(resourceGrants)
        .innerJoin(experiments, eq(resourceGrants.resourceId, experiments.id))
        .where(
          and(
            eq(resourceGrants.resourceType, "experiment"),
            or(
              ne(resourceGrants.granteeType, "user"),
              ne(resourceGrants.granteeId, experiments.createdBy),
            ),
            or(
              ne(resourceGrants.granteeType, "organization"),
              isNull(experiments.organizationId),
              ne(resourceGrants.granteeId, experiments.organizationId),
            ),
          ),
        );

      return rows[0]?.value ?? 0;
    });
  }
}
