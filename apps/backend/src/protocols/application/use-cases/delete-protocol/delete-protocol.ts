import { Injectable, Logger } from "@nestjs/common";

import { ErrorCodes } from "../../../../common/utils/error-codes";
import { Result, success, failure, AppError } from "../../../../common/utils/fp-utils";
import { ProtocolDto } from "../../../core/models/protocol.model";
import { ProtocolRepository } from "../../../core/repositories/protocol.repository";

@Injectable()
export class DeleteProtocolUseCase {
  private readonly logger = new Logger(DeleteProtocolUseCase.name);

  constructor(private readonly protocolRepository: ProtocolRepository) {}

  async execute(id: string): Promise<Result<ProtocolDto>> {
    this.logger.log({
      msg: "Deleting protocol",
      operation: "deleteProtocol",
      context: DeleteProtocolUseCase.name,
      protocolId: id,
    });

    // Check if protocol exists
    const existingProtocolResult = await this.protocolRepository.findOne(id);

    if (existingProtocolResult.isFailure()) {
      return existingProtocolResult;
    }

    const protocol = existingProtocolResult.value;
    if (!protocol) {
      this.logger.warn({
        msg: "Attempt to delete non-existent protocol",
        errorCode: ErrorCodes.PROTOCOL_NOT_FOUND,
        operation: "deleteProtocol",
        context: DeleteProtocolUseCase.name,
        protocolId: id,
      });
      return failure(AppError.notFound(`Protocol not found`));
    }

    // Protocol exists, now delete it
    const deleteResult = await this.protocolRepository.delete(id);

    if (deleteResult.isFailure()) {
      return deleteResult;
    }

    const protocols = deleteResult.value;
    if (protocols.length === 0) {
      this.logger.error({
        msg: "Failed to delete protocol",
        errorCode: ErrorCodes.PROTOCOL_DELETE_FAILED,
        operation: "execute",
        context: DeleteProtocolUseCase.name,
        protocolId: id,
      });
      return failure(AppError.internal("Failed to delete protocol"));
    }

    this.logger.log({
      msg: "Successfully deleted protocol",
      operation: "execute",
      context: DeleteProtocolUseCase.name,
      protocolId: id,
      status: "success",
    });
    return success(protocols[0]);
  }
}
