import { Inject, Injectable, Logger } from "@nestjs/common";

import type { MetadataStoreCopy } from "@repo/api/domains/experiment/metadata/experiment-metadata.schema";

import { ErrorCodes } from "../../../../common/utils/error-codes";
import { Result, failure, success, AppError } from "../../../../common/utils/fp-utils";
import { COPY_FAILED_AFTER_ATTEMPTS } from "../../../core/models/experiment-data-outbox.model";
import type { ExperimentDataSource } from "../../../core/models/experiment-data.model";
import type { ExperimentMetadataDto } from "../../../core/models/experiment-metadata.model";
import { SERVING_STORE_COPIES_PORT } from "../../../core/ports/serving-store-copies.port";
import type { ServingStoreCopiesPort } from "../../../core/ports/serving-store-copies.port";
import { ExperimentDataOutboxRepository } from "../../../core/repositories/experiment-data-outbox.repository";
import { ExperimentMetadataRepository } from "../../../core/repositories/experiment-metadata.repository";
import { ExperimentRepository } from "../../../core/repositories/experiment.repository";

@Injectable()
export class GetExperimentMetadataUseCase {
  private readonly logger = new Logger(GetExperimentMetadataUseCase.name);

  constructor(
    private readonly experimentRepository: ExperimentRepository,
    private readonly metadataRepository: ExperimentMetadataRepository,
    private readonly outbox: ExperimentDataOutboxRepository,
    @Inject(SERVING_STORE_COPIES_PORT) private readonly storeCopies: ServingStoreCopiesPort,
  ) {}

  /** `source` is where the user's data reads come from; only a store reader is told the store's state. */
  async execute(
    experimentId: string,
    userId: string,
    source: ExperimentDataSource,
  ): Promise<Result<ExperimentMetadataDto[]>> {
    this.logger.log({
      msg: "Fetching experiment metadata",
      operation: "getExperimentMetadata",
      experimentId,
      userId,
    });

    const experimentResult = await this.experimentRepository.findOne(experimentId);
    if (experimentResult.isFailure()) {
      return failure(experimentResult.error);
    }
    if (!experimentResult.value) {
      this.logger.warn({
        msg: "Experiment not found for metadata fetch",
        errorCode: ErrorCodes.EXPERIMENT_NOT_FOUND,
        operation: "getExperimentMetadata",
        experimentId,
        userId,
      });
      return failure(AppError.notFound(`Experiment with ID ${experimentId} not found`));
    }

    // Postgres takes every write first, so the list shows a save as soon as it returns.
    const result = await this.metadataRepository.findByExperimentId(experimentId);

    if (result.isFailure()) {
      this.logger.error({
        msg: "Failed to fetch experiment metadata",
        errorCode: ErrorCodes.EXPERIMENT_METADATA_FETCH_FAILED,
        operation: "getExperimentMetadata",
        experimentId,
        userId,
        error: result.error.message,
      });
      return result;
    }

    const attempts = await this.storeAttempts(experimentId, source);
    if (attempts.isFailure()) {
      return attempts;
    }

    return success(
      result.value.map(({ id, ...sheet }) => ({
        ...sheet,
        metadataId: id,
        storeCopy: this.storeCopyOf(attempts.value, id),
      })),
    );
  }

  /**
   * Each sheet still owed to the store, with its failed attempts. Null where there is no copier, or
   * for a user whose pages read the warehouse, whom the store's state does not concern.
   */
  private async storeAttempts(
    experimentId: string,
    source: ExperimentDataSource,
  ): Promise<Result<Map<string, number> | null>> {
    const readsTheStore = source === "store" && this.storeCopies.isConfigured();
    if (!readsTheStore) {
      return success(null);
    }
    return this.outbox.findAttempts(experimentId, "metadata_sheet", "serving_store");
  }

  private storeCopyOf(
    attempts: Map<string, number> | null,
    sheetId: string,
  ): MetadataStoreCopy | null {
    if (attempts === null) {
      return null;
    }
    const failedAttempts = attempts.get(sheetId);
    if (failedAttempts === undefined) {
      return "loaded";
    }
    return failedAttempts >= COPY_FAILED_AFTER_ATTEMPTS ? "failed" : "pending";
  }
}
