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
    visualizationId: string,
    data: UpdateExperimentVisualizationDto,
    userId: string,
  ): Promise<Result<ExperimentVisualizationDto>> {
    this.logger.log({
      msg: "Updating visualization",
      operation: "updateExperimentVisualization",
      visualizationId,
      userId,
    });

    // Find the visualization first
    const visualizationResult =
      await this.experimentVisualizationRepository.findById(visualizationId);

    return visualizationResult.chain(async (visualization: ExperimentVisualizationDto | null) => {
      if (!visualization) {
        this.logger.warn({
          msg: "Attempt to update non-existent visualization",
          operation: "updateExperimentVisualization",
          visualizationId,
          userId,
        });
        return failure(AppError.notFound(`Visualization with ID ${visualizationId} not found`));
      }

      // Check if experiment exists and if user has access
      const accessResult = await this.experimentRepository.checkAccess(
        visualization.experimentId,
        userId,
      );

      return accessResult.chain(
        async ({
          experiment,
          hasArchiveAccess,
          isAdmin,
        }: {
          experiment: ExperimentDto | null;
          hasAccess: boolean;
          hasArchiveAccess: boolean;
          isAdmin: boolean;
        }) => {
          if (!experiment) {
            this.logger.warn({
              msg: "Visualization belongs to non-existent experiment",
              operation: "updateExperimentVisualization",
              experimentId: visualization.experimentId,
              visualizationId,
              userId,
            });
            return failure(
              AppError.notFound(`Experiment with ID ${visualization.experimentId} not found`),
            );
          }

          if (!hasArchiveAccess) {
            this.logger.warn({
              msg: "User does not have access to experiment",
              operation: "updateExperimentVisualization",
              experimentId: visualization.experimentId,
              visualizationId,
              userId,
            });
            return failure(AppError.forbidden("You do not have access to this experiment"));
          }

          // Check if user can modify this visualization
          if (visualization.createdBy !== userId && !isAdmin) {
            this.logger.warn({
              msg: "User does not have permission to modify visualization",
              operation: "updateExperimentVisualization",
              experimentId: visualization.experimentId,
              visualizationId,
              userId,
            });
            return failure(
              AppError.forbidden("You do not have permission to modify this visualization"),
            );
          }

          if (!experiment.schemaName) {
            this.logger.error({
              msg: "Experiment has no schema name",
              errorCode: ErrorCodes.EXPERIMENT_SCHEMA_NOT_READY,
              operation: "updateExperimentVisualization",
              experimentId: visualization.experimentId,
              visualizationId,
              userId,
            });
            return failure(AppError.internal("Experiment schema not provisioned"));
          }

          // Validate data sources if provided
          const dataSourceValidation = await this.databricksPort.validateDataSources(
            data.dataConfig,
            experiment.schemaName,
          );

          if (dataSourceValidation.isFailure()) {
            this.logger.warn({
              msg: "Data source validation failed",
              operation: "updateExperimentVisualization",
              experimentId: visualization.experimentId,
              visualizationId,
              userId,
              error: dataSourceValidation.error.message,
            });
            return failure(dataSourceValidation.error);
          }

          this.logger.debug({
            msg: "Updating visualization in repository",
            operation: "updateExperimentVisualization",
            experimentId: visualization.experimentId,
            visualizationId,
            userId,
          });
          // Update the visualization
          const updateResult = await this.experimentVisualizationRepository.update(
            visualizationId,
            data,
          );

          return updateResult.chain((updatedVisualizations: ExperimentVisualizationDto[]) => {
            if (updatedVisualizations.length === 0) {
              this.logger.error({
                msg: "Failed to update visualization",
                errorCode: ErrorCodes.EXPERIMENT_VISUALIZATIONS_UPDATE_FAILED,
                operation: "updateExperimentVisualization",
                experimentId: visualization.experimentId,
                visualizationId,
                userId,
              });
              return failure(AppError.internal("Failed to update visualization"));
            }

            const updatedVisualization = updatedVisualizations[0];
            this.logger.log({
              msg: "Successfully updated visualization",
              operation: "updateExperimentVisualization",
              experimentId: visualization.experimentId,
              visualizationId,
              userId,
              status: "success",
            });
            return success(updatedVisualization);
          });
        },
      );
    });
  }
}
