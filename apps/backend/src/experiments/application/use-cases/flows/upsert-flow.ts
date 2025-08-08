import { Injectable, Logger } from "@nestjs/common";

import { Result, failure, AppError, validate } from "../../../../common/utils/fp-utils";
import { flowGraphSchema } from "../../../core/models/flow.model";
import type { FlowDto, FlowGraphDto } from "../../../core/models/flow.model";
import { ExperimentRepository } from "../../../core/repositories/experiment.repository";
import { FlowRepository } from "../../../core/repositories/flow.repository";

@Injectable()
export class UpsertFlowUseCase {
  private readonly logger = new Logger(UpsertFlowUseCase.name);

  constructor(
    private readonly experimentRepository: ExperimentRepository,
    private readonly flowRepository: FlowRepository,
  ) {}

  async execute(
    experimentId: string,
    userId: string,
    graph: FlowGraphDto,
  ): Promise<Result<FlowDto>> {
    // Validate input
    const validated = validate(flowGraphSchema, graph);
    if (validated.isFailure()) return validated;

    // Check access and admin rights
    const access = await this.experimentRepository.checkAccess(experimentId, userId);

    return access.chain(async ({ experiment, isAdmin }) => {
      if (!experiment) return failure(AppError.notFound("Experiment not found"));
      if (!isAdmin) return failure(AppError.forbidden("Only admins can modify the flow"));

      return this.flowRepository.upsert(experimentId, validated.value);
    });
  }
}
