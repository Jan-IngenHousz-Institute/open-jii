import { Injectable, Logger } from "@nestjs/common";

import { Result, success, failure, AppError } from "../../../../common/utils/fp-utils";
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
    this.logger.log(`Deleting visualization ${visualizationId} by user ${userId}`);

    // Find the visualization first
    const visualizationResult =
      await this.experimentVisualizationRepository.findById(visualizationId);

    return visualizationResult.chain(async (visualization) => {
      if (!visualization) {
        this.logger.warn(`Attempt to delete non-existent visualization with ID ${visualizationId}`);
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
          hasAccess,
          isAdmin,
        }: {
          experiment: ExperimentDto | null;
          hasAccess: boolean;
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

          if (!hasAccess) {
            this.logger.warn(
              `User ${userId} does not have access to experiment ${visualization.experimentId}`,
            );
            return failure(AppError.forbidden("You do not have access to this experiment"));
          }

          // Check if user can modify this visualization
          if (visualization.createdBy !== userId && !isAdmin) {
            this.logger.warn(
              `User ${userId} does not have permission to delete visualization ${visualizationId}`,
            );
            return failure(
              AppError.forbidden("You do not have permission to delete this visualization"),
            );
          }

          this.logger.debug(`Deleting visualization from repository: ${visualizationId}`);
          // Delete the visualization
          const deleteResult = await this.experimentVisualizationRepository.delete(visualizationId);

          if (deleteResult.isFailure()) {
            this.logger.error(
              `Failed to delete visualization ${visualizationId}:`,
              deleteResult.error.message,
            );
            return failure(AppError.internal("Failed to delete visualization"));
          }

          this.logger.log(`Successfully deleted visualization ${visualizationId}`);
          return success(undefined);
        },
      );
    });
  }
}
