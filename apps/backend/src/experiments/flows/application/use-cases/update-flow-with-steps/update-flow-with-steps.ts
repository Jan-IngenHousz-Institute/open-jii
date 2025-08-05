import { Injectable } from "@nestjs/common";

import { UpdateFlowWithStepsDto } from "../../../core/models/flow.model";
import { FlowStepRepository } from "../../../core/repositories/flow-step.repository";

@Injectable()
export class UpdateFlowWithStepsUseCase {
  constructor(private readonly flowStepRepository: FlowStepRepository) {}

  async execute(flowId: string, updateFlowWithStepsDto: UpdateFlowWithStepsDto) {
    return this.flowStepRepository.updateFlowWithSteps(flowId, updateFlowWithStepsDto);
  }
}
