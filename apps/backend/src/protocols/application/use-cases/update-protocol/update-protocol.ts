import { Injectable, Logger } from "@nestjs/common";

import {
  PROTOCOL_NOT_FOUND,
  PROTOCOL_UPDATE_FAILED,
  PROTOCOL_ASSIGNED,
} from "../../../../common/utils/error-codes";
import { Result, success, failure, AppError } from "../../../../common/utils/fp-utils";
import { ProtocolDto, UpdateProtocolDto } from "../../../core/models/protocol.model";
import { ProtocolRepository } from "../../../core/repositories/protocol.repository";

@Injectable()
export class UpdateProtocolUseCase {
  private readonly logger = new Logger(UpdateProtocolUseCase.name);

  constructor(private readonly protocolRepository: ProtocolRepository) {}

  async execute(id: string, updateProtocolDto: UpdateProtocolDto): Promise<Result<ProtocolDto>> {
    this.logger.log({
      msg: "Updating protocol",
      operation: "updateProtocol",
      context: UpdateProtocolUseCase.name,
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
        msg: "Attempt to update non-existent protocol",
        errorCode: PROTOCOL_NOT_FOUND,
        operation: "updateProtocol",
        context: UpdateProtocolUseCase.name,
        protocolId: id,
      });
      return failure(AppError.notFound(`Protocol not found`));
    }

    // Prevent update if protocol is assigned to any experiment
    const isAssignedResult = await this.protocolRepository.isAssignedToAnyExperiment(id);
    if (isAssignedResult.isFailure()) {
      this.logger.error({
        msg: "Error checking protocol assignment",
        errorCode: PROTOCOL_UPDATE_FAILED,
        operation: "updateProtocol",
        context: UpdateProtocolUseCase.name,
        protocolId: id,
        error: isAssignedResult.error,
      });
      return failure(isAssignedResult.error);
    }
    if (isAssignedResult.value) {
      this.logger.warn({
        msg: "Cannot update protocol assigned to experiment",
        errorCode: PROTOCOL_ASSIGNED,
        operation: "updateProtocol",
        context: UpdateProtocolUseCase.name,
        protocolId: id,
      });
      return failure(AppError.forbidden("Cannot update protocol assigned to an experiment"));
    }

    // Protocol exists and is not assigned, now update it
    const updateResult = await this.protocolRepository.update(id, updateProtocolDto);

    if (updateResult.isFailure()) {
      return updateResult;
    }

    const protocols = updateResult.value;
    if (protocols.length === 0) {
      this.logger.error({
        msg: "Failed to update protocol",
        errorCode: PROTOCOL_UPDATE_FAILED,
        operation: "updateProtocol",
        context: UpdateProtocolUseCase.name,
        protocolId: id,
      });
      return failure(AppError.internal("Failed to update protocol"));
    }

    this.logger.log({
      msg: "Protocol updated successfully",
      operation: "updateProtocol",
      context: UpdateProtocolUseCase.name,
      protocolId: id,
      status: "success",
    });
    return success(protocols[0]);
  }
}
