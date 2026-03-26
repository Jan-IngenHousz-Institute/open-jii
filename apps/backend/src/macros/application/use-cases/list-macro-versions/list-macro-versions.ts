import { Injectable, Logger } from "@nestjs/common";

import { ErrorCodes } from "../../../../common/utils/error-codes";
import { Result, failure, AppError } from "../../../../common/utils/fp-utils";
import { MacroDto } from "../../../core/models/macro.model";
import { MacroRepository } from "../../../core/repositories/macro.repository";

@Injectable()
export class ListMacroVersionsUseCase {
  private readonly logger = new Logger(ListMacroVersionsUseCase.name);

  constructor(private readonly macroRepository: MacroRepository) {}

  async execute(id: string): Promise<Result<MacroDto[]>> {
    this.logger.log({
      msg: "Listing macro versions",
      operation: "listMacroVersions",
      macroId: id,
    });

    // Check that at least one version exists
    const macroResult = await this.macroRepository.findById(id);

    if (macroResult.isFailure()) {
      return macroResult;
    }

    if (!macroResult.value) {
      this.logger.warn({
        msg: "Macro not found",
        errorCode: ErrorCodes.MACRO_NOT_FOUND,
        operation: "listMacroVersions",
        macroId: id,
      });
      return failure(AppError.notFound(`Macro with ID ${id} not found`));
    }

    // Return all versions by id
    return this.macroRepository.findVersionsById(id);
  }
}
