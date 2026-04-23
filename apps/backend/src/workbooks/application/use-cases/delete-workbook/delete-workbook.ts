import { Injectable, Logger } from "@nestjs/common";

import { ErrorCodes } from "../../../../common/utils/error-codes";
import { Result, success, failure, AppError } from "../../../../common/utils/fp-utils";
import { WorkbookRepository } from "../../../core/repositories/workbook.repository";

@Injectable()
export class DeleteWorkbookUseCase {
  private readonly logger = new Logger(DeleteWorkbookUseCase.name);

  constructor(private readonly workbookRepository: WorkbookRepository) {}

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

    if (workbookResult.value.createdBy !== userId) {
      this.logger.warn({
        msg: "Unauthorized workbook deletion attempt",
        errorCode: ErrorCodes.FORBIDDEN,
        operation: "deleteWorkbook",
        workbookId: id,
        userId,
      });
      return failure(AppError.forbidden("Only the workbook creator can delete this workbook"));
    }

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

    this.logger.log({
      msg: "Workbook deleted successfully",
      operation: "deleteWorkbook",
      workbookId: id,
      userId,
      status: "success",
    });

    return success(undefined);
  }
}
