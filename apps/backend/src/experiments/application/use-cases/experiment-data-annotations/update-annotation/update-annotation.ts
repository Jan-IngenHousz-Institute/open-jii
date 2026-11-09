import { Injectable, Logger } from "@nestjs/common";

import {
  ExperimentAnnotationRowsAffected,
  ExperimentUpdateAnnotationBody,
} from "@repo/api/domains/experiment/data-annotations/experiment-data-annotations.schema";

import { AppError, failure, Result, success } from "../../../../../common/utils/fp-utils";
import { UpdateAnnotationDto } from "../../../../core/models/experiment-data-annotation.model";
import { ExperimentAnnotationsRepository } from "../../../../core/repositories/experiment-annotations.repository";
import { ExperimentDataOutboxRepository } from "../../../../core/repositories/experiment-data-outbox.repository";
import { ExperimentRepository } from "../../../../core/repositories/experiment.repository";
import { ExperimentDataOutboxWorker } from "../../../services/experiment-data-outbox.worker";

@Injectable()
export class UpdateAnnotationUseCase {
  private readonly logger = new Logger(UpdateAnnotationUseCase.name);

  constructor(
    private readonly experimentRepository: ExperimentRepository,
    private readonly annotationsRepository: ExperimentAnnotationsRepository,
    private readonly outboxRepository: ExperimentDataOutboxRepository,
    private readonly outboxWorker: ExperimentDataOutboxWorker,
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
    const written = await this.annotationsRepository.transaction(async (tx) => {
      const found = await this.annotationsRepository.update(
        tx,
        experimentId,
        annotationId,
        data.content.type,
        updateAnnotation,
        now,
      );
      if (found) {
        await this.outboxRepository.owe(tx, [
          { recordType: "annotation", recordId: annotationId, experimentId },
        ]);
      }
      return found;
    });
    if (written.isFailure()) {
      return failure(written.error);
    }

    this.outboxWorker.nudge();
    return success({ rowsAffected: written.value ? 1 : 0 });
  }
}
