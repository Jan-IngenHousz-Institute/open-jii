import { Injectable, Logger } from "@nestjs/common";

import { ErrorCodes } from "../../../../common/utils/error-codes";
import { Result, failure, AppError } from "../../../../common/utils/fp-utils";
import { CommandMacroRepository } from "../../../core/repositories/command-macro.repository";
import { CommandRepository } from "../../../core/repositories/command.repository";

@Injectable()
export class RemoveCompatibleMacroUseCase {
  private readonly logger = new Logger(RemoveCompatibleMacroUseCase.name);

  constructor(
    private readonly commandRepository: CommandRepository,
    private readonly commandMacroRepository: CommandMacroRepository,
  ) {}

  async execute(commandId: string, macroId: string, currentUserId: string): Promise<Result<void>> {
    this.logger.log({
      msg: "Removing compatible macro from command",
      operation: "removeCompatibleMacro",
      commandId,
      macroId,
      userId: currentUserId,
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
        msg: "Unauthorized attempt to remove compatible macro",
        errorCode: ErrorCodes.FORBIDDEN,
        operation: "removeCompatibleMacro",
        commandId,
        userId: currentUserId,
      });
      return failure(AppError.forbidden("Only the command creator can manage compatible macros"));
    }

    const removeResult = await this.commandMacroRepository.removeMacro(commandId, macroId);
    if (removeResult.isFailure()) {
      this.logger.error({
        msg: "Failed to remove compatible macro",
        errorCode: ErrorCodes.COMMAND_MACROS_REMOVE_FAILED,
        operation: "removeCompatibleMacro",
        commandId,
        macroId,
      });
      return failure(AppError.internal("Failed to remove compatible macro"));
    }

    this.logger.log({
      msg: "Compatible macro removed successfully",
      operation: "removeCompatibleMacro",
      commandId,
      macroId,
      userId: currentUserId,
      status: "success",
    });
    return removeResult;
  }
}
