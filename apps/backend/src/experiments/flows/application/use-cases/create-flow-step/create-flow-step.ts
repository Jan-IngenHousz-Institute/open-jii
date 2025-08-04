import { Injectable, Logger } from "@nestjs/common";

import { AppError, failure, success } from "../../../../../common/utils/fp-utils";
import { CreateFlowStepDto, FlowStepDto } from "../../../core/models/flow.model";
import { FlowStepRepository } from "../../../core/repositories/flow-step.repository";
import { FlowRepository } from "../../../core/repositories/flow.repository";

export class CreateFlowStepError extends AppError {
  constructor(message: string, cause?: unknown) {
    super(message, "CREATE_FLOW_STEP_ERROR", 400, { cause });
  }
}

@Injectable()
export class CreateFlowStepUseCase {
  private readonly logger = new Logger(CreateFlowStepUseCase.name);

  constructor(
    private readonly flowRepository: FlowRepository,
    private readonly flowStepRepository: FlowStepRepository,
  ) {}

  async execute(flowId: string, data: CreateFlowStepDto) {
    this.logger.log(`Creating flow step for flow ${flowId}`);

    // Note: This currently assumes repositories will be migrated to fp-utils
    // For now, we'll need to convert Effect calls temporarily

    // Verify the flow exists
    const flowResult = await this.flowRepository.findOne(flowId);

    if (flowResult.isFailure()) {
      return flowResult;
    }

    const flow = flowResult.value;
    if (!flow) {
      this.logger.warn(`Flow with ID ${flowId} not found`);
      return failure(new CreateFlowStepError(`Flow with ID ${flowId} not found`));
    }

    // React Flow steps require position, use default if not provided
    let stepData = data;
    if (!stepData.position) {
      stepData = {
        ...data,
        position: { x: 250, y: 100 },
      };
    }

    // Create the flow step
    const stepResult = await this.flowStepRepository.create(flowId, stepData);

    return stepResult.chain((steps: FlowStepDto[]) => {
      if (steps.length === 0) {
        this.logger.error(`Failed to create flow step for flow ${flowId}`);
        return failure(new CreateFlowStepError("Failed to create flow step"));
      }

      const step = steps[0];
      this.logger.log(`Successfully created ${step.type} step with ID ${step.id}`);
      return success(step);
    });
  }
}
