import { Inject, Injectable, Logger } from "@nestjs/common";

import { ErrorCodes } from "../../../../common/utils/error-codes";
import { Result, success, failure, AppError } from "../../../../common/utils/fp-utils";
import { DATABRICKS_PORT, DatabricksPort } from "../../../core/ports/databricks.port";
import { MacroRepository } from "../../../core/repositories/macro.repository";

@Injectable()
export class DeleteMacroUseCase {
  private readonly logger = new Logger(DeleteMacroUseCase.name);

  constructor(
    private readonly macroRepository: MacroRepository,
    @Inject(DATABRICKS_PORT) private readonly databricksPort: DatabricksPort,
  ) {}

  async execute(id: string, userId: string): Promise<Result<void>> {
    this.logger.log({
      msg: "Deleting macro",
      operation: "deleteMacro",
      context: DeleteMacroUseCase.name,
      macroId: id,
      userId,
    });

    // First, check if the macro exists
    const macroResult = await this.macroRepository.findById(id);

    if (macroResult.isFailure()) {
      return macroResult;
    }

    if (!macroResult.value) {
      this.logger.warn({
        msg: "Macro not found for deletion",
        errorCode: ErrorCodes.MACRO_NOT_FOUND,
        operation: "deleteMacro",
        context: DeleteMacroUseCase.name,
        macroId: id,
        userId,
      });
      return failure(AppError.notFound("Macro not found"));
    }

    const macro = macroResult.value;

    // Check if user is the creator
    if (macro.createdBy !== userId) {
      this.logger.warn({
        msg: "Unauthorized macro deletion attempt",
        errorCode: ErrorCodes.FORBIDDEN,
        operation: "deleteMacro",
        context: DeleteMacroUseCase.name,
        macroId: id,
        userId,
      });
      return failure(AppError.forbidden("Only the macro creator can delete this macro"));
    }

    // Delete from Databricks first - use filename, not name
    const databricksResult = await this.databricksPort.deleteMacroCode(macro.filename);

    if (databricksResult.isFailure()) {
      this.logger.warn({
        msg: "Failed to delete macro from Databricks",
        errorCode: ErrorCodes.DATABRICKS_FILE_FAILED,
        operation: "deleteMacro",
        context: DeleteMacroUseCase.name,
        macroId: id,
        error: databricksResult.error.message,
      });
      // Continue with database deletion even if Databricks fails
      // as we don't want to leave orphaned database records
    }

    // Delete from database
    const deleteResult = await this.macroRepository.delete(id);

    if (deleteResult.isFailure()) {
      return deleteResult;
    }

    // The macro was successfully deleted
    this.logger.log({
      msg: "Macro deleted successfully",
      operation: "deleteMacro",
      context: DeleteMacroUseCase.name,
      macroId: id,
      userId,
      status: "success",
    });
    return success(undefined);
  }
}
