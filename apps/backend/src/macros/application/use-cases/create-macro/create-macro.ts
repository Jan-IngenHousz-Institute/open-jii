import { Injectable, Logger } from "@nestjs/common";

import { ErrorCodes } from "../../../../common/utils/error-codes";
import { Result, success, failure, AppError } from "../../../../common/utils/fp-utils";
import { CreateMacroDto, MacroDto } from "../../../core/models/macro.model";
import { MacroRepository } from "../../../core/repositories/macro.repository";

@Injectable()
export class CreateMacroUseCase {
  private readonly logger = new Logger(CreateMacroUseCase.name);

  constructor(private readonly macroRepository: MacroRepository) {}

  async execute(
    data: CreateMacroDto,
    userId: string,
    activeOrganizationId?: string | null,
  ): Promise<Result<MacroDto>> {
    this.logger.log({
      msg: "Creating macro",
      operation: "createMacro",
      language: data.language,
      userId,
    });

    const macroResult = await this.macroRepository.create(
      {
        name: data.name,
        description: data.description,
        language: data.language,
        code: data.code,
        visibility: data.visibility,
      },
      userId,
      activeOrganizationId,
    );

    if (macroResult.isFailure()) {
      return macroResult;
    }

    if (macroResult.value.length === 0) {
      this.logger.error({
        msg: "Failed to create macro in database",
        errorCode: ErrorCodes.MACRO_CREATE_FAILED,
        operation: "createMacro",
        userId,
      });
      return failure(AppError.internal("Failed to create macro"));
    }

    const macro = macroResult.value[0];

    this.logger.log({
      msg: "Macro created successfully",
      operation: "createMacro",
      macroId: macro.id,
      userId,
      status: "success",
    });
    return success(macro);
  }
}
