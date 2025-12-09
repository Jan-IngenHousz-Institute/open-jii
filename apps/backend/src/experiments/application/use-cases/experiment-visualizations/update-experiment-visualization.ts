import { Injectable, Logger, Inject } from "@nestjs/common";

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
    this.logger.log(`Updating visualization ${visualizationId} by user ${userId}`);

    // Find the visualization first
    const visualizationResult =
      await this.experimentVisualizationRepository.findById(visualizationId);

    return visualizationResult.chain(async (visualization: ExperimentVisualizationDto | null) => {
      if (!visualization) {
        this.logger.warn(`Attempt to update non-existent visualization with ID ${visualizationId}`);
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
            this.logger.warn(
              `Visualization ${visualizationId} belongs to non-existent experiment ${visualization.experimentId}`,
            );
            return failure(
              AppError.notFound(`Experiment with ID ${visualization.experimentId} not found`),
            );
          }

          if (!hasArchiveAccess) {
            this.logger.warn(
              `User ${userId} does not have access to experiment ${visualization.experimentId}`,
            );
            return failure(AppError.forbidden("You do not have access to this experiment"));
          }

          // Check if user can modify this visualization
          if (visualization.createdBy !== userId && !isAdmin) {
            this.logger.warn(
              `User ${userId} does not have permission to modify visualization ${visualizationId}`,
            );
            return failure(
              AppError.forbidden("You do not have permission to modify this visualization"),
            );
          }

          if (!experiment.schemaName) {
            this.logger.error(`Experiment ${visualization.experimentId} has no schema name`);
            return failure(AppError.internal("Experiment schema not provisioned"));
          }

          // Validate data sources if provided
          const dataSourceValidation = await this.databricksPort.validateDataSources(
            data.dataConfig,
            experiment.schemaName,
          );

          if (dataSourceValidation.isFailure()) {
            this.logger.warn(
              `Data source validation failed: ${dataSourceValidation.error.message}`,
            );
            return failure(dataSourceValidation.error);
          }

          this.logger.debug(`Updating visualization in repository: ${visualizationId}`);
          // Update the visualization
          const updateResult = await this.experimentVisualizationRepository.update(
            visualizationId,
            data,
          );

          return updateResult.chain((updatedVisualizations: ExperimentVisualizationDto[]) => {
            if (updatedVisualizations.length === 0) {
              this.logger.error(
                `Failed to update visualization ${visualizationId} by user ${userId}`,
              );
              return failure(AppError.internal("Failed to update visualization"));
            }

            const updatedVisualization = updatedVisualizations[0];
            this.logger.log(`Successfully updated visualization ${visualizationId}`);
            return success(updatedVisualization);
          });
        },
      );
    });
  }
}
