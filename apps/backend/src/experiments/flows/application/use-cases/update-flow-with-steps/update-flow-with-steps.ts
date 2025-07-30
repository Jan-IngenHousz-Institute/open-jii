import { Injectable } from "@nestjs/common";

import { Result } from "../../../../../common/utils/fp-utils";
import { FlowStepRepository } from "../../../core/repositories/flow-step.repository";
import { UpdateFlowWithStepsDto, FlowWithGraphDto } from "../../../core/models/flow.model";

@Injectable()
export class UpdateFlowWithStepsUseCase {
  constructor(private readonly flowStepRepository: FlowStepRepository) {}

  async execute(
    flowId: string,
    updateFlowWithStepsDto: UpdateFlowWithStepsDto,
  ): Promise<Result<FlowWithGraphDto>> {
    return this.flowStepRepository.updateFlowWithSteps(flowId, updateFlowWithStepsDto);
  }
}