import { Injectable, Logger } from "@nestjs/common";

import { ErrorCodes } from "../../../../common/utils/error-codes";
import { Result, success, failure, AppError } from "../../../../common/utils/fp-utils";
import { CommandDto, UpdateCommandDto } from "../../../core/models/command.model";
import { CommandRepository } from "../../../core/repositories/command.repository";

@Injectable()
export class UpdateCommandUseCase {
  private readonly logger = new Logger(UpdateCommandUseCase.name);

  constructor(private readonly commandRepository: CommandRepository) {}

  async execute(id: string, updateCommandDto: UpdateCommandDto): Promise<Result<CommandDto>> {
    this.logger.log({
      msg: "Updating command",
      operation: "updateCommand",
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
        msg: "Attempt to update non-existent command",
        errorCode: ErrorCodes.COMMAND_NOT_FOUND,
        operation: "updateCommand",
        commandId: id,
      });
      return failure(AppError.notFound(`Command not found`));
    }

    // Command exists and is not assigned, now update it
    const updateResult = await this.commandRepository.update(id, updateCommandDto);

    if (updateResult.isFailure()) {
      return updateResult;
    }

    const commands = updateResult.value;
    if (commands.length === 0) {
      this.logger.error({
        msg: "Failed to update command",
        errorCode: ErrorCodes.COMMAND_UPDATE_FAILED,
        operation: "updateCommand",
        commandId: id,
      });
      return failure(AppError.internal("Failed to update command"));
    }

    this.logger.log({
      msg: "Command updated successfully",
      operation: "updateCommand",
      commandId: id,
      status: "success",
    });
    return success(commands[0]);
  }
}
