import { Injectable, Logger } from "@nestjs/common";

import { ErrorCodes } from "../../../../common/utils/error-codes";
import { Result, failure, AppError } from "../../../../common/utils/fp-utils";
import { MacroProtocolRepository } from "../../../core/repositories/macro-protocol.repository";
import { MacroRepository } from "../../../core/repositories/macro.repository";

@Injectable()
export class RemoveCompatibleProtocolUseCase {
  private readonly logger = new Logger(RemoveCompatibleProtocolUseCase.name);

  constructor(
    private readonly macroRepository: MacroRepository,
    private readonly macroProtocolRepository: MacroProtocolRepository,
  ) {}

  async execute(macroId: string, protocolId: string, currentUserId: string): Promise<Result<void>> {
    this.logger.log({
      msg: "Removing compatible protocol from macro",
      operation: "removeCompatibleProtocol",
      macroId,
      protocolId,
      userId: currentUserId,
    });

    // Check macro exists
    const macroResult = await this.macroRepository.findById(macroId);
    if (macroResult.isFailure()) {
      return failure(AppError.internal("Failed to fetch macro"));
    }
    if (!macroResult.value) {
      return failure(AppError.notFound(`Macro with ID ${macroId} not found`));
    }

    // Check ownership
    if (macroResult.value.createdBy !== currentUserId) {
      this.logger.warn({
        msg: "Unauthorized attempt to remove compatible protocol",
        errorCode: ErrorCodes.FORBIDDEN,
        operation: "removeCompatibleProtocol",
        macroId,
        userId: currentUserId,
      });
      return failure(AppError.forbidden("Only the macro creator can manage compatible protocols"));
    }

    const macroVersion = macroResult.value.version;
    // Look up the protocol's version from the existing link
    const protocolLookup = await this.macroProtocolRepository.findProtocolById(protocolId);
    const protocolVersion =
      protocolLookup.isSuccess() && protocolLookup.value ? protocolLookup.value.version : 1;
    const removeResult = await this.macroProtocolRepository.removeProtocol(
      macroId,
      macroVersion,
      protocolId,
      protocolVersion,
    );
    if (removeResult.isFailure()) {
      this.logger.error({
        msg: "Failed to remove compatible protocol",
        errorCode: ErrorCodes.MACRO_PROTOCOLS_REMOVE_FAILED,
        operation: "removeCompatibleProtocol",
        macroId,
        protocolId,
      });
      return failure(AppError.internal("Failed to remove compatible protocol"));
    }

    this.logger.log({
      msg: "Compatible protocol removed successfully",
      operation: "removeCompatibleProtocol",
      macroId,
      protocolId,
      userId: currentUserId,
      status: "success",
    });
    return removeResult;
  }
}
