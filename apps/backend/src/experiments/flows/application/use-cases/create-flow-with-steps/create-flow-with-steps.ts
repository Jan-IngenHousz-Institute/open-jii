import { Injectable } from "@nestjs/common";

import { Result } from "../../../../../common/utils/fp-utils";
import { CreateFlowWithStepsDto, FlowWithGraphDto } from "../../../core/models/flow.model";
import { FlowStepRepository } from "../../../core/repositories/flow-step.repository";

@Injectable()
export class CreateFlowWithStepsUseCase {
  constructor(private readonly flowStepRepository: FlowStepRepository) {}

  async execute(
    createFlowWithStepsDto: CreateFlowWithStepsDto,
    userId: string,
  ): Promise<Result<FlowWithGraphDto>> {
    return this.flowStepRepository.createFlowWithSteps(createFlowWithStepsDto, userId);
  }
}
