import { Injectable, Logger } from "@nestjs/common";

import { Result, AppError, failure, success } from "../../../../../common/utils/fp-utils";
import { FlowWithGraphDto } from "../../../core/models/flow.model";
import { FlowRepository } from "../../../core/repositories/flow.repository";

export class GetFlowByExperimentError extends AppError {
  constructor(message: string, cause?: unknown) {
    super(message, "GET_FLOW_BY_EXPERIMENT_ERROR", 404, { cause });
  }
}

@Injectable()
export class GetFlowByExperimentUseCase {
  private readonly logger = new Logger(GetFlowByExperimentUseCase.name);

  constructor(private readonly flowRepository: FlowRepository) {}

  async execute(experimentId: string): Promise<Result<FlowWithGraphDto>> {
    this.logger.log(`Getting flow with steps and connections for experiment ID ${experimentId}`);

    // Get the flow with steps and connections by experiment ID
    const flowResult = await this.flowRepository.findByExperimentId(experimentId);

    return flowResult.chain((flow: FlowWithGraphDto | null) => {
      if (!flow) {
        this.logger.warn(`No flow found for experiment ID ${experimentId}`);
        return failure(
          new GetFlowByExperimentError(`No flow found for experiment ID ${experimentId}`),
        );
      }

      this.logger.log(
        `Found flow "${String(flow.name)}" with ${flow.steps.length} steps and ${flow.connections.length} connections`,
      );

      return success(flow);
    });
  }
}
