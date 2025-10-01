import { Injectable, Logger } from "@nestjs/common";

import { Result, failure, AppError } from "../../../../common/utils/fp-utils";
import type { ExperimentDto } from "../../../core/models/experiment.model";
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

    return access.chain(
      async ({
        experiment,
        hasAccess,
        isAdmin,
      }: {
        experiment: ExperimentDto | null;
        hasAccess: boolean;
        isAdmin: boolean;
      }) => {
        if (!experiment) return failure(AppError.notFound("Experiment not found"));

        // Check access permissions based on experiment status
        if (experiment.status === "archived") {
          // For archived experiments, only admins can update flows
          if (!isAdmin) {
            this.logger.warn(
              `User ${userId} is not an admin and cannot update flow for archived experiment ${experimentId}`,
            );
            return failure(
              AppError.forbidden("Only administrators can update flows for archived experiments"),
            );
          }
        } else {
          // For active experiments, any member can update flows
          if (!hasAccess) {
            return failure(AppError.forbidden("Only members can modify the flow"));
          }
        }

        const existing = await this.flowRepository.getByExperimentId(experimentId);
        return existing.chain(async (flow) => {
          if (!flow) {
            return failure(AppError.notFound("Flow not found"));
          }
          return this.flowRepository.update(experimentId, graph);
        });
      },
    );
  }
}
