import { Injectable, Logger } from "@nestjs/common";

import { ErrorCodes } from "../../../../common/utils/error-codes";
import { Result, success, failure, AppError } from "../../../../common/utils/fp-utils";
import { UpdateWorkbookDto, WorkbookDto } from "../../../core/models/workbook.model";
import { WorkbookRepository } from "../../../core/repositories/workbook.repository";

@Injectable()
export class UpdateWorkbookUseCase {
  private readonly logger = new Logger(UpdateWorkbookUseCase.name);

  constructor(private readonly workbookRepository: WorkbookRepository) {}

  async execute(id: string, data: UpdateWorkbookDto, userId: string): Promise<Result<WorkbookDto>> {
    this.logger.log({
      msg: "Updating workbook",
      operation: "updateWorkbook",
      workbookId: id,
      userId,
    });

    const workbookResult = await this.workbookRepository.findById(id);

    if (workbookResult.isFailure()) {
      return workbookResult;
    }

    const existingWorkbook = workbookResult.value;
    if (!existingWorkbook) {
      this.logger.warn({
        msg: "Attempt to update non-existent workbook",
        errorCode: ErrorCodes.WORKBOOK_NOT_FOUND,
        operation: "updateWorkbook",
        workbookId: id,
        userId,
      });
      return failure(AppError.notFound(`Workbook with ID ${id} not found`));
    }

    if (existingWorkbook.createdBy !== userId) {
      this.logger.warn({
        msg: "Unauthorized workbook update attempt",
        errorCode: ErrorCodes.FORBIDDEN,
        operation: "updateWorkbook",
        workbookId: id,
        userId,
      });
      return failure(AppError.forbidden("Only the workbook creator can update this workbook"));
    }

    const updateResult = await this.workbookRepository.update(id, data);

    if (updateResult.isFailure()) {
      return updateResult;
    }

    if (updateResult.value.length === 0) {
      this.logger.error({
        msg: "Failed to update workbook",
        errorCode: ErrorCodes.WORKBOOK_UPDATE_FAILED,
        operation: "updateWorkbook",
        workbookId: id,
        userId,
      });
      return failure(AppError.internal("Failed to update workbook"));
    }

    this.logger.log({
      msg: "Workbook updated successfully",
      operation: "updateWorkbook",
      workbookId: id,
      userId,
      status: "success",
    });

    return success(updateResult.value[0]);
  }
}
