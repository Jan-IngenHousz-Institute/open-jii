import { Injectable } from "@nestjs/common";

import { Result, success, failure } from "../../../../../common/utils/fp-utils";
import type { FlowWithGraphDto } from "../../../core/models/flow.model";
import { FlowRepository, FlowNotFoundError } from "../../../core/repositories/flow.repository";

@Injectable()
export class GetFlowWithGraphUseCase {
  constructor(private readonly flowRepository: FlowRepository) {}

  async execute(flowId: string): Promise<Result<FlowWithGraphDto>> {
    const result = await this.flowRepository.findOneWithGraph(flowId);

    if (result.isFailure()) {
      return result;
    }

    if (!result.value) {
      return failure(new FlowNotFoundError(flowId));
    }

    return success(result.value);
  }
}
