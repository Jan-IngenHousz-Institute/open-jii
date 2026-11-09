import { Injectable, Logger } from "@nestjs/common";

import { ExperimentAnnotationRowsAffected } from "@repo/api/domains/experiment/data-annotations/experiment-data-annotations.schema";

import { AppError, failure, Result, success } from "../../../../../common/utils/fp-utils";
import { DeleteAnnotationsRequest } from "../../../../core/models/experiment-data-annotation.model";
import { ExperimentAnnotationsRepository } from "../../../../core/repositories/experiment-annotations.repository";
import { ExperimentDataOutboxRepository } from "../../../../core/repositories/experiment-data-outbox.repository";
import { ExperimentRepository } from "../../../../core/repositories/experiment.repository";
import { ExperimentDataOutboxWorker } from "../../../services/experiment-data-outbox.worker";

@Injectable()
export class DeleteAnnotationsUseCase {
  private readonly logger = new Logger(DeleteAnnotationsUseCase.name);

  constructor(
    private readonly experimentRepository: ExperimentRepository,
    private readonly annotationsRepository: ExperimentAnnotationsRepository,
    private readonly outboxRepository: ExperimentDataOutboxRepository,
    private readonly outboxWorker: ExperimentDataOutboxWorker,
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

    // The right to contribute here is enforced by @CanAccess.
    const written = await this.annotationsRepository.transaction(async (tx) => {
      const deleted =
        "annotationId" in request
          ? await this.annotationsRepository.delete(tx, experimentId, request.annotationId)
          : await this.annotationsRepository.deleteFromRows(
              tx,
              experimentId,
              request.tableName,
              request.rowIds,
              request.type,
            );
      await this.outboxRepository.owe(
        tx,
        deleted.map((recordId) => ({ recordType: "annotation", recordId, experimentId })),
      );
      return deleted.length;
    });
    if (written.isFailure()) {
      return failure(written.error);
    }

    this.outboxWorker.nudge();
    return success({ rowsAffected: written.value });
  }
}
