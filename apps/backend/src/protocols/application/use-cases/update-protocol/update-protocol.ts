import { Injectable, Logger } from "@nestjs/common";

import { AuthorizationService } from "../../../../authorization/authorization.service";
import { ErrorCodes } from "../../../../common/utils/error-codes";
import { Result, success, failure, AppError } from "../../../../common/utils/fp-utils";
import { ProtocolDto, UpdateProtocolDto } from "../../../core/models/protocol.model";
import { ProtocolRepository } from "../../../core/repositories/protocol.repository";

@Injectable()
export class UpdateProtocolUseCase {
  private readonly logger = new Logger(UpdateProtocolUseCase.name);

  constructor(
    private readonly protocolRepository: ProtocolRepository,
    private readonly authz: AuthorizationService,
  ) {}

  async execute(
    id: string,
    updateProtocolDto: UpdateProtocolDto,
    userId: string,
  ): Promise<Result<ProtocolDto>> {
    this.logger.log({
      msg: "Updating protocol",
      operation: "updateProtocol",
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
        errorCode: ErrorCodes.PROTOCOL_NOT_FOUND,
        operation: "updateProtocol",
        protocolId: id,
      });
      return failure(AppError.notFound(`Protocol not found`));
    }

    const decision = await this.authz.can(userId, {
      resourceType: "protocol",
      resourceId: id,
      action: "update",
    });
    if (!decision.allow) {
      this.logger.warn({
        msg: "Unauthorized protocol update attempt",
        errorCode: ErrorCodes.FORBIDDEN,
        operation: "updateProtocol",
        protocolId: id,
        userId,
      });
      return failure(AppError.forbidden("You cannot update this protocol"));
    }

    // Protocol exists, now update it
    const updateResult = await this.protocolRepository.update(id, updateProtocolDto);

    if (updateResult.isFailure()) {
      return updateResult;
    }

    const protocols = updateResult.value;
    if (protocols.length === 0) {
      this.logger.error({
        msg: "Failed to update protocol",
        errorCode: ErrorCodes.PROTOCOL_UPDATE_FAILED,
        operation: "updateProtocol",
        protocolId: id,
      });
      return failure(AppError.internal("Failed to update protocol"));
    }

    this.logger.log({
      msg: "Protocol updated successfully",
      operation: "updateProtocol",
      protocolId: id,
      status: "success",
    });
    return success(protocols[0]);
  }
}
