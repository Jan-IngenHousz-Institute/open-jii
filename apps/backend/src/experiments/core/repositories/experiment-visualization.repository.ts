import { Injectable, Inject, Logger } from "@nestjs/common";

import {
  and,
  eq,
  experimentVisualizations,
  experiments,
  desc,
  profiles,
  getTableColumns,
} from "@repo/database";
import type { DatabaseInstance } from "@repo/database";

import { AppError, Result, success, tryCatch } from "../../../common/utils/fp-utils";
import { ftsMatch, ftsRank, searchScore } from "../../../common/utils/fts";
import {
  getAnonymizedFirstName,
  getAnonymizedLastName,
} from "../../../common/utils/profile-anonymization";
import { resourceTierExpression } from "../../../common/utils/resource-access-scope";
import type {
  ExperimentVisualizationDto,
  CreateExperimentVisualizationDto,
  UpdateExperimentVisualizationDto,
} from "../models/experiment-visualizations.model";
import { selectExperimentVisualizationSchema } from "../models/experiment-visualizations.model";
import { searchableExperimentCondition } from "./experiment-search-scope";

const { searchVector: _searchVector, ...visualizationColumns } =
  getTableColumns(experimentVisualizations);

function visualizationInExperiment(experimentId: string, id: string) {
  return and(
    eq(experimentVisualizations.experimentId, experimentId),
    eq(experimentVisualizations.id, id),
  );
}

@Injectable()
export class ExperimentVisualizationRepository {
  private readonly logger = new Logger(ExperimentVisualizationRepository.name);

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
        ftsRank(experimentVisualizations.searchVector, experimentVisualizations.name, query),
        tier,
      );
      return this.database
        .select({
          id: experimentVisualizations.id,
          name: experimentVisualizations.name,
          description: experimentVisualizations.description,
          score,
          parent: { id: experiments.id, title: experiments.name },
        })
        .from(experimentVisualizations)
        .innerJoin(experiments, eq(experiments.id, experimentVisualizations.experimentId))
        .where(
          and(
            ftsMatch(experimentVisualizations.searchVector, experimentVisualizations.name, query),
            scope,
          ),
        )
        .orderBy(desc(score), experimentVisualizations.id)
        .limit(limit);
    });
  }

  async listVisualizations(experimentId: string): Promise<Result<ExperimentVisualizationDto[]>> {
    return tryCatch(async () => {
      const results = await this.database
        .select({
          experiment_visualizations: visualizationColumns,
          profileUserId: profiles.userId,
          firstName: getAnonymizedFirstName(),
          lastName: getAnonymizedLastName(),
        })
        .from(experimentVisualizations)
        .leftJoin(profiles, eq(experimentVisualizations.createdBy, profiles.userId))
        .where(eq(experimentVisualizations.experimentId, experimentId))
        .orderBy(desc(experimentVisualizations.createdAt));

      return results.flatMap((result) => {
        const visualization = this.parseVisualization({
          ...result.experiment_visualizations,
          createdByName:
            result.profileUserId && result.firstName && result.lastName
              ? `${result.firstName} ${result.lastName}`
              : undefined,
        });
        return visualization ? [visualization] : [];
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
        .returning({ id: experimentVisualizations.id });

      // Fetch the created record with profile information
      const results = await this.database
        .select({
          experiment_visualizations: visualizationColumns,
          profileUserId: profiles.userId,
          firstName: getAnonymizedFirstName(),
          lastName: getAnonymizedLastName(),
        })
        .from(experimentVisualizations)
        .leftJoin(profiles, eq(experimentVisualizations.createdBy, profiles.userId))
        .where(eq(experimentVisualizations.id, insertResults[0].id));

      return results.map((result) => {
        const augmentedResult = result.experiment_visualizations as ExperimentVisualizationDto;
        augmentedResult.createdByName =
          result.profileUserId && result.firstName && result.lastName
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
          experiment_visualizations: visualizationColumns,
          profileUserId: profiles.userId,
          firstName: getAnonymizedFirstName(),
          lastName: getAnonymizedLastName(),
        })
        .from(experimentVisualizations)
        .leftJoin(profiles, eq(experimentVisualizations.createdBy, profiles.userId))
        .where(eq(experimentVisualizations.id, id))
        .limit(1);

      if (result.length === 0) {
        return null;
      }

      const augmentedResult = result[0].experiment_visualizations as ExperimentVisualizationDto;
      augmentedResult.createdByName =
        result[0].profileUserId && result[0].firstName && result[0].lastName
          ? `${result[0].firstName} ${result[0].lastName}`
          : undefined;
      return augmentedResult;
    });
  }

  async existsInExperiment(experimentId: string, id: string): Promise<Result<boolean>> {
    return tryCatch(async () => {
      const rows = await this.database
        .select({ id: experimentVisualizations.id })
        .from(experimentVisualizations)
        .where(visualizationInExperiment(experimentId, id))
        .limit(1);

      return rows.length > 0;
    });
  }

  async findReadableById(id: string): Promise<Result<ExperimentVisualizationDto | null>> {
    const result = await this.findById(id);
    if (result.isFailure()) {
      return result;
    }
    return success(result.value ? this.parseVisualization(result.value) : null);
  }

  private parseVisualization(visualization: {
    id: string;
    experimentId: string;
    [key: string]: unknown;
  }): ExperimentVisualizationDto | null {
    const parsed = selectExperimentVisualizationSchema.safeParse(visualization);
    if (parsed.success) {
      return parsed.data;
    }

    this.logger.warn({
      msg: "Skipping unreadable experiment visualization",
      operation: "readExperimentVisualization",
      visualizationId: visualization.id,
      experimentId: visualization.experimentId,
      issues: parsed.error.issues.map(({ path, code }) => ({ path, code })),
    });
    return null;
  }

  async update(
    experimentId: string,
    id: string,
    dto: UpdateExperimentVisualizationDto,
  ): Promise<Result<ExperimentVisualizationDto[]>> {
    return tryCatch(() =>
      this.database.transaction(async (tx) => {
        const condition = visualizationInExperiment(experimentId, id);
        const rows = await tx
          .select({
            experiment_visualizations: visualizationColumns,
            profileUserId: profiles.userId,
            firstName: getAnonymizedFirstName(),
            lastName: getAnonymizedLastName(),
          })
          .from(experimentVisualizations)
          .leftJoin(profiles, eq(experimentVisualizations.createdBy, profiles.userId))
          .where(condition)
          .for("update", { of: experimentVisualizations });
        const current = rows.at(0);
        if (!current) {
          return [];
        }

        const changes = Object.fromEntries(
          Object.entries<unknown>(dto).filter(([, value]) => value !== undefined),
        );
        const candidate = selectExperimentVisualizationSchema.safeParse({
          ...current.experiment_visualizations,
          ...changes,
          updatedAt: new Date(),
          createdByName:
            current.profileUserId && current.firstName && current.lastName
              ? `${current.firstName} ${current.lastName}`
              : undefined,
        });
        if (!candidate.success) {
          const fields = new Set(candidate.error.issues.map(({ path }) => path.join(".")));
          throw AppError.validationError(`Invalid saved chart fields: ${[...fields].join(", ")}`);
        }

        const updated = await tx
          .update(experimentVisualizations)
          .set(dto)
          .where(condition)
          .returning({ updatedAt: experimentVisualizations.updatedAt });
        return updated.map(({ updatedAt }) => ({
          ...candidate.data,
          updatedAt,
        }));
      }),
    );
  }

  async delete(experimentId: string, id: string): Promise<Result<void>> {
    return tryCatch(async () => {
      await this.database
        .delete(experimentVisualizations)
        .where(visualizationInExperiment(experimentId, id));
    });
  }
}
