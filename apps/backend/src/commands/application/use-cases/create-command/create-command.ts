import { Injectable, Logger } from "@nestjs/common";

import { ErrorCodes } from "../../../../common/utils/error-codes";
import { Result, success, failure, AppError } from "../../../../common/utils/fp-utils";
import { CreateCommandDto, CommandDto } from "../../../core/models/command.model";
import { CommandRepository } from "../../../core/repositories/command.repository";

@Injectable()
export class CreateCommandUseCase {
  private readonly logger = new Logger(CreateCommandUseCase.name);

  constructor(private readonly commandRepository: CommandRepository) {}

  async execute(data: CreateCommandDto, userId: string): Promise<Result<CommandDto>> {
    this.logger.log({
      msg: "Creating command",
      operation: "createCommand",
      userId,
    });

    const commandResult = await this.commandRepository.create(data, userId);

    if (commandResult.isSuccess()) {
      if (commandResult.value.length === 0) {
        this.logger.error({
          msg: "Failed to create command",
          errorCode: ErrorCodes.COMMAND_CREATE_FAILED,
          operation: "createCommand",
          userId,
        });
        return failure(AppError.internal("Failed to create command"));
      }

      const command = commandResult.value[0];
      this.logger.log({
        msg: "Command created successfully",
        operation: "createCommand",
        commandId: command.id,
        userId,
        status: "success",
      });
      return success(command);
    }

    return commandResult;
  }
}
