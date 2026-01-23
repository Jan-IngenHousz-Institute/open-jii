import { Injectable, Logger } from "@nestjs/common";

import { ErrorCodes } from "../../../../common/utils/error-codes";
import { Result, failure, success, AppError } from "../../../../common/utils/fp-utils";
import { ExperimentVisualizationDto } from "../../../core/models/experiment-visualizations.model";
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
    this.logger.log({
      msg: "Getting visualization of experiment",
      operation: "getExperimentVisualization",
      experimentId,
      visualizationId,
      userId,
    });

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
          this.logger.warn({
            msg: "Attempt to get visualization of non-existent experiment",
            operation: "getExperimentVisualization",
            experimentId,
            visualizationId,
            userId,
          });
          return failure(AppError.notFound(`Experiment with ID ${experimentId} not found`));
        }

        if (!hasAccess && experiment.visibility !== "public") {
          this.logger.warn({
            msg: "User does not have access to experiment visualization",
            operation: "getExperimentVisualization",
            experimentId,
            visualizationId,
            userId,
          });
          return failure(AppError.forbidden("You do not have access to this experiment"));
        }

        // Get the specific visualization
        const visualizationResult =
          await this.experimentVisualizationRepository.findById(visualizationId);

        if (visualizationResult.isFailure()) {
          this.logger.error({
            msg: "Failed to retrieve visualization for experiment",
            errorCode: ErrorCodes.EXPERIMENT_VISUALIZATIONS_LIST_FAILED,
            operation: "getExperimentVisualization",
            experimentId,
            visualizationId,
            userId,
            error: visualizationResult.error.message,
          });
          return failure(AppError.internal("Failed to retrieve experiment visualization"));
        }

        const visualization = visualizationResult.value;

        if (!visualization) {
          this.logger.warn({
            msg: "Visualization not found",
            operation: "getExperimentVisualization",
            experimentId,
            visualizationId,
            userId,
          });
          return failure(AppError.notFound(`Visualization with ID ${visualizationId} not found`));
        }

        // Verify that the visualization belongs to the requested experiment
        if (visualization.experimentId !== experimentId) {
          this.logger.warn({
            msg: "Visualization does not belong to experiment",
            operation: "getExperimentVisualization",
            experimentId,
            visualizationId,
            userId,
          });
          return failure(
            AppError.notFound(
              `Visualization with ID ${visualizationId} not found in this experiment`,
            ),
          );
        }

        this.logger.debug({
          msg: "Retrieved visualization for experiment",
          operation: "getExperimentVisualization",
          experimentId,
          visualizationId,
          userId,
        });

        return success(visualization);
      },
    );
  }
}
