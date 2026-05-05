import { Injectable, Logger } from "@nestjs/common";

import { ErrorCodes } from "../../../../common/utils/error-codes";
import { Result, success, failure, AppError } from "../../../../common/utils/fp-utils";
import { WorkbookDto } from "../../../core/models/workbook.model";
import { WorkbookRepository } from "../../../core/repositories/workbook.repository";
import { IsWorkbookUpgradableUseCase } from "../is-workbook-upgradable/is-workbook-upgradable";

@Injectable()
export class GetWorkbookUseCase {
  private readonly logger = new Logger(GetWorkbookUseCase.name);

  constructor(
    private readonly workbookRepository: WorkbookRepository,
    private readonly isWorkbookUpgradableUseCase: IsWorkbookUpgradableUseCase,
  ) {}

  async execute(id: string, _userId: string): Promise<Result<WorkbookDto>> {
    this.logger.log({
      msg: "Getting workbook",
      operation: "getWorkbook",
      workbookId: id,
    });

    const result = await this.workbookRepository.findById(id);

    if (result.isFailure()) {
      return result;
    }

    if (!result.value) {
      this.logger.warn({
        msg: "Workbook not found",
        errorCode: ErrorCodes.WORKBOOK_NOT_FOUND,
        operation: "getWorkbook",
        workbookId: id,
      });
      return failure(AppError.notFound("Workbook not found"));
    }

    const isUpgradableResult = await this.isWorkbookUpgradableUseCase.execute(result.value);

    if (isUpgradableResult.isFailure()) {
      return isUpgradableResult;
    }

    return success({ ...result.value, isUpgradable: isUpgradableResult.value });
  }
}
