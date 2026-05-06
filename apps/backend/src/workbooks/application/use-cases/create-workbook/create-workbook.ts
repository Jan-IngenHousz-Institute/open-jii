import { Injectable, Logger } from "@nestjs/common";

import { ErrorCodes } from "../../../../common/utils/error-codes";
import { Result, success, failure, AppError } from "../../../../common/utils/fp-utils";
import { CreateWorkbookDto, WorkbookDto } from "../../../core/models/workbook.model";
import { WorkbookRepository } from "../../../core/repositories/workbook.repository";

@Injectable()
export class CreateWorkbookUseCase {
  private readonly logger = new Logger(CreateWorkbookUseCase.name);

  constructor(private readonly workbookRepository: WorkbookRepository) {}

  async execute(data: CreateWorkbookDto, userId: string): Promise<Result<WorkbookDto>> {
    this.logger.log({
      msg: "Creating workbook",
      operation: "createWorkbook",
      userId,
    });

    const result = await this.workbookRepository.create(data, userId);

    if (result.isFailure()) {
      return result;
    }

    if (result.value.length === 0) {
      this.logger.error({
        msg: "Failed to create workbook in database",
        errorCode: ErrorCodes.WORKBOOK_CREATE_FAILED,
        operation: "createWorkbook",
        userId,
      });
      return failure(AppError.internal("Failed to create workbook"));
    }

    this.logger.log({
      msg: "Workbook created successfully",
      operation: "createWorkbook",
      workbookId: result.value[0].id,
      userId,
      status: "success",
    });

    return success(result.value[0]);
  }
}
