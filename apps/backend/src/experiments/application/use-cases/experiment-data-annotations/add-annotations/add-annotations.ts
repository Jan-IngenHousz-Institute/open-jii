import { Injectable, Logger } from "@nestjs/common";
import { randomUUID } from "crypto";

import {
  ExperimentAddAnnotationsBulkBody,
  ExperimentAnnotationRowsAffected,
} from "@repo/api/domains/experiment/data-annotations/experiment-data-annotations.schema";

import type { Result } from "../../../../../common/utils/fp-utils";
import { success } from "../../../../../common/utils/fp-utils";
import { AppError, failure } from "../../../../../common/utils/fp-utils";
import { isFlagContent } from "../../../../core/models/experiment-data-annotation.model";
import type { AnnotationRecord } from "../../../../core/models/experiment-data-annotation.model";
import { ExperimentAnnotationsRepository } from "../../../../core/repositories/experiment-annotations.repository";
import { ExperimentDataOutboxRepository } from "../../../../core/repositories/experiment-data-outbox.repository";
import { ExperimentRepository } from "../../../../core/repositories/experiment.repository";
import { ExperimentDataOutboxWorker } from "../../../services/experiment-data-outbox.worker";

@Injectable()
export class AddAnnotationsUseCase {
  private readonly logger = new Logger(AddAnnotationsUseCase.name);

  constructor(
    private readonly experimentRepository: ExperimentRepository,
    private readonly annotationsRepository: ExperimentAnnotationsRepository,
    private readonly outboxRepository: ExperimentDataOutboxRepository,
    private readonly outboxWorker: ExperimentDataOutboxWorker,
  ) {}

  async execute(
    experimentId: string,
    data: ExperimentAddAnnotationsBulkBody,
    userId: string,
  ): Promise<Result<ExperimentAnnotationRowsAffected>> {
    this.logger.log({
      msg: "Adding annotation(s) to experiment data",
      operation: "addAnnotations",
      experimentId,
      userId,
    });

    // Validate that the user ID is provided
    if (!userId) {
      this.logger.warn({
        msg: "Attempt to add annotation(s) to experiment without user ID",
        operation: "addAnnotations",
        experimentId,
      });
      return failure(
        AppError.badRequest("User ID is required to add annotation(s) to an experiment"),
      );
    }

    const experimentResult = await this.experimentRepository.findOne(experimentId);
    if (experimentResult.isFailure()) {
      return failure(experimentResult.error);
    }
    if (!experimentResult.value) {
      this.logger.warn({
        msg: "Experiment not found",
        operation: "addAnnotations",
        experimentId,
      });
      return failure(AppError.notFound(`Experiment with ID ${experimentId} not found`));
    }

    // The right to contribute here is enforced by @CanAccess.
    const now = new Date();
    const records = data.rowIds.map(
      (rowId): AnnotationRecord => ({
        id: randomUUID(),
        experimentId,
        tableName: data.tableName,
        rowId,
        type: data.annotation.type,
        contentText: data.annotation.content.text ?? null,
        flagType: isFlagContent(data.annotation.content) ? data.annotation.content.flagType : null,
        createdBy: userId,
        createdAt: now,
        updatedAt: now,
      }),
    );

    const written = await this.annotationsRepository.transaction(async (tx) => {
      await this.annotationsRepository.insert(tx, records);
      await this.outboxRepository.owe(
        tx,
        records.map((record) => ({ recordType: "annotation", recordId: record.id, experimentId })),
      );
    });
    if (written.isFailure()) {
      return failure(written.error);
    }

    this.outboxWorker.nudge();
    return success({ rowsAffected: records.length });
  }
}
