import { Injectable, Logger, Inject } from "@nestjs/common";

import { Result, success, failure, AppError } from "../../../../common/utils/fp-utils";
import {
  CreateExperimentVisualizationDto,
  ExperimentVisualizationDto,
} from "../../../core/models/experiment-visualizations.model";
import { ExperimentDto } from "../../../core/models/experiment.model";
import { DATABRICKS_PORT } from "../../../core/ports/databricks.port";
import type { DatabricksPort } from "../../../core/ports/databricks.port";
import { ExperimentVisualizationRepository } from "../../../core/repositories/experiment-visualization.repository";
import { ExperimentRepository } from "../../../core/repositories/experiment.repository";

@Injectable()
export class CreateExperimentVisualizationUseCase {
  private readonly logger = new Logger(CreateExperimentVisualizationUseCase.name);

  constructor(
    private readonly experimentRepository: ExperimentRepository,
    private readonly experimentVisualizationRepository: ExperimentVisualizationRepository,
    @Inject(DATABRICKS_PORT) private readonly databricksPort: DatabricksPort,
  ) {}

  async execute(
    experimentId: string,
    data: CreateExperimentVisualizationDto,
    userId: string,
  ): Promise<Result<ExperimentVisualizationDto>> {
    this.logger.log(
      `Creating visualization "${data.name}" for experiment ${experimentId} by user ${userId}`,
    );

    // Validate that the user ID is provided
    if (!userId) {
      this.logger.warn("Attempt to create visualization without user ID");
      return failure(AppError.badRequest("User ID is required to create a visualization"));
    }

    // Validate that name is provided
    if (!data.name || data.name.trim() === "") {
      this.logger.warn(`Invalid visualization name provided by user ${userId}`);
      return failure(AppError.badRequest("Visualization name is required"));
    }

    // Check if experiment exists and if user has access
    const accessResult = await this.experimentRepository.checkAccess(experimentId, userId);

    return accessResult.chain(
      async ({
        experiment,
        hasAccess,
      }: {
        experiment: ExperimentDto | null;
        hasAccess: boolean;
        isAdmin: boolean;
      }) => {
        if (!experiment) {
          this.logger.warn(
            `Attempt to create visualization in non-existent experiment with ID ${experimentId}`,
          );
          return failure(AppError.notFound(`Experiment with ID ${experimentId} not found`));
        }

        if (!hasAccess) {
          this.logger.warn(
            `User ${userId} does not have access to create visualization in experiment ${experimentId}`,
          );
          return failure(AppError.forbidden("You do not have access to this experiment"));
        }

        // Validate data sources exist
        const dataSourceValidation = await this.databricksPort.validateDataSources(
          data.dataConfig,
          experiment.name,
          experimentId,
        );

        if (dataSourceValidation.isFailure()) {
          this.logger.warn(`Data source validation failed: ${dataSourceValidation.error.message}`);
          return failure(dataSourceValidation.error);
        }

        this.logger.debug(`Creating visualization in repository: "${data.name}"`);
        // Create the visualization
        const visualizationResult = await this.experimentVisualizationRepository.create(
          experimentId,
          data,
          userId,
        );

        return visualizationResult.chain((visualizations: ExperimentVisualizationDto[]) => {
          if (visualizations.length === 0) {
            this.logger.error(
              `Failed to create visualization "${data.name}" for experiment ${experimentId} by user ${userId}`,
            );
            return failure(AppError.internal("Failed to create visualization"));
          }

          const visualization = visualizations[0];
          this.logger.log(
            `Successfully created visualization ${visualization.id} for experiment ${experimentId}`,
          );
          return success(visualization);
        });
      },
    );
  }
}
