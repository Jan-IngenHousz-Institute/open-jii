import { Injectable, Inject } from "@nestjs/common";

import { eq, experimentVisualizations, desc, profiles } from "@repo/database";
import type { DatabaseInstance } from "@repo/database";

import { Result, tryCatch } from "../../../common/utils/fp-utils";
import {
  getAnonymizedFirstName,
  getAnonymizedLastName,
} from "../../../common/utils/profile-anonymization";
import type {
  ExperimentVisualizationDto,
  CreateExperimentVisualizationDto,
  UpdateExperimentVisualizationDto,
} from "../models/experiment-visualizations.model";

@Injectable()
export class ExperimentVisualizationRepository {
  constructor(
    @Inject("DATABASE")
    private readonly database: DatabaseInstance,
  ) {}

  async listVisualizations(experimentId: string): Promise<Result<ExperimentVisualizationDto[]>> {
    return tryCatch(async () => {
      const results = await this.database
        .select({
          experiment_visualizations: experimentVisualizations,
          firstName: getAnonymizedFirstName(),
          lastName: getAnonymizedLastName(),
        })
        .from(experimentVisualizations)
        .innerJoin(profiles, eq(experimentVisualizations.createdBy, profiles.userId))
        .where(eq(experimentVisualizations.experimentId, experimentId))
        .orderBy(desc(experimentVisualizations.createdAt));

      return results.map((result) => {
        const augmentedResult = result.experiment_visualizations as ExperimentVisualizationDto;
        augmentedResult.createdByName =
          result.firstName && result.lastName
            ? `${result.firstName} ${result.lastName}`
            : undefined;
        return augmentedResult;
      });
    });
  }

  async create(
    experimentId: string,
    dto: CreateExperimentVisualizationDto,
    createdBy: string,
  ): Promise<Result<ExperimentVisualizationDto[]>> {
    return tryCatch(async () => {
      const insertResults = await this.database
        .insert(experimentVisualizations)
        .values({
          experimentId,
          name: dto.name,
          description: dto.description ?? null,
          chartFamily: dto.chartFamily,
          chartType: dto.chartType,
          config: dto.config,
          dataConfig: dto.dataConfig,
          createdBy,
        })
        .returning();

      // Fetch the created record with profile information
      const results = await this.database
        .select({
          experiment_visualizations: experimentVisualizations,
          firstName: getAnonymizedFirstName(),
          lastName: getAnonymizedLastName(),
        })
        .from(experimentVisualizations)
        .innerJoin(profiles, eq(experimentVisualizations.createdBy, profiles.userId))
        .where(eq(experimentVisualizations.id, insertResults[0].id));

      return results.map((result) => {
        const augmentedResult = result.experiment_visualizations as ExperimentVisualizationDto;
        augmentedResult.createdByName =
          result.firstName && result.lastName
            ? `${result.firstName} ${result.lastName}`
            : undefined;
        return augmentedResult;
      });
    });
  }

  async findById(id: string): Promise<Result<ExperimentVisualizationDto | null>> {
    return tryCatch(async () => {
      const result = await this.database
        .select({
          experiment_visualizations: experimentVisualizations,
          firstName: getAnonymizedFirstName(),
          lastName: getAnonymizedLastName(),
        })
        .from(experimentVisualizations)
        .innerJoin(profiles, eq(experimentVisualizations.createdBy, profiles.userId))
        .where(eq(experimentVisualizations.id, id))
        .limit(1);

      if (result.length === 0) {
        return null;
      }

      const augmentedResult = result[0].experiment_visualizations as ExperimentVisualizationDto;
      augmentedResult.createdByName =
        result[0].firstName && result[0].lastName
          ? `${result[0].firstName} ${result[0].lastName}`
          : undefined;
      return augmentedResult;
    });
  }

  async update(
    id: string,
    dto: UpdateExperimentVisualizationDto,
  ): Promise<Result<ExperimentVisualizationDto[]>> {
    return tryCatch(async () => {
      await this.database
        .update(experimentVisualizations)
        .set(dto)
        .where(eq(experimentVisualizations.id, id));

      // Fetch the updated record with profile information
      const results = await this.database
        .select({
          experiment_visualizations: experimentVisualizations,
          firstName: getAnonymizedFirstName(),
          lastName: getAnonymizedLastName(),
        })
        .from(experimentVisualizations)
        .innerJoin(profiles, eq(experimentVisualizations.createdBy, profiles.userId))
        .where(eq(experimentVisualizations.id, id));

      return results.map((result) => {
        const augmentedResult = result.experiment_visualizations as ExperimentVisualizationDto;
        augmentedResult.createdByName =
          result.firstName && result.lastName
            ? `${result.firstName} ${result.lastName}`
            : undefined;
        return augmentedResult;
      });
    });
  }

  async delete(id: string): Promise<Result<void>> {
    return tryCatch(async () => {
      await this.database
        .delete(experimentVisualizations)
        .where(eq(experimentVisualizations.id, id));
    });
  }
}
