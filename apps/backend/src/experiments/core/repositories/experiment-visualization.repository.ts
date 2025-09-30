import { Injectable, Inject } from "@nestjs/common";

import { eq, experimentVisualizations, desc } from "@repo/database";
import type { DatabaseInstance } from "@repo/database";

import { Result, tryCatch } from "../../../common/utils/fp-utils";
import type {
  ExperimentVisualizationDto,
  CreateExperimentVisualizationDto,
  UpdateExperimentVisualizationDto,
} from "../models/experiment-visualization.model";

@Injectable()
export class ExperimentVisualizationRepository {
  constructor(
    @Inject("DATABASE")
    private readonly database: DatabaseInstance,
  ) {}

  async listVisualizations(experimentId: string): Promise<Result<ExperimentVisualizationDto[]>> {
    return tryCatch(async () => {
      const results = await this.database
        .select()
        .from(experimentVisualizations)
        .where(eq(experimentVisualizations.experimentId, experimentId))
        .orderBy(desc(experimentVisualizations.createdAt));
      return results as ExperimentVisualizationDto[];
    });
  }

  async create(
    experimentId: string,
    dto: CreateExperimentVisualizationDto,
    createdBy: string,
  ): Promise<Result<ExperimentVisualizationDto[]>> {
    return tryCatch(async () => {
      const results = await this.database
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
      return results as ExperimentVisualizationDto[];
    });
  }

  async findById(id: string): Promise<Result<ExperimentVisualizationDto | null>> {
    return tryCatch(async () => {
      const result = await this.database
        .select()
        .from(experimentVisualizations)
        .where(eq(experimentVisualizations.id, id))
        .limit(1);

      if (result.length === 0) {
        return null;
      }

      return result[0] as ExperimentVisualizationDto;
    });
  }

  async update(
    id: string,
    dto: UpdateExperimentVisualizationDto,
  ): Promise<Result<ExperimentVisualizationDto[]>> {
    return tryCatch(async () => {
      const results = await this.database
        .update(experimentVisualizations)
        .set(dto)
        .where(eq(experimentVisualizations.id, id))
        .returning();
      return results as ExperimentVisualizationDto[];
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
