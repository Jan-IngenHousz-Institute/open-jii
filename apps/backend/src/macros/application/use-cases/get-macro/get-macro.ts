import { Injectable, Logger } from "@nestjs/common";

import { ErrorCodes } from "../../../../common/utils/error-codes";
import { Result, success, failure, AppError } from "../../../../common/utils/fp-utils";
import { MacroDto } from "../../../core/models/macro.model";
import { MacroRepository } from "../../../core/repositories/macro.repository";

@Injectable()
export class GetMacroUseCase {
  private readonly logger = new Logger(GetMacroUseCase.name);

  constructor(private readonly macroRepository: MacroRepository) {}

  async execute(id: string): Promise<Result<MacroDto>> {
    this.logger.log({
      msg: "Getting macro",
      operation: "getMacro",
      context: GetMacroUseCase.name,
      macroId: id,
    });

    const result = await this.macroRepository.findById(id);

    if (result.isFailure()) {
      return result;
    }

    if (!result.value) {
      this.logger.warn({
        msg: "Macro not found",
        errorCode: ErrorCodes.MACRO_NOT_FOUND,
        operation: "getMacro",
        context: GetMacroUseCase.name,
        macroId: id,
      });
      return failure(AppError.notFound("Macro not found"));
    }

    return success(result.value);
  }
}
