import { Injectable, Logger } from "@nestjs/common";

import { ErrorCodes } from "../../../../common/utils/error-codes";
import { Result, failure, AppError } from "../../../../common/utils/fp-utils";
import { CommandMacroDto } from "../../../core/models/command-macro.model";
import { CommandMacroRepository } from "../../../core/repositories/command-macro.repository";
import { CommandRepository } from "../../../core/repositories/command.repository";

@Injectable()
export class ListCompatibleMacrosUseCase {
  private readonly logger = new Logger(ListCompatibleMacrosUseCase.name);

  constructor(
    private readonly commandRepository: CommandRepository,
    private readonly commandMacroRepository: CommandMacroRepository,
  ) {}

  async execute(commandId: string): Promise<Result<CommandMacroDto[]>> {
    this.logger.log({
      msg: "Listing compatible macros for command",
      operation: "listCompatibleMacros",
      commandId,
    });

    const commandResult = await this.commandRepository.findOne(commandId);
    if (commandResult.isFailure()) {
      return failure(AppError.internal("Failed to fetch command"));
    }
    if (!commandResult.value) {
      return failure(AppError.notFound(`Command with ID ${commandId} not found`));
    }

    const result = await this.commandMacroRepository.listMacros(commandId);
    if (result.isFailure()) {
      this.logger.error({
        msg: "Failed to list compatible macros",
        errorCode: ErrorCodes.COMMAND_MACROS_LIST_FAILED,
        operation: "listCompatibleMacros",
        commandId,
      });
      return failure(AppError.internal("Failed to list compatible macros"));
    }

    return result;
  }
}
