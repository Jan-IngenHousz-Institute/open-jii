import { Injectable, Logger, Inject } from "@nestjs/common";

import {
  ExperimentAnnotationRowsAffected,
  ExperimentUpdateAnnotationBody,
} from "@repo/api/domains/experiment/data-annotations/experiment-data-annotations.schema";

import { AppError, failure, Result, success } from "../../../../../common/utils/fp-utils";
import { UpdateAnnotationDto } from "../../../../core/models/experiment-data-annotation.model";
import { DATABRICKS_PORT } from "../../../../core/ports/databricks.port";
import type { DatabricksPort } from "../../../../core/ports/databricks.port";
import { ExperimentAnnotationsWarehouseRepository } from "../../../../core/repositories/experiment-annotations-warehouse.repository";
import { ExperimentAnnotationsRepository } from "../../../../core/repositories/experiment-annotations.repository";
import { ExperimentRepository } from "../../../../core/repositories/experiment.repository";

@Injectable()
export class UpdateAnnotationUseCase {
  private readonly logger = new Logger(UpdateAnnotationUseCase.name);

  constructor(
    private readonly experimentRepository: ExperimentRepository,
    private readonly annotationsWarehouseRepository: ExperimentAnnotationsWarehouseRepository,
    private readonly annotationsRepository: ExperimentAnnotationsRepository,
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

    // The right to contribute here is enforced by @CanAccess.
    const updateAnnotation: UpdateAnnotationDto = {};
    if ("text" in data.content) {
      updateAnnotation.contentText = data.content.text;
    }
    if ("flagType" in data.content) {
      updateAnnotation.flagType = data.content.flagType;
      updateAnnotation.contentText = data.content.text ?? null;
    }

    const now = new Date();
    const result = await this.annotationsWarehouseRepository.updateAnnotation(
      experimentId,
      annotationId,
      updateAnnotation,
      now,
    );

    if (result.isFailure()) {
      return failure(AppError.internal(result.error.message));
    }

    // Postgres follows the lakehouse until pages read it, and the annotations-move runbook fills in
    // what a failed copy missed.
    const copied = await this.annotationsRepository.update(
      experimentId,
      annotationId,
      updateAnnotation,
      now,
    );
    if (copied.isFailure()) {
      this.logger.warn({
        msg: "Annotation update not copied to Postgres",
        operation: "updateAnnotation",
        experimentId,
        annotationId,
        error: copied.error.message,
      });
    }

    return success(result.value);
  }
}
