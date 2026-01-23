import { Injectable, Logger } from "@nestjs/common";

import { ErrorCodes } from "../../../../common/utils/error-codes";
import { Result, success, failure, AppError } from "../../../../common/utils/fp-utils";
import { CreateProtocolDto, ProtocolDto } from "../../../core/models/protocol.model";
import { ProtocolRepository } from "../../../core/repositories/protocol.repository";

@Injectable()
export class CreateProtocolUseCase {
  private readonly logger = new Logger(CreateProtocolUseCase.name);

  constructor(private readonly protocolRepository: ProtocolRepository) {}

  async execute(data: CreateProtocolDto, userId: string): Promise<Result<ProtocolDto>> {
    this.logger.log({
      msg: "Creating protocol",
      operation: "createProtocol",
      userId,
    });

    const protocolResult = await this.protocolRepository.create(data, userId);

    if (protocolResult.isSuccess()) {
      if (protocolResult.value.length === 0) {
        this.logger.error({
          msg: "Failed to create protocol",
          errorCode: ErrorCodes.PROTOCOL_CREATE_FAILED,
          operation: "createProtocol",
          userId,
        });
        return failure(AppError.internal("Failed to create protocol"));
      }

      const protocol = protocolResult.value[0];
      this.logger.log({
        msg: "Protocol created successfully",
        operation: "createProtocol",
        protocolId: protocol.id,
        userId,
        status: "success",
      });
      return success(protocol);
    }

    return protocolResult;
  }
}
