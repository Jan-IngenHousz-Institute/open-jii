import { Injectable, Logger } from "@nestjs/common";

import { Result, failure, AppError } from "../../../../common/utils/fp-utils";
import type { FlowDto, FlowGraphDto } from "../../../core/models/flow.model";
import { ExperimentRepository } from "../../../core/repositories/experiment.repository";
import { FlowRepository } from "../../../core/repositories/flow.repository";

@Injectable()
export class UpdateFlowUseCase {
  private readonly logger = new Logger(UpdateFlowUseCase.name);

  constructor(
    private readonly experimentRepository: ExperimentRepository,
    private readonly flowRepository: FlowRepository,
  ) {}

  async execute(
    experimentId: string,
    userId: string,
    graph: FlowGraphDto,
  ): Promise<Result<FlowDto>> {
    const access = await this.experimentRepository.checkAccess(experimentId, userId);

    return access.chain(async ({ experiment, isAdmin }) => {
      if (!experiment) return failure(AppError.notFound("Experiment not found"));
      if (!isAdmin) return failure(AppError.forbidden("Only admins can modify the flow"));

      const existing = await this.flowRepository.getByExperimentId(experimentId);
      return existing.chain(async (flow) => {
        if (!flow) {
          return failure(AppError.notFound("Flow not found"));
        }
        return this.flowRepository.update(experimentId, graph);
      });
    });
  }
}
