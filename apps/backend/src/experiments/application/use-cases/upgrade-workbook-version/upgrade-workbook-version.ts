import { Injectable, Logger } from "@nestjs/common";

import { Result, failure, success, AppError } from "../../../../common/utils/fp-utils";
import { PublishVersionUseCase } from "../../../../workbooks/application/use-cases/publish-version/publish-version";
import type { ExperimentDto } from "../../../core/models/experiment.model";
import { ExperimentRepository } from "../../../core/repositories/experiment.repository";

export interface UpgradeWorkbookVersionResult {
  workbookId: string;
  workbookVersionId: string;
  version: number;
}

@Injectable()
export class UpgradeWorkbookVersionUseCase {
  private readonly logger = new Logger(UpgradeWorkbookVersionUseCase.name);

  constructor(
    private readonly experimentRepository: ExperimentRepository,
    private readonly publishVersionUseCase: PublishVersionUseCase,
  ) {}

  async execute(
    experimentId: string,
    userId: string,
  ): Promise<Result<UpgradeWorkbookVersionResult>> {
    const accessResult = await this.experimentRepository.checkAccess(experimentId, userId);

    return accessResult.chain(
      async ({ experiment, isAdmin }: { experiment: ExperimentDto | null; isAdmin: boolean }) => {
        if (!experiment) {
          return failure(AppError.notFound(`Experiment with ID ${experimentId} not found`));
        }

        if (!isAdmin) {
          return failure(AppError.forbidden("Only admins can upgrade workbook versions"));
        }

        if (!experiment.workbookId) {
          return failure(
            AppError.badRequest(
              "Experiment does not have an attached workbook. Attach a workbook first.",
            ),
          );
        }

        // Publish (or reuse) a version with the current workbook cells
        const versionResult = await this.publishVersionUseCase.execute(
          experiment.workbookId,
          userId,
        );

        if (versionResult.isFailure()) {
          return versionResult;
        }

        const version = versionResult.value;

        // Update experiment to point to the new version
        const updateResult = await this.experimentRepository.update(experimentId, {
          workbookVersionId: version.id,
        });

        if (updateResult.isFailure()) {
          return updateResult;
        }

        this.logger.log({
          msg: "Workbook version upgraded on experiment",
          operation: "upgradeWorkbookVersion",
          experimentId,
          workbookId: experiment.workbookId,
          workbookVersionId: version.id,
          version: version.version,
        });

        return success({
          workbookId: experiment.workbookId,
          workbookVersionId: version.id,
          version: version.version,
        });
      },
    );
  }
}
