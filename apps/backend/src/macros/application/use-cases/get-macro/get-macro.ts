import { Injectable, Logger } from "@nestjs/common";

import { ErrorCodes } from "../../../../common/utils/error-codes";
import { Result, success, failure, AppError } from "../../../../common/utils/fp-utils";
import { MacroDto } from "../../../core/models/macro.model";
import { MacroRepository } from "../../../core/repositories/macro.repository";

@Injectable()
export class GetMacroUseCase {
  private readonly logger = new Logger(GetMacroUseCase.name);

  constructor(private readonly macroRepository: MacroRepository) {}

  async execute(id: string, version?: number): Promise<Result<MacroDto>> {
    this.logger.log({
      msg: "Getting macro",
      operation: "getMacro",
      macroId: id,
      version,
    });

    const result = await this.macroRepository.findById(id);

    if (result.isFailure()) {
      return result;
    }

    const macro = result.value;
    if (!macro) {
      this.logger.warn({
        msg: "Macro not found",
        errorCode: ErrorCodes.MACRO_NOT_FOUND,
        operation: "getMacro",
        macroId: id,
      });
      return failure(AppError.notFound("Macro not found"));
    }

    // Serve a pinned version's code/language when requested. The head already holds the
    // latest, so only a non-latest pin needs a version lookup.
    if (version != null && version !== macro.latestVersion) {
      const versionResult = await this.macroRepository.findVersion(id, version);
      if (versionResult.isFailure()) {
        return versionResult;
      }
      if (!versionResult.value) {
        return failure(AppError.notFound(`Macro version ${version} not found`));
      }
      return success({
        ...macro,
        code: versionResult.value.code,
        language: versionResult.value.language,
      });
    }

    return success(macro);
  }
}
