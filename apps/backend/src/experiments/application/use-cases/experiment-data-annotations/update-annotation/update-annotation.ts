import { Injectable, Logger, Inject } from "@nestjs/common";

import {
  ExperimentAnnotationRowsAffected,
  ExperimentUpdateAnnotationBody,
} from "@repo/api/domains/experiment/data-annotations/experiment-data-annotations.schema";

import { AppError, failure, Result, success } from "../../../../../common/utils/fp-utils";
import { UpdateAnnotationDto } from "../../../../core/models/experiment-data-annotation.model";
import { DATABRICKS_PORT } from "../../../../core/ports/databricks.port";
import type { DatabricksPort } from "../../../../core/ports/databricks.port";
import { ExperimentDataAnnotationsRepository } from "../../../../core/repositories/experiment-data-annotations.repository";
import { ExperimentRepository } from "../../../../core/repositories/experiment.repository";

@Injectable()
export class UpdateAnnotationUseCase {
  private readonly logger = new Logger(UpdateAnnotationUseCase.name);

  constructor(
    private readonly experimentRepository: ExperimentRepository,
    private readonly experimentDataAnnotationsRepository: ExperimentDataAnnotationsRepository,
    @Inject(DATABRICKS_PORT) private readonly databricksPort: DatabricksPort,
  ) {}

  async execute(
    experimentId: string,
    annotationId: string,
    data: ExperimentUpdateAnnotationBody,
    userId: string,
  ): Promise<Result<ExperimentAnnotationRowsAffected>> {
    this.logger.log({
      msg: "Updating annotation to experiment data",
      operation: "updateAnnotation",
      experimentId,
      annotationId,
      userId,
    });

    // Validate that the user ID is provided
    if (!userId) {
      this.logger.warn({
        msg: "Attempt to update annotation for experiment without user ID",
        operation: "updateAnnotation",
        experimentId,
        annotationId,
      });
      return failure(
        AppError.badRequest("User ID is required to update annotation for experiment"),
      );
    }

    const experimentResult = await this.experimentRepository.findOne(experimentId);
    if (experimentResult.isFailure()) {
      return failure(experimentResult.error);
    }
    if (!experimentResult.value) {
      this.logger.warn({
        msg: "Experiment not found",
        operation: "updateAnnotation",
        experimentId,
      });
      return failure(AppError.notFound(`Experiment with ID ${experimentId} not found`));
    }

    // Experiment membership is enforced by @CanContributeToExperiment.
    const updateAnnotation: UpdateAnnotationDto = {};
    if ("text" in data.content) {
      updateAnnotation.contentText = data.content.text;
    }
    if ("flagType" in data.content) {
      updateAnnotation.flagType = data.content.flagType;
      updateAnnotation.contentText = data.content.text ?? null;
    }

    const result = await this.experimentDataAnnotationsRepository.updateAnnotation(
      experimentId,
      annotationId,
      updateAnnotation,
    );

    if (result.isFailure()) {
      return failure(AppError.internal(result.error.message));
    }

    return success(result.value);
  }
}
