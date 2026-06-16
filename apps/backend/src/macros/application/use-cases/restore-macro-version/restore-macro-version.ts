import { Injectable, Logger } from "@nestjs/common";

import { Result, failure, AppError } from "../../../../common/utils/fp-utils";
import type { MacroDto } from "../../../core/models/macro.model";
import { MacroRepository } from "../../../core/repositories/macro.repository";

@Injectable()
export class RestoreMacroVersionUseCase {
  private readonly logger = new Logger(RestoreMacroVersionUseCase.name);

  constructor(private readonly macroRepository: MacroRepository) {}

  async execute(macroId: string, version: number, userId: string): Promise<Result<MacroDto>> {
    const macroResult = await this.macroRepository.findById(macroId);
    if (macroResult.isFailure()) {
      return macroResult;
    }
    const macro = macroResult.value;
    if (!macro) {
      return failure(AppError.notFound(`Macro with ID ${macroId} not found`));
    }
    if (macro.createdBy !== userId) {
      return failure(AppError.forbidden("Only the macro creator can restore versions"));
    }

    const versionResult = await this.macroRepository.findVersion(macroId, version);
    if (versionResult.isFailure()) {
      return versionResult;
    }
    const target = versionResult.value;
    if (!target) {
      return failure(AppError.notFound(`Macro version ${version} not found`));
    }

    this.logger.log({
      msg: "Restoring macro version",
      operation: "restoreMacroVersion",
      macroId,
      version,
      userId,
    });

    // Forward-mint the historical code as a new version (immutable append; pins stay valid).
    return this.macroRepository.mintVersion(macroId, {
      code: target.code,
      language: target.language,
      createdBy: userId,
    });
  }
}
