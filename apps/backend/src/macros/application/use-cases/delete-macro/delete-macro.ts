import { Injectable, Logger } from "@nestjs/common";

import { ErrorCodes } from "../../../../common/utils/error-codes";
import { Result, success, failure, AppError } from "../../../../common/utils/fp-utils";
import { ResourceDeletedNotifier } from "../../../../notifications/application/services/resource-deleted-notifier";
import { SharingRepository } from "../../../../sharing/core/repositories/sharing.repository";
import { MacroRepository } from "../../../core/repositories/macro.repository";

@Injectable()
export class DeleteMacroUseCase {
  private readonly logger = new Logger(DeleteMacroUseCase.name);

  constructor(
    private readonly macroRepository: MacroRepository,
    private readonly sharingRepository: SharingRepository,
    private readonly deletionNotifier: ResourceDeletedNotifier,
  ) {}

  async execute(id: string, userId: string): Promise<Result<void>> {
    this.logger.log({
      msg: "Deleting macro",
      operation: "deleteMacro",
      macroId: id,
      userId,
    });

    const macroResult = await this.macroRepository.findById(id);

    if (macroResult.isFailure()) {
      return macroResult;
    }

    if (!macroResult.value) {
      this.logger.warn({
        msg: "Macro not found for deletion",
        errorCode: ErrorCodes.MACRO_NOT_FOUND,
        operation: "deleteMacro",
        macroId: id,
        userId,
      });
      return failure(AppError.notFound("Macro not found"));
    }

    const members = await this.sharingRepository.listMemberIds("macro", id);

    const deleteResult = await this.macroRepository.delete(id);

    if (deleteResult.isFailure()) {
      return deleteResult;
    }

    if (deleteResult.value.length > 0) {
      await this.deletionNotifier.notify({
        operation: "deleteMacro",
        actorId: userId,
        resource: { type: "macro", id },
        name: macroResult.value.name,
        members,
      });
    }

    this.logger.log({
      msg: "Macro deleted successfully",
      operation: "deleteMacro",
      macroId: id,
      userId,
      status: "success",
    });
    return success(undefined);
  }
}
