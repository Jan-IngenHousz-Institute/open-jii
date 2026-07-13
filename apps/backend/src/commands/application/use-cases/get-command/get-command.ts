import { Injectable, Logger } from "@nestjs/common";

import { ErrorCodes } from "../../../../common/utils/error-codes";
import { Result, success, failure, AppError } from "../../../../common/utils/fp-utils";
import { CommandDto } from "../../../core/models/command.model";
import { CommandRepository } from "../../../core/repositories/command.repository";

@Injectable()
export class GetCommandUseCase {
  private readonly logger = new Logger(GetCommandUseCase.name);

  constructor(private readonly commandRepository: CommandRepository) {}

  async execute(id: string): Promise<Result<CommandDto>> {
    this.logger.log({
      msg: "Getting command",
      operation: "getCommand",
      commandId: id,
    });

    const result = await this.commandRepository.findOne(id);

    if (result.isFailure()) {
      return result;
    }

    const command = result.value;
    if (!command) {
      this.logger.warn({
        msg: "Command not found",
        errorCode: ErrorCodes.COMMAND_NOT_FOUND,
        operation: "getCommand",
        commandId: id,
      });
      return failure(AppError.notFound(`Command not found`));
    }

    this.logger.log({
      msg: "Command retrieved successfully",
      operation: "getCommand",
      commandId: id,
      status: "success",
    });
    return success(command);
  }
}
