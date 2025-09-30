import { Injectable, Logger } from "@nestjs/common";

import { Result, failure, success, AppError } from "../../../../common/utils/fp-utils";
import { ExperimentVisualizationDto } from "../../../core/models/experiment-visualization.model";
import { ExperimentDto } from "../../../core/models/experiment.model";
import { ExperimentVisualizationRepository } from "../../../core/repositories/experiment-visualization.repository";
import { ExperimentRepository } from "../../../core/repositories/experiment.repository";

@Injectable()
export class GetExperimentVisualizationUseCase {
  private readonly logger = new Logger(GetExperimentVisualizationUseCase.name);

  constructor(
    private readonly experimentRepository: ExperimentRepository,
    private readonly experimentVisualizationRepository: ExperimentVisualizationRepository,
  ) {}

  async execute(
    experimentId: string,
    visualizationId: string,
    userId: string,
  ): Promise<Result<ExperimentVisualizationDto>> {
    this.logger.log(
      `Getting visualization ${visualizationId} of experiment ${experimentId} for user ${userId}`,
    );

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
            `Attempt to get visualization of non-existent experiment with ID ${experimentId}`,
          );
          return failure(AppError.notFound(`Experiment with ID ${experimentId} not found`));
        }

        if (!hasAccess && experiment.visibility !== "public") {
          this.logger.warn(
            `User ${userId} does not have access to experiment ${experimentId} visualization ${visualizationId}`,
          );
          return failure(AppError.forbidden("You do not have access to this experiment"));
        }

        // Get the specific visualization
        const visualizationResult =
          await this.experimentVisualizationRepository.findById(visualizationId);

        if (visualizationResult.isFailure()) {
          this.logger.error(
            `Failed to retrieve visualization ${visualizationId} for experiment ${experimentId}:`,
            visualizationResult.error.message,
          );
          return failure(AppError.internal("Failed to retrieve experiment visualization"));
        }

        const visualization = visualizationResult.value;

        if (!visualization) {
          this.logger.warn(`Visualization with ID ${visualizationId} not found`);
          return failure(AppError.notFound(`Visualization with ID ${visualizationId} not found`));
        }

        // Verify that the visualization belongs to the requested experiment
        if (visualization.experimentId !== experimentId) {
          this.logger.warn(
            `Visualization ${visualizationId} does not belong to experiment ${experimentId}`,
          );
          return failure(
            AppError.notFound(
              `Visualization with ID ${visualizationId} not found in this experiment`,
            ),
          );
        }

        this.logger.debug(
          `Retrieved visualization ${visualizationId} for experiment ${experimentId}`,
        );

        return success(visualization);
      },
    );
  }
}
