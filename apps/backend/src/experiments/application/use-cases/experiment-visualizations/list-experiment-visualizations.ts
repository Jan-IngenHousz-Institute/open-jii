import { Injectable, Logger } from "@nestjs/common";

import { Result, failure, AppError } from "../../../../common/utils/fp-utils";
import { ExperimentVisualizationDto } from "../../../core/models/experiment-visualization.model";
import { ExperimentDto } from "../../../core/models/experiment.model";
import { ExperimentVisualizationRepository } from "../../../core/repositories/experiment-visualization.repository";
import { ExperimentRepository } from "../../../core/repositories/experiment.repository";

@Injectable()
export class ListExperimentVisualizationsUseCase {
  private readonly logger = new Logger(ListExperimentVisualizationsUseCase.name);

  constructor(
    private readonly experimentRepository: ExperimentRepository,
    private readonly experimentVisualizationRepository: ExperimentVisualizationRepository,
  ) {}

  async execute(
    experimentId: string,
    userId: string,
  ): Promise<Result<ExperimentVisualizationDto[]>> {
    this.logger.log(`Listing visualizations of experiment ${experimentId} for user ${userId}`);

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
            `Attempt to list visualizations of non-existent experiment with ID ${experimentId}`,
          );
          return failure(AppError.notFound(`Experiment with ID ${experimentId} not found`));
        }

        if (!hasAccess && experiment.visibility !== "public") {
          this.logger.warn(
            `User ${userId} does not have access to experiment ${experimentId} visualizations`,
          );
          return failure(AppError.forbidden("You do not have access to this experiment"));
        }

        // Get the visualizations
        const visualizationsResult =
          await this.experimentVisualizationRepository.listVisualizations(experimentId);

        if (visualizationsResult.isFailure()) {
          this.logger.error(
            `Failed to retrieve visualizations for experiment ${experimentId}:`,
            visualizationsResult.error.message,
          );
          return failure(AppError.internal("Failed to retrieve experiment visualizations"));
        }

        this.logger.debug(
          `Retrieved ${visualizationsResult.value.length} visualizations for experiment ${experimentId}`,
        );
        return visualizationsResult;
      },
    );
  }
}
