import { Injectable, Logger, Inject } from "@nestjs/common";

import { ExperimentAnnotationRowsAffected } from "@repo/api/domains/experiment/data-annotations/experiment-data-annotations.schema";

import { AppError, failure, Result, success } from "../../../../../common/utils/fp-utils";
import { DeleteAnnotationsRequest } from "../../../../core/models/experiment-data-annotation.model";
import { DATABRICKS_PORT } from "../../../../core/ports/databricks.port";
import type { DatabricksPort } from "../../../../core/ports/databricks.port";
import { ExperimentDataAnnotationsRepository } from "../../../../core/repositories/experiment-data-annotations.repository";
import { ExperimentRepository } from "../../../../core/repositories/experiment.repository";

@Injectable()
export class DeleteAnnotationsUseCase {
  private readonly logger = new Logger(DeleteAnnotationsUseCase.name);

  constructor(
    private readonly experimentRepository: ExperimentRepository,
    private readonly experimentDataAnnotationsRepository: ExperimentDataAnnotationsRepository,
    @Inject(DATABRICKS_PORT) private readonly databricksPort: DatabricksPort,
  ) {}

  async execute(
    experimentId: string,
    request: DeleteAnnotationsRequest,
    userId: string,
  ): Promise<Result<ExperimentAnnotationRowsAffected>> {
    this.logger.log({
      msg: "Deleting annotation(s) from experiment data",
      operation: "deleteAnnotations",
      experimentId,
      userId,
    });

    // Validate that the user ID is provided
    if (!userId) {
      this.logger.warn({
        msg: "Attempt to delete annotation(s) for experiment without user ID",
        operation: "deleteAnnotations",
        experimentId,
      });
      return failure(
        AppError.badRequest("User ID is required to delete annotation(s) for an experiment"),
      );
    }

    const experimentResult = await this.experimentRepository.findOne(experimentId);
    if (experimentResult.isFailure()) {
      return failure(experimentResult.error);
    }
    if (!experimentResult.value) {
      this.logger.warn({
        msg: "Experiment not found",
        operation: "deleteAnnotations",
        experimentId,
      });
      return failure(AppError.notFound(`Experiment with ID ${experimentId} not found`));
    }

    // Experiment membership is enforced by @CanContributeToExperiment.
    if ("annotationId" in request) {
      const result = await this.experimentDataAnnotationsRepository.deleteAnnotation(
        experimentId,
        request.annotationId,
      );

      if (result.isFailure()) {
        return failure(AppError.internal(result.error.message));
      }

      return success(result.value);
    }

    const result = await this.experimentDataAnnotationsRepository.deleteAnnotationsBulk(
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
}
