import { Injectable, Logger } from "@nestjs/common";

import { ErrorCodes } from "../../../../common/utils/error-codes";
import { Result, success, failure, AppError } from "../../../../common/utils/fp-utils";
import { NotificationDispatchService } from "../../../../notifications/application/services/notification-dispatch.service";
import { SharingRepository } from "../../../../sharing/core/repositories/sharing.repository";
import { MacroRepository } from "../../../core/repositories/macro.repository";

@Injectable()
export class DeleteMacroUseCase {
  private readonly logger = new Logger(DeleteMacroUseCase.name);

  constructor(
    private readonly macroRepository: MacroRepository,
    private readonly sharingRepository: SharingRepository,
    private readonly notifications: NotificationDispatchService,
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
      await this.notify(userId, id, macroResult.value.name, members);
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

  /** Tell everyone who had access. A failure here leaves the delete standing. */
  private async notify(
    actorId: string,
    macroId: string,
    macroName: string,
    members: Result<string[]>,
  ): Promise<void> {
    if (members.isFailure()) {
      this.logger.error({
        msg: "Could not read who had access, nobody was notified of the deletion",
        errorCode: ErrorCodes.INTERNAL_SERVER_ERROR,
        operation: "deleteMacro",
        macroId,
        error: members.error,
      });
      return;
    }

    const dispatched = await this.notifications.dispatch({
      type: "resource_deleted",
      recipientIds: members.value,
      actorId,
      resource: { type: "macro", id: macroId },
      params: { resourceName: macroName },
    });

    if (dispatched.isFailure()) {
      this.logger.error({
        msg: "Failed to notify members, the macro was still deleted",
        errorCode: ErrorCodes.INTERNAL_SERVER_ERROR,
        operation: "deleteMacro",
        macroId,
        error: dispatched.error,
      });
    }
  }
}
