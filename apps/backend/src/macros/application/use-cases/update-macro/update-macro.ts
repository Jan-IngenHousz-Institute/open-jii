import { Injectable, Logger } from "@nestjs/common";

import { ErrorCodes } from "../../../../common/utils/error-codes";
import { Result, success, failure, AppError } from "../../../../common/utils/fp-utils";
import { UpdateMacroDto, MacroDto } from "../../../core/models/macro.model";
import { MacroRepository } from "../../../core/repositories/macro.repository";

@Injectable()
export class UpdateMacroUseCase {
  private readonly logger = new Logger(UpdateMacroUseCase.name);

  constructor(private readonly macroRepository: MacroRepository) {}

  async execute(id: string, data: UpdateMacroDto, userId: string): Promise<Result<MacroDto>> {
    this.logger.log({
      msg: "Updating macro",
      operation: "updateMacro",
      macroId: id,
      userId,
    });

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

    // A code or language change mints a new immutable version (deduped against the
    // current head); metadata-only edits stay in place. Workbook cells stay pinned to
    // their version, so other workbooks are unaffected until they opt to upgrade.
    const codeChanged = data.code !== undefined && data.code !== existingMacro.code;
    const languageChanged = data.language !== undefined && data.language !== existingMacro.language;

    let macro: MacroDto;

    if (codeChanged || languageChanged) {
      const mintResult = await this.macroRepository.mintVersion(id, {
        code: data.code ?? existingMacro.code,
        language: data.language ?? existingMacro.language,
        createdBy: userId,
      });
      if (mintResult.isFailure()) {
        return mintResult;
      }
      macro = mintResult.value;

      // Apply any accompanying metadata (name/description) in place.
      const metadata: UpdateMacroDto = {};
      if (data.name !== undefined) metadata.name = data.name;
      if (data.description !== undefined) metadata.description = data.description;
      if (Object.keys(metadata).length > 0) {
        const metaResult = await this.macroRepository.update(id, metadata);
        if (metaResult.isFailure()) {
          return metaResult;
        }
        if (metaResult.value.length > 0) {
          macro = metaResult.value[0];
        }
      }
    } else {
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
          macroId: id,
          userId,
        });
        return failure(AppError.internal("Failed to update macro"));
      }
      macro = macros[0];
    }

    this.logger.log({
      msg: "Macro updated successfully",
      operation: "updateMacro",
      macroId: macro.id,
      userId,
      status: "success",
    });
    return success(macro);
  }
}
