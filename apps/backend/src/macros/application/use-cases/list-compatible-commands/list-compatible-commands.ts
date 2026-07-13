import { Injectable, Logger } from "@nestjs/common";

import { ErrorCodes } from "../../../../common/utils/error-codes";
import { Result, failure, AppError } from "../../../../common/utils/fp-utils";
import { MacroCommandDto } from "../../../core/models/macro-command.model";
import { MacroCommandRepository } from "../../../core/repositories/macro-command.repository";
import { MacroRepository } from "../../../core/repositories/macro.repository";

@Injectable()
export class ListCompatibleCommandsUseCase {
  private readonly logger = new Logger(ListCompatibleCommandsUseCase.name);

  constructor(
    private readonly macroRepository: MacroRepository,
    private readonly macroCommandRepository: MacroCommandRepository,
  ) {}

  async execute(macroId: string): Promise<Result<MacroCommandDto[]>> {
    this.logger.log({
      msg: "Listing compatible commands for macro",
      operation: "listCompatibleCommands",
      macroId,
    });

    const macroResult = await this.macroRepository.findById(macroId);
    if (macroResult.isFailure()) {
      return failure(AppError.internal("Failed to fetch macro"));
    }
    if (!macroResult.value) {
      return failure(AppError.notFound(`Macro with ID ${macroId} not found`));
    }

    const result = await this.macroCommandRepository.listCommands(macroId);
    if (result.isFailure()) {
      this.logger.error({
        msg: "Failed to list compatible commands",
        errorCode: ErrorCodes.MACRO_COMMANDS_LIST_FAILED,
        operation: "listCompatibleCommands",
        macroId,
      });
      return failure(AppError.internal("Failed to list compatible commands"));
    }

    return result;
  }
}
