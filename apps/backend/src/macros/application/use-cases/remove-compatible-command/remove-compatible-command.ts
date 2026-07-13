import { Injectable, Logger } from "@nestjs/common";

import { ErrorCodes } from "../../../../common/utils/error-codes";
import { Result, failure, AppError } from "../../../../common/utils/fp-utils";
import { MacroCommandRepository } from "../../../core/repositories/macro-command.repository";
import { MacroRepository } from "../../../core/repositories/macro.repository";

@Injectable()
export class RemoveCompatibleCommandUseCase {
  private readonly logger = new Logger(RemoveCompatibleCommandUseCase.name);

  constructor(
    private readonly macroRepository: MacroRepository,
    private readonly macroCommandRepository: MacroCommandRepository,
  ) {}

  async execute(macroId: string, commandId: string, currentUserId: string): Promise<Result<void>> {
    this.logger.log({
      msg: "Removing compatible command from macro",
      operation: "removeCompatibleCommand",
      macroId,
      commandId,
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
        msg: "Unauthorized attempt to remove compatible command",
        errorCode: ErrorCodes.FORBIDDEN,
        operation: "removeCompatibleCommand",
        macroId,
        userId: currentUserId,
      });
      return failure(AppError.forbidden("Only the macro creator can manage compatible commands"));
    }

    const removeResult = await this.macroCommandRepository.removeCommand(macroId, commandId);
    if (removeResult.isFailure()) {
      this.logger.error({
        msg: "Failed to remove compatible command",
        errorCode: ErrorCodes.MACRO_COMMANDS_REMOVE_FAILED,
        operation: "removeCompatibleCommand",
        macroId,
        commandId,
      });
      return failure(AppError.internal("Failed to remove compatible command"));
    }

    this.logger.log({
      msg: "Compatible command removed successfully",
      operation: "removeCompatibleCommand",
      macroId,
      commandId,
      userId: currentUserId,
      status: "success",
    });
    return removeResult;
  }
}
