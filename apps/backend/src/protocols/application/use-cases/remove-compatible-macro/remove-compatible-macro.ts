import { Injectable, Logger } from "@nestjs/common";

import { AuthorizationService } from "../../../../authorization/authorization.service";
import { ErrorCodes } from "../../../../common/utils/error-codes";
import { Result, failure, AppError } from "../../../../common/utils/fp-utils";
import { ProtocolMacroRepository } from "../../../core/repositories/protocol-macro.repository";
import { ProtocolRepository } from "../../../core/repositories/protocol.repository";

@Injectable()
export class RemoveCompatibleMacroUseCase {
  private readonly logger = new Logger(RemoveCompatibleMacroUseCase.name);

  constructor(
    private readonly protocolRepository: ProtocolRepository,
    private readonly protocolMacroRepository: ProtocolMacroRepository,
    private readonly authz: AuthorizationService,
  ) {}

  async execute(protocolId: string, macroId: string, currentUserId: string): Promise<Result<void>> {
    this.logger.log({
      msg: "Removing compatible macro from protocol",
      operation: "removeCompatibleMacro",
      protocolId,
      macroId,
      userId: currentUserId,
    });

    // Check protocol exists
    const protocolResult = await this.protocolRepository.findOne(protocolId);
    if (protocolResult.isFailure()) {
      return failure(AppError.internal("Failed to fetch protocol"));
    }
    if (!protocolResult.value) {
      return failure(AppError.notFound(`Protocol with ID ${protocolId} not found`));
    }

    // Managing compatible macros is an update to the protocol.
    const decision = await this.authz.can(currentUserId, {
      resourceType: "protocol",
      resourceId: protocolId,
      action: "update",
    });
    if (!decision.allow) {
      this.logger.warn({
        msg: "Unauthorized attempt to remove compatible macro",
        errorCode: ErrorCodes.FORBIDDEN,
        operation: "removeCompatibleMacro",
        protocolId,
        userId: currentUserId,
      });
      return failure(AppError.forbidden("You cannot manage compatible macros for this protocol"));
    }

    const removeResult = await this.protocolMacroRepository.removeMacro(protocolId, macroId);
    if (removeResult.isFailure()) {
      this.logger.error({
        msg: "Failed to remove compatible macro",
        errorCode: ErrorCodes.PROTOCOL_MACROS_REMOVE_FAILED,
        operation: "removeCompatibleMacro",
        protocolId,
        macroId,
      });
      return failure(AppError.internal("Failed to remove compatible macro"));
    }

    this.logger.log({
      msg: "Compatible macro removed successfully",
      operation: "removeCompatibleMacro",
      protocolId,
      macroId,
      userId: currentUserId,
      status: "success",
    });
    return removeResult;
  }
}
