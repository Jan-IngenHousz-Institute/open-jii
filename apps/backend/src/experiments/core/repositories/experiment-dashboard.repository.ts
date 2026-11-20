import { Injectable, Inject } from "@nestjs/common";

import {
  and,
  eq,
  experimentDashboards,
  experiments,
  desc,
  profiles,
  getTableColumns,
} from "@repo/database";
import type { DatabaseInstance } from "@repo/database";

import { Result, tryCatch } from "../../../common/utils/fp-utils";
import { ftsMatch, ftsRank, searchScore } from "../../../common/utils/fts";
import {
  getAnonymizedFirstName,
  getAnonymizedLastName,
} from "../../../common/utils/profile-anonymization";
import { resourceTierExpression } from "../../../common/utils/resource-access-scope";
import type {
  ExperimentDashboardDto,
  CreateExperimentDashboardDto,
  UpdateExperimentDashboardDto,
} from "../models/experiment-dashboards.model";
import { searchableExperimentCondition } from "./experiment-search-scope";

const { searchVector: _searchVector, ...dashboardColumns } = getTableColumns(experimentDashboards);

@Injectable()
export class ExperimentDashboardRepository {
  constructor(
    @Inject("DATABASE")
    private readonly database: DatabaseInstance,
  ) {}

  async search(query: string, userId: string, limit: number) {
    return tryCatch(async () => {
      const scope = searchableExperimentCondition(this.database, userId);
      const tier = resourceTierExpression({
        database: this.database,
        resourceType: "experiment",
        resourceIdColumn: experiments.id,
        organizationIdColumn: experiments.organizationId,
        createdByColumn: experiments.createdBy,
        userId,
      });
      const score = searchScore(
        ftsRank(experimentDashboards.searchVector, experimentDashboards.name, query),
        tier,
      );
      return this.database
        .select({
          id: experimentDashboards.id,
          name: experimentDashboards.name,
          description: experimentDashboards.description,
          score,
          parent: { id: experiments.id, title: experiments.name },
        })
        .from(experimentDashboards)
        .innerJoin(experiments, eq(experiments.id, experimentDashboards.experimentId))
        .where(
          and(ftsMatch(experimentDashboards.searchVector, experimentDashboards.name, query), scope),
        )
        .orderBy(desc(score), experimentDashboards.id)
        .limit(limit);
    });
  }

  async listDashboards(
    experimentId: string,
    limit: number,
    offset: number,
  ): Promise<Result<ExperimentDashboardDto[]>> {
    return tryCatch(async () => {
      const results = await this.database
        .select({
          experiment_dashboards: dashboardColumns,
          firstName: getAnonymizedFirstName(),
          lastName: getAnonymizedLastName(),
        })
        .from(experimentDashboards)
        .leftJoin(profiles, eq(experimentDashboards.createdBy, profiles.userId))
        .where(eq(experimentDashboards.experimentId, experimentId))
        .orderBy(desc(experimentDashboards.createdAt))
        .limit(limit)
        .offset(offset);

      return results.map((r) => this.toDashboardDto(r));
    });
  }

  async create(
    experimentId: string,
    dto: CreateExperimentDashboardDto,
    createdBy: string,
  ): Promise<Result<ExperimentDashboardDto[]>> {
    return tryCatch(async () => {
      const insertResults = await this.database
        .insert(experimentDashboards)
        .values({
          experimentId,
          name: dto.name,
          description: dto.description ?? null,
          // The DB defaults handle layout/widgets if omitted (the Drizzle
          // SQL defaults `{"columns":12,...}` and `[]`). Spread only when
          // the caller actually supplied a value to keep the seed tidy.
          ...(dto.layout !== undefined ? { layout: dto.layout } : {}),
          ...(dto.widgets !== undefined ? { widgets: dto.widgets } : {}),
          createdBy,
        })
        .returning({ id: experimentDashboards.id });

      const results = await this.database
        .select({
          experiment_dashboards: dashboardColumns,
          firstName: getAnonymizedFirstName(),
          lastName: getAnonymizedLastName(),
        })
        .from(experimentDashboards)
        .leftJoin(profiles, eq(experimentDashboards.createdBy, profiles.userId))
        .where(eq(experimentDashboards.id, insertResults[0].id));

      return results.map((r) => this.toDashboardDto(r));
    });
  }

  async findById(id: string): Promise<Result<ExperimentDashboardDto | null>> {
    return tryCatch(async () => {
      const result = await this.database
        .select({
          experiment_dashboards: dashboardColumns,
          firstName: getAnonymizedFirstName(),
          lastName: getAnonymizedLastName(),
        })
        .from(experimentDashboards)
        .leftJoin(profiles, eq(experimentDashboards.createdBy, profiles.userId))
        .where(eq(experimentDashboards.id, id))
        .limit(1);

      if (result.length === 0) {
        return null;
      }
      return this.toDashboardDto(result[0]);
    });
  }

  async update(
    id: string,
    dto: UpdateExperimentDashboardDto,
  ): Promise<Result<ExperimentDashboardDto[]>> {
    return tryCatch(async () => {
      await this.database
        .update(experimentDashboards)
        .set(dto)
        .where(eq(experimentDashboards.id, id));

      const results = await this.database
        .select({
          experiment_dashboards: dashboardColumns,
          firstName: getAnonymizedFirstName(),
          lastName: getAnonymizedLastName(),
        })
        .from(experimentDashboards)
        .leftJoin(profiles, eq(experimentDashboards.createdBy, profiles.userId))
        .where(eq(experimentDashboards.id, id));

      return results.map((r) => this.toDashboardDto(r));
    });
  }

  async delete(id: string): Promise<Result<void>> {
    return tryCatch(async () => {
      await this.database.delete(experimentDashboards).where(eq(experimentDashboards.id, id));
    });
  }

  // Drizzle's jsonb columns surface as `unknown`, so the cast bridges to the
  // zod-validated DTO shape here at the read boundary. Done once per row.
  private toDashboardDto(row: {
    experiment_dashboards: Omit<typeof experimentDashboards.$inferSelect, "searchVector">;
    firstName: string | null;
    lastName: string | null;
  }): ExperimentDashboardDto {
    return {
      ...(row.experiment_dashboards as Omit<ExperimentDashboardDto, "createdByName">),
      createdByName: row.firstName && row.lastName ? `${row.firstName} ${row.lastName}` : undefined,
    };
  }
}
