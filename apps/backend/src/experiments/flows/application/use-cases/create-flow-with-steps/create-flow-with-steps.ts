import { Injectable } from "@nestjs/common";

import { CreateFlowWithStepsDto } from "../../../core/models/flow.model";
import { FlowStepRepository } from "../../../core/repositories/flow-step.repository";

@Injectable()
export class CreateFlowWithStepsUseCase {
  constructor(private readonly flowStepRepository: FlowStepRepository) {}

  async execute(createFlowWithStepsDto: CreateFlowWithStepsDto, userId: string) {
    return this.flowStepRepository.createFlowWithSteps(createFlowWithStepsDto, userId);
  }
}
