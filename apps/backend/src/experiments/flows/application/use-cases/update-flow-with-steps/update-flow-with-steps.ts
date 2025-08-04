import { Injectable } from "@nestjs/common";

import { Result } from "../../../../../common/utils/fp-utils";
import { UpdateFlowWithStepsDto, FlowWithGraphDto } from "../../../core/models/flow.model";
import { FlowStepRepository } from "../../../core/repositories/flow-step.repository";

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
