import { Injectable, Logger } from "@nestjs/common";

import { ErrorCodes } from "../../../../common/utils/error-codes";
import { Result, failure, success, AppError } from "../../../../common/utils/fp-utils";
import { ExperimentVisualizationDto } from "../../../core/models/experiment-visualizations.model";
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

    const experimentResult = await this.experimentRepository.findOne(experimentId);
    if (experimentResult.isFailure()) {
      return failure(experimentResult.error);
    }
    if (!experimentResult.value) {
      this.logger.warn({
        msg: "Attempt to get visualization of non-existent experiment",
        errorCode: ErrorCodes.EXPERIMENT_NOT_FOUND,
        operation: "getExperimentVisualization",
        experimentId,
        visualizationId,
        userId,
      });
      return failure(AppError.notFound(`Experiment with ID ${experimentId} not found`));
    }

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

    if (visualization.experimentId !== experimentId) {
      this.logger.warn({
        msg: "Visualization does not belong to experiment",
        operation: "getExperimentVisualization",
        experimentId,
        visualizationId,
        userId,
      });
      return failure(
        AppError.notFound(`Visualization with ID ${visualizationId} not found in this experiment`),
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
  }
}
