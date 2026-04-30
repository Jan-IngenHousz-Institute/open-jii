import { Injectable, Inject } from "@nestjs/common";

import { eq, experimentDashboards, desc, profiles } from "@repo/database";
import type { DatabaseInstance } from "@repo/database";

import { Result, tryCatch } from "../../../common/utils/fp-utils";
import {
  getAnonymizedFirstName,
  getAnonymizedLastName,
} from "../../../common/utils/profile-anonymization";
import type {
  ExperimentDashboardDto,
  CreateExperimentDashboardDto,
  UpdateExperimentDashboardDto,
} from "../models/experiment-dashboards.model";

@Injectable()
export class ExperimentDashboardRepository {
  constructor(
    @Inject("DATABASE")
    private readonly database: DatabaseInstance,
  ) {}

  async listDashboards(experimentId: string): Promise<Result<ExperimentDashboardDto[]>> {
    return tryCatch(async () => {
      const results = await this.database
        .select({
          experiment_dashboards: experimentDashboards,
          firstName: getAnonymizedFirstName(),
          lastName: getAnonymizedLastName(),
        })
        .from(experimentDashboards)
        .innerJoin(profiles, eq(experimentDashboards.createdBy, profiles.userId))
        .where(eq(experimentDashboards.experimentId, experimentId))
        .orderBy(desc(experimentDashboards.createdAt));

      return results.map((result) => {
        const augmented = result.experiment_dashboards as ExperimentDashboardDto;
        augmented.createdByName =
          result.firstName && result.lastName
            ? `${result.firstName} ${result.lastName}`
            : undefined;
        return augmented;
      });
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
        .returning();

      const results = await this.database
        .select({
          experiment_dashboards: experimentDashboards,
          firstName: getAnonymizedFirstName(),
          lastName: getAnonymizedLastName(),
        })
        .from(experimentDashboards)
        .innerJoin(profiles, eq(experimentDashboards.createdBy, profiles.userId))
        .where(eq(experimentDashboards.id, insertResults[0].id));

      return results.map((result) => {
        const augmented = result.experiment_dashboards as ExperimentDashboardDto;
        augmented.createdByName =
          result.firstName && result.lastName
            ? `${result.firstName} ${result.lastName}`
            : undefined;
        return augmented;
      });
    });
  }

  async findById(id: string): Promise<Result<ExperimentDashboardDto | null>> {
    return tryCatch(async () => {
      const result = await this.database
        .select({
          experiment_dashboards: experimentDashboards,
          firstName: getAnonymizedFirstName(),
          lastName: getAnonymizedLastName(),
        })
        .from(experimentDashboards)
        .innerJoin(profiles, eq(experimentDashboards.createdBy, profiles.userId))
        .where(eq(experimentDashboards.id, id))
        .limit(1);

      if (result.length === 0) return null;

      const augmented = result[0].experiment_dashboards as ExperimentDashboardDto;
      augmented.createdByName =
        result[0].firstName && result[0].lastName
          ? `${result[0].firstName} ${result[0].lastName}`
          : undefined;
      return augmented;
    });
  }

  async update(
    id: string,
    dto: UpdateExperimentDashboardDto,
  ): Promise<Result<ExperimentDashboardDto[]>> {
    return tryCatch(async () => {
      await this.database.update(experimentDashboards).set(dto).where(eq(experimentDashboards.id, id));

      const results = await this.database
        .select({
          experiment_dashboards: experimentDashboards,
          firstName: getAnonymizedFirstName(),
          lastName: getAnonymizedLastName(),
        })
        .from(experimentDashboards)
        .innerJoin(profiles, eq(experimentDashboards.createdBy, profiles.userId))
        .where(eq(experimentDashboards.id, id));

      return results.map((result) => {
        const augmented = result.experiment_dashboards as ExperimentDashboardDto;
        augmented.createdByName =
          result.firstName && result.lastName
            ? `${result.firstName} ${result.lastName}`
            : undefined;
        return augmented;
      });
    });
  }

  async delete(id: string): Promise<Result<void>> {
    return tryCatch(async () => {
      await this.database.delete(experimentDashboards).where(eq(experimentDashboards.id, id));
    });
  }
}
