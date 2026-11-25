import { Injectable, Logger, Inject } from "@nestjs/common";

import { ErrorCodes } from "../../../../common/utils/error-codes";
import { Result, success, failure, AppError } from "../../../../common/utils/fp-utils";
import {
  UpdateExperimentVisualizationDto,
  ExperimentVisualizationDto,
} from "../../../core/models/experiment-visualizations.model";
import { ExperimentDto } from "../../../core/models/experiment.model";
import { DATABRICKS_PORT } from "../../../core/ports/databricks.port";
import type { DatabricksPort } from "../../../core/ports/databricks.port";
import { ExperimentVisualizationRepository } from "../../../core/repositories/experiment-visualization.repository";
import { ExperimentRepository } from "../../../core/repositories/experiment.repository";

@Injectable()
export class UpdateExperimentVisualizationUseCase {
  private readonly logger = new Logger(UpdateExperimentVisualizationUseCase.name);

  constructor(
    private readonly experimentRepository: ExperimentRepository,
    private readonly experimentVisualizationRepository: ExperimentVisualizationRepository,
    @Inject(DATABRICKS_PORT) private readonly databricksPort: DatabricksPort,
  ) {}

  async execute(
    experimentId: string,
    visualizationId: string,
    data: UpdateExperimentVisualizationDto,
    userId: string,
  ): Promise<Result<ExperimentVisualizationDto>> {
    this.logger.log({
      msg: "Updating visualization",
      operation: "updateExperimentVisualization",
      experimentId,
      visualizationId,
      userId,
    });

    const existsResult = await this.experimentVisualizationRepository.existsInExperiment(
      experimentId,
      visualizationId,
    );

    return existsResult.chain(async (exists) => {
      if (!exists) {
        this.logger.warn({
          msg: "Attempt to update missing visualization in experiment",
          experimentId,
          operation: "updateExperimentVisualization",
          visualizationId,
          userId,
        });
        return failure(AppError.notFound(`Visualization with ID ${visualizationId} not found`));
      }

      // Authorization is enforced declaratively by @CanAccess on the route.
      // The experiment is still loaded to enforce the archived-state domain rule.
      const experimentResult = await this.experimentRepository.findOne(experimentId);

      return experimentResult.chain(async (experiment: ExperimentDto | null) => {
        if (!experiment) {
          this.logger.warn({
            msg: "Visualization belongs to non-existent experiment",
            operation: "updateExperimentVisualization",
            experimentId,
            visualizationId,
            userId,
          });
          return failure(AppError.notFound(`Experiment with ID ${experimentId} not found`));
        }

        if (experiment.status === "archived") {
          this.logger.warn({
            msg: "Attempt to update visualization in an archived experiment",
            operation: "updateExperimentVisualization",
            experimentId,
            visualizationId,
            userId,
          });
          return failure(AppError.forbidden("Cannot modify an archived experiment"));
        }

        this.logger.debug({
          msg: "Updating visualization in repository",
          operation: "updateExperimentVisualization",
          experimentId,
          visualizationId,
          userId,
        });
        // Update the visualization
        const updateResult = await this.experimentVisualizationRepository.update(
          experimentId,
          visualizationId,
          data,
        );

        return updateResult.chain((updatedVisualizations: ExperimentVisualizationDto[]) => {
          if (updatedVisualizations.length === 0) {
            this.logger.error({
              msg: "Failed to update visualization",
              errorCode: ErrorCodes.EXPERIMENT_VISUALIZATIONS_UPDATE_FAILED,
              operation: "updateExperimentVisualization",
              experimentId,
              visualizationId,
              userId,
            });
            return failure(AppError.internal("Failed to update visualization"));
          }

          const updatedVisualization = updatedVisualizations[0];
          this.logger.log({
            msg: "Successfully updated visualization",
            operation: "updateExperimentVisualization",
            experimentId,
            visualizationId,
            userId,
            status: "success",
          });
          return success(updatedVisualization);
        });
      });
    });
  }
}
