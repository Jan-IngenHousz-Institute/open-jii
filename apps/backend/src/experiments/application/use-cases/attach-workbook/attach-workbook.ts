import { Injectable, Logger } from "@nestjs/common";

import { Result, failure, success, AppError } from "../../../../common/utils/fp-utils";
import { PublishVersionUseCase } from "../../../../workbooks/application/use-cases/publish-version/publish-version";
import type { ExperimentDto } from "../../../core/models/experiment.model";
import { ExperimentRepository } from "../../../core/repositories/experiment.repository";

export interface AttachWorkbookResult {
  workbookId: string;
  workbookVersionId: string;
  version: number;
}

@Injectable()
export class AttachWorkbookUseCase {
  private readonly logger = new Logger(AttachWorkbookUseCase.name);

  constructor(
    private readonly experimentRepository: ExperimentRepository,
    private readonly publishVersionUseCase: PublishVersionUseCase,
  ) {}

  async execute(
    experimentId: string,
    workbookId: string,
    userId: string,
  ): Promise<Result<AttachWorkbookResult>> {
    // Check experiment access
    const accessResult = await this.experimentRepository.checkAccess(experimentId, userId);

    return accessResult.chain(
      async ({ experiment, isAdmin }: { experiment: ExperimentDto | null; isAdmin: boolean }) => {
        if (!experiment) {
          return failure(AppError.notFound(`Experiment with ID ${experimentId} not found`));
        }

        if (!isAdmin) {
          return failure(AppError.forbidden("Only admins can attach workbooks to experiments"));
        }

        // Publish (or reuse) a version for the workbook
        const versionResult = await this.publishVersionUseCase.execute(workbookId, userId);

        if (versionResult.isFailure()) {
          return versionResult;
        }

        const version = versionResult.value;

        // Update experiment with both workbookId and workbookVersionId
        const updateResult = await this.experimentRepository.update(experimentId, {
          workbookId,
          workbookVersionId: version.id,
        });

        if (updateResult.isFailure()) {
          return updateResult;
        }

        this.logger.log({
          msg: "Workbook attached to experiment",
          operation: "attachWorkbook",
          experimentId,
          workbookId,
          workbookVersionId: version.id,
          version: version.version,
        });

        return success({
          workbookId,
          workbookVersionId: version.id,
          version: version.version,
        });
      },
    );
  }
}
