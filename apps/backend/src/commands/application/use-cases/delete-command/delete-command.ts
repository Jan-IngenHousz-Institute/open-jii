import { Injectable, Logger } from "@nestjs/common";

import { ErrorCodes } from "../../../../common/utils/error-codes";
import { Result, success, failure, AppError } from "../../../../common/utils/fp-utils";
import { CommandDto } from "../../../core/models/command.model";
import { CommandRepository } from "../../../core/repositories/command.repository";

@Injectable()
export class DeleteCommandUseCase {
  private readonly logger = new Logger(DeleteCommandUseCase.name);

  constructor(private readonly commandRepository: CommandRepository) {}

  async execute(id: string): Promise<Result<CommandDto>> {
    this.logger.log({
      msg: "Deleting command",
      operation: "deleteCommand",
      commandId: id,
    });

    // Check if command exists
    const existingCommandResult = await this.commandRepository.findOne(id);

    if (existingCommandResult.isFailure()) {
      return existingCommandResult;
    }

    const command = existingCommandResult.value;
    if (!command) {
      this.logger.warn({
        msg: "Attempt to delete non-existent command",
        errorCode: ErrorCodes.COMMAND_NOT_FOUND,
        operation: "deleteCommand",
        commandId: id,
      });
      return failure(AppError.notFound(`Command not found`));
    }

    // Command exists, now delete it
    const deleteResult = await this.commandRepository.delete(id);

    if (deleteResult.isFailure()) {
      return deleteResult;
    }

    const commands = deleteResult.value;
    if (commands.length === 0) {
      this.logger.error({
        msg: "Failed to delete command",
        errorCode: ErrorCodes.COMMAND_DELETE_FAILED,
        operation: "execute",
        commandId: id,
      });
      return failure(AppError.internal("Failed to delete command"));
    }

    this.logger.log({
      msg: "Successfully deleted command",
      operation: "execute",
      commandId: id,
      status: "success",
    });
    return success(commands[0]);
  }
}
