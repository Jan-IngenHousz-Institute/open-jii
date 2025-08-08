import { Injectable, Logger } from "@nestjs/common";

import { Result, success, failure, AppError } from "../../../../common/utils/fp-utils";
import type { ExperimentDto } from "../../../core/models/experiment.model";
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
    // Check access to experiment
    const access = await this.experimentRepository.checkAccess(experimentId, userId);

    return access.chain(
      async ({
        experiment,
        hasAccess,
      }: {
        experiment: ExperimentDto | null;
        hasAccess: boolean;
      }) => {
        // Narrow experiment type at runtime before property access
        if (!experiment) return failure(AppError.notFound("Experiment not found"));
        if (!hasAccess && experiment.visibility !== "public")
          return failure(AppError.forbidden("You do not have access to this experiment"));

        const flow = await this.flowRepository.getByExperimentId(experimentId);
        return flow.chain((f) => {
          if (!f) return failure(AppError.notFound("Flow not found"));
          return success(f);
        });
      },
    );
  }
}
