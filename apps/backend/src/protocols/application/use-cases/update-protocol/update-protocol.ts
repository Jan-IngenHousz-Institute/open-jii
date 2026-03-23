import { Injectable, Logger } from "@nestjs/common";

import { ErrorCodes } from "../../../../common/utils/error-codes";
import { Result, success, failure, AppError } from "../../../../common/utils/fp-utils";
import { ProtocolDto, UpdateProtocolDto } from "../../../core/models/protocol.model";
import { ProtocolRepository } from "../../../core/repositories/protocol.repository";

@Injectable()
export class UpdateProtocolUseCase {
  private readonly logger = new Logger(UpdateProtocolUseCase.name);

  constructor(private readonly protocolRepository: ProtocolRepository) {}

  async execute(id: string, updateProtocolDto: UpdateProtocolDto): Promise<Result<ProtocolDto>> {
    this.logger.log({
      msg: "Creating new protocol version",
      operation: "updateProtocol",
      protocolId: id,
    });

    // Fetch the existing protocol (latest version)
    const existingProtocolResult = await this.protocolRepository.findOne(id);

    if (existingProtocolResult.isFailure()) {
      return existingProtocolResult;
    }

    const protocol = existingProtocolResult.value;
    if (!protocol) {
      this.logger.warn({
        msg: "Attempt to update non-existent protocol",
        errorCode: ErrorCodes.PROTOCOL_NOT_FOUND,
        operation: "updateProtocol",
        protocolId: id,
      });
      return failure(AppError.notFound(`Protocol not found`));
    }

    // Get the next version number for this protocol id
    const maxVersionResult = await this.protocolRepository.findMaxVersion(id);
    if (maxVersionResult.isFailure()) {
      return maxVersionResult;
    }
    const nextVersion = maxVersionResult.value + 1;

    // Create a new version: same UUID, incremented version, merged data
    const createResult = await this.protocolRepository.create(
      {
        id: protocol.id, // Same UUID
        version: nextVersion,
        name: updateProtocolDto.name ?? protocol.name,
        description: updateProtocolDto.description ?? protocol.description,
        code: updateProtocolDto.code ?? protocol.code,
        family: updateProtocolDto.family ?? protocol.family,
        sortOrder: protocol.sortOrder,
      },
      protocol.createdBy,
    );

    if (createResult.isFailure()) {
      this.logger.error({
        msg: "Failed to create new protocol version",
        errorCode: ErrorCodes.PROTOCOL_UPDATE_FAILED,
        operation: "updateProtocol",
        protocolId: id,
      });
      return createResult;
    }

    const newProtocols = createResult.value;
    if (newProtocols.length === 0) {
      return failure(AppError.internal("Failed to create new protocol version"));
    }

    this.logger.log({
      msg: "New protocol version created successfully",
      operation: "updateProtocol",
      protocolId: id,
      version: nextVersion,
      status: "success",
    });
    return success(newProtocols[0]);
  }
}
