import { Injectable, Logger } from "@nestjs/common";

import { ErrorCodes } from "../../../../common/utils/error-codes";
import { Result, failure, success, AppError } from "../../../../common/utils/fp-utils";
import { MacroRepository } from "../../../../macros/core/repositories/macro.repository";
import { ProtocolMacroDto } from "../../../core/models/protocol-macros.model";
import { ProtocolMacroRepository } from "../../../core/repositories/protocol-macro.repository";
import { ProtocolRepository } from "../../../core/repositories/protocol.repository";

@Injectable()
export class AddCompatibleMacrosUseCase {
  private readonly logger = new Logger(AddCompatibleMacrosUseCase.name);

  constructor(
    private readonly protocolRepository: ProtocolRepository,
    private readonly protocolMacroRepository: ProtocolMacroRepository,
    private readonly macroRepository: MacroRepository,
  ) {}

  async execute(
    protocolId: string,
    macroIds: string[],
    currentUserId: string,
  ): Promise<Result<ProtocolMacroDto[]>> {
    this.logger.log({
      msg: "Adding compatible macros to protocol",
      operation: "addCompatibleMacros",
      protocolId,
      userId: currentUserId,
      macroCount: macroIds.length,
    });

    // Check protocol exists
    const protocolResult = await this.protocolRepository.findOne(protocolId);
    if (protocolResult.isFailure()) {
      return failure(AppError.internal("Failed to fetch protocol"));
    }
    if (!protocolResult.value) {
      return failure(AppError.notFound(`Protocol with ID ${protocolId} not found`));
    }

    // Check ownership
    if (protocolResult.value.createdBy !== currentUserId) {
      this.logger.warn({
        msg: "Unauthorized attempt to add compatible macros",
        errorCode: ErrorCodes.FORBIDDEN,
        operation: "addCompatibleMacros",
        protocolId,
        userId: currentUserId,
      });
      return failure(AppError.forbidden("Only the protocol creator can manage compatible macros"));
    }

    // Validate that all macros exist
    for (const macroId of macroIds) {
      const macroResult = await this.macroRepository.findById(macroId);
      if (macroResult.isFailure()) {
        return failure(AppError.internal("Failed to verify macro"));
      }
      if (!macroResult.value) {
        return failure(AppError.notFound(`Macro with ID ${macroId} not found`));
      }
    }

    // Add the compatibility links
    const addResult = await this.protocolMacroRepository.addMacros(protocolId, macroIds);
    if (addResult.isFailure()) {
      this.logger.error({
        msg: "Failed to add compatible macros",
        errorCode: ErrorCodes.PROTOCOL_MACROS_ADD_FAILED,
        operation: "addCompatibleMacros",
        protocolId,
      });
      return failure(AppError.internal("Failed to add compatible macros"));
    }

    this.logger.log({
      msg: "Compatible macros added successfully",
      operation: "addCompatibleMacros",
      protocolId,
      userId: currentUserId,
      macroCount: macroIds.length,
      status: "success",
    });
    return success(addResult.value);
  }
}
