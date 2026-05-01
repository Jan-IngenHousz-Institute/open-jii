import { Injectable, Logger } from "@nestjs/common";

import { ErrorCodes } from "../../../../common/utils/error-codes";
import { Result, success, failure, AppError } from "../../../../common/utils/fp-utils";
import { MacroRepository } from "../../../core/repositories/macro.repository";

@Injectable()
export class DeleteMacroUseCase {
  private readonly logger = new Logger(DeleteMacroUseCase.name);

  constructor(private readonly macroRepository: MacroRepository) {}

  async execute(id: string, userId: string): Promise<Result<void>> {
    this.logger.log({
      msg: "Deleting macro",
      operation: "deleteMacro",
      macroId: id,
      userId,
    });

    const macroResult = await this.macroRepository.findById(id);

    if (macroResult.isFailure()) {
      return macroResult;
    }

    if (!macroResult.value) {
      this.logger.warn({
        msg: "Macro not found for deletion",
        errorCode: ErrorCodes.MACRO_NOT_FOUND,
        operation: "deleteMacro",
        macroId: id,
        userId,
      });
      return failure(AppError.notFound("Macro not found"));
    }

    const macro = macroResult.value;

    if (macro.createdBy !== userId) {
      this.logger.warn({
        msg: "Unauthorized macro deletion attempt",
        errorCode: ErrorCodes.FORBIDDEN,
        operation: "deleteMacro",
        macroId: id,
        userId,
      });
      return failure(AppError.forbidden("Only the macro creator can delete this macro"));
    }

    const deleteResult = await this.macroRepository.delete(id);

    if (deleteResult.isFailure()) {
      return deleteResult;
    }

    this.logger.log({
      msg: "Macro deleted successfully",
      operation: "deleteMacro",
      macroId: id,
      userId,
      status: "success",
    });
    return success(undefined);
  }
}
