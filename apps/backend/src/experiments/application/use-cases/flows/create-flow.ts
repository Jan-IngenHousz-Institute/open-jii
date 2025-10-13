import { Injectable, Logger } from "@nestjs/common";

import { Result, failure, AppError } from "../../../../common/utils/fp-utils";
import type { ExperimentDto } from "../../../core/models/experiment.model";
import type { FlowDto, FlowGraphDto } from "../../../core/models/flow.model";
import { ExperimentRepository } from "../../../core/repositories/experiment.repository";
import { FlowRepository } from "../../../core/repositories/flow.repository";

@Injectable()
export class CreateFlowUseCase {
  private readonly logger = new Logger(CreateFlowUseCase.name);

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

    return access.chain(
      async ({
        experiment,
        hasArchiveAccess,
      }: {
        experiment: ExperimentDto | null;
        hasArchiveAccess: boolean;
      }) => {
        if (!experiment) return failure(AppError.notFound("Experiment not found"));

        if (!hasArchiveAccess) {
          return failure(AppError.forbidden("You do not have access to this experiment"));
        }

        // Ensure there isn't an existing flow
        const existing = await this.flowRepository.getByExperimentId(experimentId);
        return existing.chain(async (flow) => {
          if (flow) {
            return failure(AppError.badRequest("Flow already exists for this experiment"));
          }
          return this.flowRepository.create(experimentId, graph);
        });
      },
    );
  }
}
