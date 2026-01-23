import { Injectable, Logger } from "@nestjs/common";

import { ErrorCodes } from "../../../../common/utils/error-codes";
import { Result, success, failure, AppError } from "../../../../common/utils/fp-utils";
import { ExperimentVisualizationDto } from "../../../core/models/experiment-visualizations.model";
import { ExperimentDto } from "../../../core/models/experiment.model";
import { ExperimentVisualizationRepository } from "../../../core/repositories/experiment-visualization.repository";
import { ExperimentRepository } from "../../../core/repositories/experiment.repository";

@Injectable()
export class DeleteExperimentVisualizationUseCase {
  private readonly logger = new Logger(DeleteExperimentVisualizationUseCase.name);

  constructor(
    private readonly experimentRepository: ExperimentRepository,
    private readonly experimentVisualizationRepository: ExperimentVisualizationRepository,
  ) {}

  async execute(visualizationId: string, userId: string): Promise<Result<void>> {
    this.logger.log({
      msg: "Deleting visualization",
      operation: "deleteExperimentVisualization",
      visualizationId,
      userId,
    });

    // Find the visualization first
    const visualizationResult =
      await this.experimentVisualizationRepository.findById(visualizationId);

    return visualizationResult.chain(async (visualization: ExperimentVisualizationDto | null) => {
      if (!visualization) {
        this.logger.warn({
          msg: "Attempt to delete non-existent visualization",
          operation: "deleteExperimentVisualization",
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
        }: {
          experiment: ExperimentDto | null;
          hasAccess: boolean;
          hasArchiveAccess: boolean;
        }) => {
          if (!experiment) {
            this.logger.warn({
              msg: "Visualization belongs to non-existent experiment",
              operation: "deleteExperimentVisualization",
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
              operation: "deleteExperimentVisualization",
              experimentId: visualization.experimentId,
              visualizationId,
              userId,
            });
            return failure(AppError.forbidden("You do not have access to this experiment"));
          }

          // Any experiment member can delete visualizations
          // No need to check if user is creator or admin, as long as they have access to the experiment

          this.logger.debug({
            msg: "Deleting visualization from repository",
            operation: "deleteExperimentVisualization",
            experimentId: visualization.experimentId,
            visualizationId,
            userId,
          });
          // Delete the visualization
          const deleteResult = await this.experimentVisualizationRepository.delete(visualizationId);

          if (deleteResult.isFailure()) {
            this.logger.error({
              msg: "Failed to delete visualization",
              errorCode: ErrorCodes.EXPERIMENT_VISUALIZATIONS_DELETE_FAILED,
              operation: "deleteExperimentVisualization",
              experimentId: visualization.experimentId,
              visualizationId,
              userId,
              error: deleteResult.error.message,
            });
            return failure(AppError.internal("Failed to delete visualization"));
          }

          this.logger.log({
            msg: "Successfully deleted visualization",
            operation: "deleteExperimentVisualization",
            experimentId: visualization.experimentId,
            visualizationId,
            userId,
            status: "success",
          });
          return success(undefined);
        },
      );
    });
  }
}
