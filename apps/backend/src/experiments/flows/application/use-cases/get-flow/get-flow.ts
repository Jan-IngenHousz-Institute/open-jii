import { Injectable, Logger } from "@nestjs/common";

import { Result, AppError, failure, success } from "../../../../../common/utils/fp-utils";
import { FlowWithStepsDto } from "../../../core/models/flow.model";
import {
  FlowStepRepository,
  FlowStepRepositoryError,
} from "../../../core/repositories/flow-step.repository";
import { FlowRepository, FlowRepositoryError } from "../../../core/repositories/flow.repository";

export class GetFlowError extends AppError {
  constructor(message: string, cause?: unknown) {
    super(message, "GET_FLOW_ERROR", 404, { cause });
  }
}

@Injectable()
export class GetFlowUseCase {
  private readonly logger = new Logger(GetFlowUseCase.name);

  constructor(
    private readonly flowRepository: FlowRepository,
    private readonly flowStepRepository: FlowStepRepository,
  ) {}

  async execute(flowId: string): Promise<Result<FlowWithStepsDto>> {
    this.logger.log(`Getting flow with ID ${flowId}`);

    // Get the flow
    const flowResult = await this.flowRepository.findOne(flowId);

    return flowResult.chain(async (flow) => {
      if (!flow) {
        this.logger.warn(`Flow with ID ${flowId} not found`);
        return failure(new GetFlowError(`Flow with ID ${flowId} not found`));
      }

      // Get the flow steps
      const stepsResult = await this.flowStepRepository.findByFlowId(flowId);

      return stepsResult.chain((steps) => {
        this.logger.log(`Found flow "${flow.name}" with ${steps.length} steps`);
        return success({
          ...flow,
          steps,
        });
      });
    });
  }
}
