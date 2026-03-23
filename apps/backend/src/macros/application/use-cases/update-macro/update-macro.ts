import { Inject, Injectable, Logger } from "@nestjs/common";

import { ErrorCodes } from "../../../../common/utils/error-codes";
import { Result, success, failure, AppError } from "../../../../common/utils/fp-utils";
import { UpdateMacroDto, MacroDto, generateHashedFilename } from "../../../core/models/macro.model";
import { DATABRICKS_PORT, DatabricksPort } from "../../../core/ports/databricks.port";
import { MacroProtocolRepository } from "../../../core/repositories/macro-protocol.repository";
import { MacroRepository } from "../../../core/repositories/macro.repository";

@Injectable()
export class UpdateMacroUseCase {
  private readonly logger = new Logger(UpdateMacroUseCase.name);

  constructor(
    private readonly macroRepository: MacroRepository,
    private readonly macroProtocolRepository: MacroProtocolRepository,
    @Inject(DATABRICKS_PORT) private readonly databricksPort: DatabricksPort,
  ) {}

  async execute(id: string, data: UpdateMacroDto, userId: string): Promise<Result<MacroDto>> {
    this.logger.log({
      msg: "Creating new macro version",
      operation: "updateMacro",
      macroId: id,
      userId,
    });

    // Fetch the existing macro
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
        macroId: id,
        userId,
      });
      return failure(AppError.forbidden("Only the macro creator can update this macro"));
    }

    // Get the next version number
    const maxVersionResult = await this.macroRepository.findMaxVersionByName(existingMacro.name);
    if (maxVersionResult.isFailure()) {
      return maxVersionResult;
    }
    const nextVersion = maxVersionResult.value + 1;

    // Create a new version: merge existing data with provided updates
    const newMacroId = crypto.randomUUID();
    const createResult = await this.macroRepository.create(
      {
        name: data.name ?? existingMacro.name,
        description: data.description ?? existingMacro.description,
        language: data.language ?? existingMacro.language,
        code: data.code ?? existingMacro.code,
        sortOrder: existingMacro.sortOrder,
        version: nextVersion,
      },
      userId,
    );

    if (createResult.isFailure()) {
      this.logger.error({
        msg: "Failed to create new macro version",
        errorCode: ErrorCodes.MACRO_UPDATE_FAILED,
        operation: "updateMacro",
        macroId: id,
        userId,
      });
      return createResult;
    }

    const newMacros = createResult.value;
    if (newMacros.length === 0) {
      return failure(AppError.internal("Failed to create new macro version"));
    }

    const newMacro = newMacros[0];

    // Upload code to Databricks with the new filename
    const codeToUpload = data.code ?? existingMacro.code;
    const databricksResult = await this.databricksPort.uploadMacroCode({
      filename: newMacro.filename,
      code: codeToUpload,
      language: newMacro.language,
    });

    if (databricksResult.isFailure()) {
      this.logger.error({
        msg: "Failed to upload new macro version code to Databricks",
        errorCode: ErrorCodes.DATABRICKS_FILE_FAILED,
        operation: "updateMacro",
        macroId: newMacro.id,
        userId,
        error: databricksResult.error.message,
      });
      // Clean up: delete the newly created version if Databricks upload fails
      await this.macroRepository.delete(newMacro.id);
      return failure(AppError.internal(databricksResult.error.message));
    }

    // Copy compatibility links from old version to new version
    await this.macroProtocolRepository.copyLinksToNewMacro(id, newMacro.id);

    this.logger.log({
      msg: "New macro version created successfully",
      operation: "updateMacro",
      previousMacroId: id,
      newMacroId: newMacro.id,
      version: nextVersion,
      userId,
      status: "success",
    });
    return success(newMacro);
  }
}
