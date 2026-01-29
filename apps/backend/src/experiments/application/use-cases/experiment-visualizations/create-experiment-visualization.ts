import { Injectable, Logger, Inject } from "@nestjs/common";

import { ErrorCodes } from "../../../../common/utils/error-codes";
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
    this.logger.log({
      msg: "Creating visualization for experiment",
      operation: "createExperimentVisualization",
      experimentId,
      userId,
    });

    // Validate that name is provided
    if (!data.name || data.name.trim() === "") {
      this.logger.warn({
        msg: "Invalid visualization name provided",
        operation: "createExperimentVisualization",
        experimentId,
        userId,
      });
      return failure(AppError.badRequest("Visualization name is required"));
    }

    // Check if experiment exists and if user has access
    const accessResult = await this.experimentRepository.checkAccess(experimentId, userId);

    return accessResult.chain(
      async ({
        experiment,
        hasArchiveAccess,
      }: {
        experiment: ExperimentDto | null;
        hasAccess: boolean;
        hasArchiveAccess: boolean;
        isAdmin: boolean;
      }) => {
        if (!experiment) {
          this.logger.warn({
            msg: "Attempt to create visualization in non-existent experiment",
            operation: "createExperimentVisualization",
            experimentId,
            userId,
          });
          return failure(AppError.notFound(`Experiment with ID ${experimentId} not found`));
        }

        if (!hasArchiveAccess) {
          this.logger.warn({
            msg: "User does not have access to create visualization in experiment",
            operation: "createExperimentVisualization",
            experimentId,
            userId,
          });
          return failure(AppError.forbidden("You do not have access to this experiment"));
        }

        // Data source validation removed - queries will fail at execution time if tables/columns don't exist

        this.logger.debug({
          msg: "Schema validation skipped - will validate at query time",
          operation: "createExperimentVisualization",
          experimentId,
          userId,
        });

        this.logger.debug({
          msg: "Creating visualization in repository",
          operation: "createExperimentVisualization",
          experimentId,
          userId,
        });
        // Create the visualization
        const visualizationResult = await this.experimentVisualizationRepository.create(
          experimentId,
          data,
          userId,
        );

        return visualizationResult.chain((visualizations: ExperimentVisualizationDto[]) => {
          if (visualizations.length === 0) {
            this.logger.error({
              msg: "Failed to create visualization",
              errorCode: ErrorCodes.EXPERIMENT_VISUALIZATIONS_CREATE_FAILED,
              operation: "createExperimentVisualization",
              experimentId,
              userId,
            });
            return failure(AppError.internal("Failed to create visualization"));
          }

          const visualization = visualizations[0];
          this.logger.log({
            msg: "Successfully created visualization for experiment",
            operation: "createExperimentVisualization",
            experimentId,
            visualizationId: visualization.id,
            userId,
            status: "success",
          });
          return success(visualization);
        });
      },
    );
  }
}
