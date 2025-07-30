import { Injectable, Logger } from "@nestjs/common";

import { Result, AppError, failure, success } from "../../../../../common/utils/fp-utils";
import { CreateFlowDto, FlowDto } from "../../../core/models/flow.model";
import { FlowRepository } from "../../../core/repositories/flow.repository";

export class CreateFlowError extends AppError {
  constructor(message: string, cause?: unknown) {
    super(message, "CREATE_FLOW_ERROR", 400, { cause });
  }
}

@Injectable()
export class CreateFlowUseCase {
  private readonly logger = new Logger(CreateFlowUseCase.name);

  constructor(private readonly flowRepository: FlowRepository) {}

  async execute(data: CreateFlowDto, userId: string): Promise<Result<FlowDto>> {
    this.logger.log(`Creating flow "${data.name}" for user ${userId}`);

    // Create the flow
    const flowResult = await this.flowRepository.create(data, userId);

    return flowResult.chain((flows: FlowDto[]) => {
      if (!flows || flows.length === 0) {
        this.logger.error(`Failed to create flow "${data.name}" for user ${userId}`);
        return failure(new CreateFlowError("Failed to create flow"));
      }

      const flow = flows[0];
      if (!flow) {
        this.logger.error(`Failed to create flow "${data.name}" for user ${userId}`);
        return failure(new CreateFlowError("Failed to create flow"));
      }

      this.logger.log(`Successfully created flow "${flow.name}" with ID ${flow.id}`);
      return success(flow);
    });
  }
}
