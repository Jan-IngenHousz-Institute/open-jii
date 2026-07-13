import { Injectable, Logger } from "@nestjs/common";

import { ErrorCodes } from "../../../../common/utils/error-codes";
import { Result, failure, success, AppError } from "../../../../common/utils/fp-utils";
import { MacroCommandDto } from "../../../core/models/macro-command.model";
import { MacroCommandRepository } from "../../../core/repositories/macro-command.repository";
import { MacroRepository } from "../../../core/repositories/macro.repository";

@Injectable()
export class AddCompatibleCommandsUseCase {
  private readonly logger = new Logger(AddCompatibleCommandsUseCase.name);

  constructor(
    private readonly macroRepository: MacroRepository,
    private readonly macroCommandRepository: MacroCommandRepository,
  ) {}

  async execute(
    macroId: string,
    commandIds: string[],
    currentUserId: string,
  ): Promise<Result<MacroCommandDto[]>> {
    this.logger.log({
      msg: "Adding compatible commands to macro",
      operation: "addCompatibleCommands",
      macroId,
      userId: currentUserId,
      commandCount: commandIds.length,
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
        msg: "Unauthorized attempt to add compatible commands",
        errorCode: ErrorCodes.FORBIDDEN,
        operation: "addCompatibleCommands",
        macroId,
        userId: currentUserId,
      });
      return failure(AppError.forbidden("Only the macro creator can manage compatible commands"));
    }

    // Validate that all commands exist
    for (const commandId of commandIds) {
      const commandResult = await this.macroCommandRepository.findCommandById(commandId);
      if (commandResult.isFailure()) {
        return failure(AppError.internal("Failed to verify command"));
      }
      if (!commandResult.value) {
        return failure(AppError.notFound(`Command with ID ${commandId} not found`));
      }
    }

    // Add the compatibility links
    const addResult = await this.macroCommandRepository.addCommands(macroId, commandIds);
    if (addResult.isFailure()) {
      this.logger.error({
        msg: "Failed to add compatible commands",
        errorCode: ErrorCodes.MACRO_COMMANDS_ADD_FAILED,
        operation: "addCompatibleCommands",
        macroId,
      });
      return failure(AppError.internal("Failed to add compatible commands"));
    }

    this.logger.log({
      msg: "Compatible commands added successfully",
      operation: "addCompatibleCommands",
      macroId,
      userId: currentUserId,
      commandCount: commandIds.length,
      status: "success",
    });
    return success(addResult.value);
  }
}
