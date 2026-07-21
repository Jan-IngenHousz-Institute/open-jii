import { Injectable, Logger } from "@nestjs/common";

import { Result, success, failure, AppError } from "../../../../common/utils/fp-utils";
import type { FlowDto } from "../../../core/models/flow.model";
import { ExperimentRepository } from "../../../core/repositories/experiment.repository";
import { FlowRepository } from "../../../core/repositories/flow.repository";

@Injectable()
export class GetFlowUseCase {
  private readonly logger = new Logger(GetFlowUseCase.name);

  constructor(
    private readonly experimentRepository: ExperimentRepository,
    private readonly flowRepository: FlowRepository,
  ) {}

  async execute(experimentId: string, userId: string): Promise<Result<FlowDto>> {
    this.logger.log({
      msg: "Getting flow for experiment",
      operation: "getFlow",
      experimentId,
      userId,
    });

    const experimentResult = await this.experimentRepository.findOne(experimentId);
    if (experimentResult.isFailure()) {
      return failure(experimentResult.error);
    }
    if (!experimentResult.value) {
      return failure(AppError.notFound("Experiment not found"));
    }

    const flow = await this.flowRepository.getByExperimentId(experimentId);
    return flow.chain((value) => {
      if (!value) return failure(AppError.notFound("Flow not found"));
      return success(value);
    });
  }
}
