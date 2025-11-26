import { Injectable, Logger } from "@nestjs/common";

import { AnnotationRowsAffected } from "@repo/api";

import { AppError, failure, Result, success } from "../../../../../common/utils/fp-utils";
import { DeleteAnnotationsRequest } from "../../../../core/models/experiment-data-annotation.model";
import type { ExperimentDto } from "../../../../core/models/experiment.model";
import { ExperimentDataAnnotationsRepository } from "../../../../core/repositories/experiment-data-annotations.repository";
import { ExperimentRepository } from "../../../../core/repositories/experiment.repository";

@Injectable()
export class DeleteAnnotationsUseCase {
  private readonly logger = new Logger(DeleteAnnotationsUseCase.name);

  constructor(
    private readonly experimentRepository: ExperimentRepository,
    private readonly experimentDataAnnotationsRepository: ExperimentDataAnnotationsRepository,
  ) {}

  async execute(
    experimentId: string,
    request: DeleteAnnotationsRequest,
    userId: string,
  ): Promise<Result<AnnotationRowsAffected>> {
    this.logger.log(`Deleting annotation(s) from experiment data for user ${userId}`);

    // Validate that the user ID is provided
    if (!userId) {
      this.logger.warn("Attempt to delete annotation(s) for experiment without user ID");
      return failure(
        AppError.badRequest("User ID is required to delete annotation(s) for an experiment"),
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

        if ("annotationId" in request) {
          const result = await this.experimentDataAnnotationsRepository.deleteAnnotation(
            experiment.name,
            experimentId,
            request.annotationId,
          );

          if (result.isFailure()) {
            return failure(AppError.internal(result.error.message));
          }

          return success(result.value);
        } else {
          const result = await this.experimentDataAnnotationsRepository.deleteAnnotationsBulk(
            experiment.name,
            experimentId,
            request.tableName,
            request.rowIds,
            request.type,
          );

          if (result.isFailure()) {
            return failure(AppError.internal(result.error.message));
          }

          return success(result.value);
        }
      },
    );
  }
}
