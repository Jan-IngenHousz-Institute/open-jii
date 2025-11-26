import { Injectable, Logger } from "@nestjs/common";

import { AnnotationRowsAffected, UpdateAnnotationBody } from "@repo/api";

import { AppError, failure, Result, success } from "../../../../../common/utils/fp-utils";
import { UpdateAnnotationDto } from "../../../../core/models/experiment-data-annotation.model";
import type { ExperimentDto } from "../../../../core/models/experiment.model";
import { ExperimentDataAnnotationsRepository } from "../../../../core/repositories/experiment-data-annotations.repository";
import { ExperimentRepository } from "../../../../core/repositories/experiment.repository";

@Injectable()
export class UpdateAnnotationUseCase {
  private readonly logger = new Logger(UpdateAnnotationUseCase.name);

  constructor(
    private readonly experimentRepository: ExperimentRepository,
    private readonly experimentDataAnnotationsRepository: ExperimentDataAnnotationsRepository,
  ) {}

  async execute(
    experimentId: string,
    annotationId: string,
    data: UpdateAnnotationBody,
    userId: string,
  ): Promise<Result<AnnotationRowsAffected>> {
    this.logger.log(`Updating annotation to experiment data for user ${userId}`);

    // Validate that the user ID is provided
    if (!userId) {
      this.logger.warn("Attempt to update annotation for experiment without user ID");
      return failure(
        AppError.badRequest("User ID is required to update annotation for experiment"),
      );
    }

    // Check if experiment exists and user has access
    const accessResult = await this.experimentRepository.checkAccess(experimentId, userId);

    return accessResult.chain(
      async ({
        hasAccess,
        experiment,
      }: {
        hasAccess: boolean;
        experiment: ExperimentDto | null;
      }) => {
        if (!experiment) {
          this.logger.warn(`Experiment with ID ${experimentId} not found`);
          return failure(AppError.notFound(`Experiment with ID ${experimentId} not found`));
        }
        if (!hasAccess && experiment.visibility !== "public") {
          this.logger.warn(
            `User ${userId} attempted to access data of experiment ${experimentId} without proper permissions`,
          );
          return failure(AppError.forbidden("You do not have access to this experiment"));
        }

        const updateAnnotation: UpdateAnnotationDto = {};
        if ("text" in data.content) {
          updateAnnotation.contentText = data.content.text;
        }
        if ("flagType" in data.content) {
          updateAnnotation.flagType = data.content.flagType;
          updateAnnotation.contentText = data.content.reason;
        }

        const result = await this.experimentDataAnnotationsRepository.updateAnnotation(
          experiment.name,
          experimentId,
          annotationId,
          updateAnnotation,
        );

        if (result.isFailure()) {
          return failure(AppError.internal(result.error.message));
        }

        return success(result.value);
      },
    );
  }
}
