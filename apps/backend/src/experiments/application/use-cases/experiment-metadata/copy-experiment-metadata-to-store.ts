import { Inject, Injectable, Logger } from "@nestjs/common";

import { Result, failure, success, AppError } from "../../../../common/utils/fp-utils";
import { SERVING_STORE_COPIES_PORT } from "../../../core/ports/serving-store-copies.port";
import type { ServingStoreCopiesPort } from "../../../core/ports/serving-store-copies.port";
import { ExperimentDataOutboxRepository } from "../../../core/repositories/experiment-data-outbox.repository";
import { ExperimentMetadataRepository } from "../../../core/repositories/experiment-metadata.repository";
import { ExperimentDataOutboxWorker } from "../../services/experiment-data-outbox.worker";

/** Asks for a sheet's rows to be copied to the serving store again, at once, as after a failure. */
@Injectable()
export class CopyExperimentMetadataToStoreUseCase {
  private readonly logger = new Logger(CopyExperimentMetadataToStoreUseCase.name);

  constructor(
    private readonly metadataRepository: ExperimentMetadataRepository,
    private readonly outbox: ExperimentDataOutboxRepository,
    private readonly outboxWorker: ExperimentDataOutboxWorker,
    @Inject(SERVING_STORE_COPIES_PORT) private readonly storeCopies: ServingStoreCopiesPort,
  ) {}

  async execute(experimentId: string, metadataId: string, userId: string): Promise<Result<void>> {
    if (!this.storeCopies.isConfigured()) {
      return failure(
        AppError.badRequest(
          "This environment has no serving store to copy the sheet to",
          "STORE_NOT_CONFIGURED",
        ),
      );
    }

    const found = await this.metadataRepository.findByIds([metadataId]);
    if (found.isFailure()) {
      return found;
    }
    const isThisExperimentsSheet = found.value.some((sheet) => sheet.experimentId === experimentId);
    if (!isThisExperimentsSheet) {
      return failure(AppError.notFound(`Metadata sheet ${metadataId} not found`));
    }

    const owed = await this.outbox.oweAgain(
      { recordType: "metadata_sheet", recordId: metadataId, experimentId },
      "serving_store",
    );
    if (owed.isFailure()) {
      return owed;
    }

    this.logger.log({
      msg: "Owed a metadata sheet's copy to the serving store again",
      operation: "copyExperimentMetadataToStore",
      experimentId,
      metadataId,
      userId,
    });
    this.outboxWorker.nudge();
    return success(undefined);
  }
}
