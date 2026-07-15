import { Injectable, Logger } from "@nestjs/common";

import { AuthorizationService } from "../../../../authorization/authorization.service";
import { ErrorCodes } from "../../../../common/utils/error-codes";
import { Result, success, failure, AppError } from "../../../../common/utils/fp-utils";
import { UpdateMacroDto, MacroDto } from "../../../core/models/macro.model";
import { MacroRepository } from "../../../core/repositories/macro.repository";

@Injectable()
export class UpdateMacroUseCase {
  private readonly logger = new Logger(UpdateMacroUseCase.name);

  constructor(
    private readonly macroRepository: MacroRepository,
    private readonly authz: AuthorizationService,
  ) {}

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

    const decision = await this.authz.can(userId, {
      resourceType: "macro",
      resourceId: id,
      action: "update",
    });
    if (!decision.allow) {
      this.logger.warn({
        msg: "Unauthorized macro update attempt",
        errorCode: ErrorCodes.FORBIDDEN,
        operation: "updateMacro",
        macroId: id,
        userId,
      });
      return failure(AppError.forbidden("You cannot update this macro"));
    }

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

    const macro = macros[0];

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
