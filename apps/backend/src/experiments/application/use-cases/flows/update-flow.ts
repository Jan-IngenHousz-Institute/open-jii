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
    const experimentResult = await this.experimentRepository.findOne(experimentId);

    return experimentResult.chain(async (experiment: ExperimentDto | null) => {
      if (!experiment) return failure(AppError.notFound("Experiment not found"));

      // Authorization is enforced declaratively by @CanAccess on the route.
      // Archived experiments are read-only — a domain rule describing which
      // operations are legal, not who may perform them.
      if (experiment.status === "archived") {
        return failure(AppError.forbidden("Cannot modify an archived experiment"));
      }

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
