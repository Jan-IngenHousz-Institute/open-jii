import { Inject, Injectable, Logger } from "@nestjs/common";

import { ErrorCodes } from "../../../../common/utils/error-codes";
import { Result, success, failure, AppError } from "../../../../common/utils/fp-utils";
import { CreateMacroDto, MacroDto } from "../../../core/models/macro.model";
import { DATABRICKS_PORT, DatabricksPort } from "../../../core/ports/databricks.port";
import { MacroRepository } from "../../../core/repositories/macro.repository";

@Injectable()
export class CreateMacroUseCase {
  private readonly logger = new Logger(CreateMacroUseCase.name);

  constructor(
    private readonly macroRepository: MacroRepository,
    @Inject(DATABRICKS_PORT) private readonly databricksPort: DatabricksPort,
  ) {}

  async execute(data: CreateMacroDto, userId: string): Promise<Result<MacroDto>> {
    this.logger.log({
      msg: "Creating macro",
      operation: "createMacro",
      context: CreateMacroUseCase.name,
      language: data.language,
      userId,
    });

    // First, create the macro in the database
    const macroResult = await this.macroRepository.create(
      {
        name: data.name,
        description: data.description,
        language: data.language,
        code: data.code,
      },
      userId,
    );

    if (macroResult.isFailure()) {
      return macroResult;
    }

    if (macroResult.value.length === 0) {
      this.logger.error({
        msg: "Failed to create macro in database",
        errorCode: ErrorCodes.MACRO_CREATE_FAILED,
        operation: "createMacro",
        context: CreateMacroUseCase.name,
        userId,
      });
      return failure(AppError.internal("Failed to create macro"));
    }

    const macro = macroResult.value[0];

    const databricksResult = await this.databricksPort.uploadMacroCode({
      filename: macro.filename,
      code: macro.code,
      language: macro.language,
    });

    if (databricksResult.isFailure()) {
      this.logger.error({
        msg: "Failed to upload macro code to Databricks",
        errorCode: ErrorCodes.DATABRICKS_FILE_FAILED,
        operation: "createMacro",
        context: CreateMacroUseCase.name,
        macroId: macro.id,
        userId,
        error: databricksResult.error.message,
      });

      // Clean up the macro from database since Databricks processing failed
      await this.macroRepository.delete(macro.id);

      return failure(AppError.internal(databricksResult.error.message));
    }

    this.logger.log({
      msg: "Macro created successfully",
      operation: "createMacro",
      context: CreateMacroUseCase.name,
      macroId: macro.id,
      userId,
      status: "success",
    });
    return success(macro);
  }
}
