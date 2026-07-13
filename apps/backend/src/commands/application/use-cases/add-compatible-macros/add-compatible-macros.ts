import { Injectable, Logger } from "@nestjs/common";

import { ErrorCodes } from "../../../../common/utils/error-codes";
import { Result, failure, success, AppError } from "../../../../common/utils/fp-utils";
import { MacroRepository } from "../../../../macros/core/repositories/macro.repository";
import { CommandMacroDto } from "../../../core/models/command-macro.model";
import { CommandMacroRepository } from "../../../core/repositories/command-macro.repository";
import { CommandRepository } from "../../../core/repositories/command.repository";

@Injectable()
export class AddCompatibleMacrosUseCase {
  private readonly logger = new Logger(AddCompatibleMacrosUseCase.name);

  constructor(
    private readonly commandRepository: CommandRepository,
    private readonly commandMacroRepository: CommandMacroRepository,
    private readonly macroRepository: MacroRepository,
  ) {}

  async execute(
    commandId: string,
    macroIds: string[],
    currentUserId: string,
  ): Promise<Result<CommandMacroDto[]>> {
    this.logger.log({
      msg: "Adding compatible macros to command",
      operation: "addCompatibleMacros",
      commandId,
      userId: currentUserId,
      macroCount: macroIds.length,
    });

    // Check command exists
    const commandResult = await this.commandRepository.findOne(commandId);
    if (commandResult.isFailure()) {
      return failure(AppError.internal("Failed to fetch command"));
    }
    if (!commandResult.value) {
      return failure(AppError.notFound(`Command with ID ${commandId} not found`));
    }

    // Check ownership
    if (commandResult.value.createdBy !== currentUserId) {
      this.logger.warn({
        msg: "Unauthorized attempt to add compatible macros",
        errorCode: ErrorCodes.FORBIDDEN,
        operation: "addCompatibleMacros",
        commandId,
        userId: currentUserId,
      });
      return failure(AppError.forbidden("Only the command creator can manage compatible macros"));
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
    const addResult = await this.commandMacroRepository.addMacros(commandId, macroIds);
    if (addResult.isFailure()) {
      this.logger.error({
        msg: "Failed to add compatible macros",
        errorCode: ErrorCodes.COMMAND_MACROS_ADD_FAILED,
        operation: "addCompatibleMacros",
        commandId,
      });
      return failure(AppError.internal("Failed to add compatible macros"));
    }

    this.logger.log({
      msg: "Compatible macros added successfully",
      operation: "addCompatibleMacros",
      commandId,
      userId: currentUserId,
      macroCount: macroIds.length,
      status: "success",
    });
    return success(addResult.value);
  }
}
