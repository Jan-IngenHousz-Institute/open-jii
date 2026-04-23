import { Injectable, Logger } from "@nestjs/common";

import { Result, failure, success, AppError } from "../../../../common/utils/fp-utils";
import type { ExperimentDto } from "../../../core/models/experiment.model";
import { ExperimentRepository } from "../../../core/repositories/experiment.repository";

@Injectable()
export class DetachWorkbookUseCase {
  private readonly logger = new Logger(DetachWorkbookUseCase.name);

  constructor(private readonly experimentRepository: ExperimentRepository) {}

  async execute(experimentId: string, userId: string): Promise<Result<ExperimentDto>> {
    const accessResult = await this.experimentRepository.checkAccess(experimentId, userId);

    return accessResult.chain(
      async ({ experiment, isAdmin }: { experiment: ExperimentDto | null; isAdmin: boolean }) => {
        if (!experiment) {
          return failure(AppError.notFound(`Experiment with ID ${experimentId} not found`));
        }

        if (!isAdmin) {
          return failure(AppError.forbidden("Only admins can detach workbooks from experiments"));
        }

        if (!experiment.workbookId) {
          return failure(AppError.badRequest("Experiment does not have an attached workbook"));
        }

        // Clear workbookId but keep workbookVersionId for historical reference
        const updateResult = await this.experimentRepository.update(experimentId, {
          workbookId: null,
        });

        if (updateResult.isFailure()) {
          return updateResult;
        }

        this.logger.log({
          msg: "Workbook detached from experiment",
          operation: "detachWorkbook",
          experimentId,
          previousWorkbookId: experiment.workbookId,
        });

        return updateResult.chain((experiments: ExperimentDto[]) => {
          if (experiments.length === 0) {
            return failure(AppError.internal("Failed to detach workbook"));
          }
          return success(experiments[0]);
        });
      },
    );
  }
}
