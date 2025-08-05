import { Injectable, Logger } from "@nestjs/common";

import { Result } from "../../../../../common/utils/fp-utils";
import { FlowDto } from "../../../core/models/flow.model";
import { FlowRepository } from "../../../core/repositories/flow.repository";

@Injectable()
export class ListFlowsUseCase {
  private readonly logger = new Logger(ListFlowsUseCase.name);

  constructor(private readonly flowRepository: FlowRepository) {}

  async execute(): Promise<Result<FlowDto[]>> {
    this.logger.log("Listing all active flows");

    return this.flowRepository.findAll();
  }
}
