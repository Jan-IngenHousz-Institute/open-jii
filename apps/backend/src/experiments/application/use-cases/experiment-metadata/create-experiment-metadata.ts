import { Injectable, Logger } from "@nestjs/common";
import { randomUUID } from "crypto";

import { ErrorCodes } from "../../../../common/utils/error-codes";
import { Result, failure, success, AppError } from "../../../../common/utils/fp-utils";
import type {
  ExperimentMetadataDto,
  CreateExperimentMetadataDto,
  MetadataSheetRecord,
} from "../../../core/models/experiment-metadata.model";
import type { ExperimentDto } from "../../../core/models/experiment.model";
import { ExperimentDataOutboxRepository } from "../../../core/repositories/experiment-data-outbox.repository";
import { ExperimentMetadataRepository } from "../../../core/repositories/experiment-metadata.repository";
import { ExperimentRepository } from "../../../core/repositories/experiment.repository";
import { ExperimentDataOutboxWorker } from "../../services/experiment-data-outbox.worker";

@Injectable()
export class CreateExperimentMetadataUseCase {
  private readonly logger = new Logger(CreateExperimentMetadataUseCase.name);

  constructor(
    private readonly experimentRepository: ExperimentRepository,
    private readonly metadataRepository: ExperimentMetadataRepository,
    private readonly outboxRepository: ExperimentDataOutboxRepository,
    private readonly outboxWorker: ExperimentDataOutboxWorker,
  ) {}

  async execute(
    experimentId: string,
    data: CreateExperimentMetadataDto,
    userId: string,
  ): Promise<Result<ExperimentMetadataDto>> {
    this.logger.log({
      msg: "Creating experiment metadata",
      operation: "createExperimentMetadata",
      experimentId,
      userId,
    });

    const experimentResult = await this.experimentRepository.findOne(experimentId);

    return experimentResult.chain(async (experiment: ExperimentDto | null) => {
      if (!experiment) {
        this.logger.warn({
          msg: "Experiment not found for metadata creation",
          errorCode: ErrorCodes.EXPERIMENT_NOT_FOUND,
          operation: "createExperimentMetadata",
          experimentId,
          userId,
        });
        return failure(AppError.notFound(`Experiment with ID ${experimentId} not found`));
      }

      // Authorization is enforced declaratively by @CanAccess on the route.
      // Archived-state handling remains here because it is a domain rule
      // describing which writes are legal, not who may write.
      if (experiment.status === "archived") {
        return failure(AppError.forbidden("Cannot modify an archived experiment"));
      }

      const now = new Date();
      const sheet: MetadataSheetRecord = {
        id: randomUUID(),
        experimentId,
        metadata: data.metadata,
        createdBy: userId,
        createdAt: now,
        updatedAt: now,
      };
      const written = await this.metadataRepository.transaction(async (tx) => {
        await this.metadataRepository.insert(tx, sheet);
        await this.outboxRepository.owe(tx, [
          { recordType: "metadata_sheet", recordId: sheet.id, experimentId },
        ]);
      });

      if (written.isFailure()) {
        this.logger.error({
          msg: "Failed to create experiment metadata",
          errorCode: ErrorCodes.EXPERIMENT_METADATA_CREATE_FAILED,
          operation: "createExperimentMetadata",
          experimentId,
          userId,
          error: written.error.message,
        });
        return failure(written.error);
      }

      this.logger.log({
        msg: "Experiment metadata created successfully",
        operation: "createExperimentMetadata",
        experimentId,
        metadataId: sheet.id,
        userId,
        status: "success",
      });
      this.outboxWorker.nudge();

      const { id, ...created } = sheet;
      return success({ ...created, metadataId: id });
    });
  }
}
