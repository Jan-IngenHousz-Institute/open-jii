import { Inject, Injectable, Logger } from "@nestjs/common";

import { ErrorCodes } from "../../../../common/utils/error-codes";
import { Result, success, failure, AppError } from "../../../../common/utils/fp-utils";
import { UpdateMacroDto, MacroDto } from "../../../core/models/macro.model";
import { DATABRICKS_PORT, DatabricksPort } from "../../../core/ports/databricks.port";
import { MacroRepository } from "../../../core/repositories/macro.repository";

@Injectable()
export class UpdateMacroUseCase {
  private readonly logger = new Logger(UpdateMacroUseCase.name);

  constructor(
    private readonly macroRepository: MacroRepository,
    @Inject(DATABRICKS_PORT) private readonly databricksPort: DatabricksPort,
  ) {}

  async execute(id: string, data: UpdateMacroDto, userId: string): Promise<Result<MacroDto>> {
    this.logger.log({
      msg: "Updating macro",
      operation: "updateMacro",
      context: UpdateMacroUseCase.name,
      macroId: id,
      userId,
    });

    // First, fetch the macro to check access
    const macroResult = await this.macroRepository.findById(id);

    if (macroResult.isFailure()) {
      return macroResult;
    }

    const existingMacro = macroResult.value;
    if (!existingMacro) {
      this.logger.warn({
        msg: "Attempt to update non-existent macro",
        errorCode: ErrorCodes.MACRO_NOT_FOUND,
        operation: "updateMacro",
        context: UpdateMacroUseCase.name,
        macroId: id,
        userId,
      });
      return failure(AppError.notFound(`Macro with ID ${id} not found`));
    }

    // Check if user is the creator
    if (existingMacro.createdBy !== userId) {
      this.logger.warn({
        msg: "Unauthorized macro update attempt",
        errorCode: ErrorCodes.FORBIDDEN,
        operation: "updateMacro",
        context: UpdateMacroUseCase.name,
        macroId: id,
        userId,
      });
      return failure(AppError.forbidden("Only the macro creator can update this macro"));
    }

    // Update the macro in the database
    const updateResult = await this.macroRepository.update(id, data);

    if (updateResult.isFailure()) {
      return updateResult;
    }

    const macros = updateResult.value;
    if (macros.length === 0) {
      this.logger.error({
        msg: "Failed to update macro",
        errorCode: ErrorCodes.MACRO_UPDATE_FAILED,
        operation: "updateMacro",
        context: UpdateMacroUseCase.name,
        macroId: id,
        userId,
      });
      return failure(AppError.internal("Failed to update macro"));
    }

    const macro = macros[0];

    // If a new code file is provided, process it through Databricks
    if (data.code) {
      const databricksResult = await this.databricksPort.uploadMacroCode({
        filename: macro.filename,
        code: data.code,
        language: macro.language,
      });

      if (databricksResult.isFailure()) {
        this.logger.error({
          msg: "Failed to upload updated macro code to Databricks",
          errorCode: ErrorCodes.DATABRICKS_FILE_FAILED,
          operation: "updateMacro",
          context: UpdateMacroUseCase.name,
          macroId: macro.id,
          userId,
          error: databricksResult.error.message,
        });

        return failure(AppError.internal(databricksResult.error.message));
      }
    }

    this.logger.log({
      msg: "Macro updated successfully",
      operation: "updateMacro",
      context: UpdateMacroUseCase.name,
      macroId: macro.id,
      userId,
      status: "success",
    });
    return success(macro);
  }
}
