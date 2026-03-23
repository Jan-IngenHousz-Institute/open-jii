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

    // First find the macro to get its name
    const macroResult = await this.macroRepository.findById(id);

    if (macroResult.isFailure()) {
      return macroResult;
    }

    const macro = macroResult.value;
    if (!macro) {
      this.logger.warn({
        msg: "Macro not found",
        errorCode: ErrorCodes.MACRO_NOT_FOUND,
        operation: "listMacroVersions",
        macroId: id,
      });
      return failure(AppError.notFound(`Macro with ID ${id} not found`));
    }

    // Return all versions with the same name
    return this.macroRepository.findVersionsByName(macro.name);
  }
}
