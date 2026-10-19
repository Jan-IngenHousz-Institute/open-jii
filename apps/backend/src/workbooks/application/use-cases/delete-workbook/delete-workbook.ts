import { Injectable, Logger } from "@nestjs/common";

import { ErrorCodes } from "../../../../common/utils/error-codes";
import { Result, success, failure, AppError } from "../../../../common/utils/fp-utils";
import { NotificationDispatchService } from "../../../../notifications/application/services/notification-dispatch.service";
import { SharingRepository } from "../../../../sharing/core/repositories/sharing.repository";
import { WorkbookRepository } from "../../../core/repositories/workbook.repository";

@Injectable()
export class DeleteWorkbookUseCase {
  private readonly logger = new Logger(DeleteWorkbookUseCase.name);

  constructor(
    private readonly workbookRepository: WorkbookRepository,
    private readonly sharingRepository: SharingRepository,
    private readonly notifications: NotificationDispatchService,
  ) {}

  async execute(id: string, userId: string): Promise<Result<void>> {
    this.logger.log({
      msg: "Deleting workbook",
      operation: "deleteWorkbook",
      workbookId: id,
      userId,
    });

    const workbookResult = await this.workbookRepository.findById(id);

    if (workbookResult.isFailure()) {
      return workbookResult;
    }

    if (!workbookResult.value) {
      this.logger.warn({
        msg: "Workbook not found for deletion",
        errorCode: ErrorCodes.WORKBOOK_NOT_FOUND,
        operation: "deleteWorkbook",
        workbookId: id,
        userId,
      });
      return failure(AppError.notFound("Workbook not found"));
    }

    const members = await this.sharingRepository.listMemberIds("workbook", id);

    const deleteResult = await this.workbookRepository.delete(id);

    if (deleteResult.isFailure()) {
      this.logger.error({
        msg: "Failed to delete workbook from database",
        errorCode: ErrorCodes.WORKBOOK_DELETE_FAILED,
        operation: "deleteWorkbook",
        workbookId: id,
        userId,
        error: deleteResult.error.message,
      });
      return deleteResult;
    }

    if (deleteResult.value.length > 0) {
      await this.notify(userId, id, workbookResult.value.name, members);
    }

    this.logger.log({
      msg: "Workbook deleted successfully",
      operation: "deleteWorkbook",
      workbookId: id,
      userId,
      status: "success",
    });

    return success(undefined);
  }

  /** Tell everyone who had access. A failure here leaves the delete standing. */
  private async notify(
    actorId: string,
    workbookId: string,
    resourceName: string,
    members: Result<string[]>,
  ): Promise<void> {
    if (members.isFailure()) {
      this.logger.error({
        msg: "Could not read who had access, nobody was notified of the deletion",
        errorCode: ErrorCodes.INTERNAL_SERVER_ERROR,
        operation: "deleteWorkbook",
        workbookId,
        error: members.error,
      });
      return;
    }

    const dispatched = await this.notifications.dispatch({
      type: "resource_deleted",
      recipientIds: members.value,
      actorId,
      resource: { type: "workbook", id: workbookId },
      params: { resourceName },
    });

    if (dispatched.isFailure()) {
      this.logger.error({
        msg: "Failed to notify members, the workbook was still deleted",
        errorCode: ErrorCodes.INTERNAL_SERVER_ERROR,
        operation: "deleteWorkbook",
        workbookId,
        error: dispatched.error,
      });
    }
  }
}
