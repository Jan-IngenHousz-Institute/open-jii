import { Injectable, Logger } from "@nestjs/common";

import { ErrorCodes } from "../../../../common/utils/error-codes";
import { Result, failure, AppError } from "../../../../common/utils/fp-utils";
import type { WorkbookVersionDto } from "../../../core/models/workbook-version.model";
import { WorkbookVersionRepository } from "../../../core/repositories/workbook-version.repository";

@Injectable()
export class GetWorkbookVersionUseCase {
  private readonly logger = new Logger(GetWorkbookVersionUseCase.name);

  constructor(private readonly workbookVersionRepository: WorkbookVersionRepository) {}

  async execute(versionId: string): Promise<Result<WorkbookVersionDto>> {
    const result = await this.workbookVersionRepository.findById(versionId);

    if (result.isFailure()) {
      return result;
    }

    if (!result.value) {
      this.logger.warn({
        msg: "Workbook version not found",
        errorCode: ErrorCodes.WORKBOOK_VERSION_NOT_FOUND,
        operation: "getWorkbookVersion",
        versionId,
      });
      return failure(AppError.notFound(`Workbook version with ID ${versionId} not found`));
    }

    return result as Result<WorkbookVersionDto>;
  }
}
