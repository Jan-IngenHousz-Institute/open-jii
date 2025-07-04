import { Injectable, Logger } from "@nestjs/common";

import { Result, success, failure, AppError } from "../../../../common/utils/fp-utils";
import { CreateProtocolDto, ProtocolDto } from "../../../core/models/protocol.model";
import { ProtocolRepository } from "../../../core/repositories/protocol.repository";

@Injectable()
export class CreateProtocolUseCase {
  private readonly logger = new Logger(CreateProtocolUseCase.name);

  constructor(private readonly protocolRepository: ProtocolRepository) {}

  async execute(data: CreateProtocolDto, userId: string): Promise<Result<ProtocolDto>> {
    this.logger.log(`Creating protocol "${data.name}" for user ${userId}`);

    const protocolResult = await this.protocolRepository.create(data, userId);

    if (protocolResult.isSuccess()) {
      if (protocolResult.value.length === 0) {
        this.logger.error(`Failed to create protocol "${data.name}" for user ${userId}`);
        return failure(AppError.internal("Failed to create protocol"));
      }

      const protocol = protocolResult.value[0];
      this.logger.log(`Successfully created protocol "${protocol.name}" (ID: ${protocol.id})`);
      return success(protocol);
    }

    return protocolResult;
  }
}
