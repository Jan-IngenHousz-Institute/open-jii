import { Injectable, Logger } from "@nestjs/common";

import { Result, failure, success, AppError } from "../../../../common/utils/fp-utils";
import type { ExperimentDto } from "../../../core/models/experiment.model";
import { ExperimentRepository } from "../../../core/repositories/experiment.repository";
import { FlowBindingRepository } from "../../../core/repositories/flow-binding.repository";

@Injectable()
export class DetachWorkbookUseCase {
  private readonly logger = new Logger(DetachWorkbookUseCase.name);

  constructor(
    private readonly experimentRepository: ExperimentRepository,
    private readonly flowBindingRepository: FlowBindingRepository,
  ) {}

  async execute(experimentId: string, userId: string): Promise<Result<ExperimentDto>> {
    const experimentResult = await this.experimentRepository.findOne(experimentId);

    return experimentResult.chain(async (experiment: ExperimentDto | null) => {
      if (!experiment) {
        return failure(AppError.notFound(`Experiment with ID ${experimentId} not found`));
      }

      if (!experiment.workbookId) {
        return failure(AppError.badRequest("Experiment does not have an attached workbook"));
      }

      // Clear workbookId (keep workbookVersionId for history) AND delete the
      // materialised flow row atomically, rejecting a concurrent change.
      const bindResult = await this.flowBindingRepository.bind({
        experimentId,
        expectedWorkbookId: experiment.workbookId,
        pointer: { workbookId: null },
        materialization: { kind: "none" },
      });
      if (bindResult.isFailure()) return bindResult;

      this.logger.log({
        msg: "Workbook detached from experiment",
        operation: "detachWorkbook",
        experimentId,
        userId,
        previousWorkbookId: experiment.workbookId,
      });

      return success(bindResult.value.experiment);
    });
  }
}
