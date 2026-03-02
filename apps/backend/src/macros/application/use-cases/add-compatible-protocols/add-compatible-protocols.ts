import { Injectable, Logger } from "@nestjs/common";

import { ErrorCodes } from "../../../../common/utils/error-codes";
import { Result, failure, success, AppError } from "../../../../common/utils/fp-utils";
import { MacroProtocolDto } from "../../../core/models/macro-protocol.model";
import { MacroProtocolRepository } from "../../../core/repositories/macro-protocol.repository";
import { MacroRepository } from "../../../core/repositories/macro.repository";

@Injectable()
export class AddCompatibleProtocolsUseCase {
  private readonly logger = new Logger(AddCompatibleProtocolsUseCase.name);

  constructor(
    private readonly macroRepository: MacroRepository,
    private readonly macroProtocolRepository: MacroProtocolRepository,
  ) {}

  async execute(
    macroId: string,
    protocolIds: string[],
    currentUserId: string,
  ): Promise<Result<MacroProtocolDto[]>> {
    this.logger.log({
      msg: "Adding compatible protocols to macro",
      operation: "addCompatibleProtocols",
      macroId,
      userId: currentUserId,
      protocolCount: protocolIds.length,
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
        msg: "Unauthorized attempt to add compatible protocols",
        errorCode: ErrorCodes.FORBIDDEN,
        operation: "addCompatibleProtocols",
        macroId,
        userId: currentUserId,
      });
      return failure(AppError.forbidden("Only the macro creator can manage compatible protocols"));
    }

    // Validate that all protocols exist
    for (const protocolId of protocolIds) {
      const protocolResult = await this.macroProtocolRepository.findProtocolById(protocolId);
      if (protocolResult.isFailure()) {
        return failure(AppError.internal("Failed to verify protocol"));
      }
      if (!protocolResult.value) {
        return failure(AppError.notFound(`Protocol with ID ${protocolId} not found`));
      }
    }

    // Add the compatibility links
    const addResult = await this.macroProtocolRepository.addProtocols(macroId, protocolIds);
    if (addResult.isFailure()) {
      this.logger.error({
        msg: "Failed to add compatible protocols",
        errorCode: ErrorCodes.MACRO_PROTOCOLS_ADD_FAILED,
        operation: "addCompatibleProtocols",
        macroId,
      });
      return failure(AppError.internal("Failed to add compatible protocols"));
    }

    this.logger.log({
      msg: "Compatible protocols added successfully",
      operation: "addCompatibleProtocols",
      macroId,
      userId: currentUserId,
      protocolCount: protocolIds.length,
      status: "success",
    });
    return success(addResult.value);
  }
}
