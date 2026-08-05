import { Injectable, Logger } from "@nestjs/common";

import { Result, failure, success, AppError } from "../../../../common/utils/fp-utils";
import type { ExperimentDto } from "../../../core/models/experiment.model";
import { ExperimentRepository } from "../../../core/repositories/experiment.repository";

@Injectable()
export class DetachWorkbookUseCase {
  private readonly logger = new Logger(DetachWorkbookUseCase.name);

  constructor(private readonly experimentRepository: ExperimentRepository) {}

  async execute(
    experimentId: string,
    expectedWorkbookId: string,
    expectedWorkbookVersionId: string,
    userId: string,
  ): Promise<Result<ExperimentDto>> {
    const experimentResult = await this.experimentRepository.findOne(experimentId);

    return experimentResult.chain(async (experiment: ExperimentDto | null) => {
      if (!experiment) {
        return failure(AppError.notFound(`Experiment with ID ${experimentId} not found`));
      }

      if (!experiment.workbookId) {
        return failure(AppError.badRequest("Experiment does not have an attached workbook"));
      }
      if (
        experiment.workbookId !== expectedWorkbookId ||
        experiment.workbookVersionId !== expectedWorkbookVersionId
      ) {
        return failure(
          AppError.conflict(
            "The experiment's linked workbook changed. Refresh and try again.",
            "WORKBOOK_SCOPE_CHANGED",
          ),
        );
      }

      // Clear workbookId but keep workbookVersionId for historical reference
      const updateResult = await this.experimentRepository.updateWorkbookAndFlowIfExpected(
        experimentId,
        { workbookId: expectedWorkbookId, workbookVersionId: expectedWorkbookVersionId },
        { workbookId: null },
        null,
      );

      if (updateResult.isFailure()) {
        return updateResult;
      }

      if (!updateResult.value) {
        return failure(
          AppError.conflict(
            "The experiment's linked workbook changed. Refresh and try again.",
            "WORKBOOK_SCOPE_CHANGED",
          ),
        );
      }

      this.logger.log({
        msg: "Workbook detached from experiment",
        operation: "detachWorkbook",
        experimentId,
        userId,
        previousWorkbookId: experiment.workbookId,
      });

      return success(updateResult.value);
    });
  }
}
