import { Injectable, Logger } from "@nestjs/common";

import { ErrorCodes } from "../../../../common/utils/error-codes";
import { Result, failure, AppError } from "../../../../common/utils/fp-utils";
import type { WorkbookVersionDto } from "../../../core/models/workbook-version.model";
import { WorkbookVersionRepository } from "../../../core/repositories/workbook-version.repository";

@Injectable()
export class GetWorkbookVersionUseCase {
  private readonly logger = new Logger(GetWorkbookVersionUseCase.name);

  constructor(private readonly workbookVersionRepository: WorkbookVersionRepository) {}

  /**
   * `workbookId` is the workbook the caller was authorized against, and the lookup
   * is scoped to it — a version belonging to a different workbook reads as not
   * found, so the pair in the URL cannot be mixed to reach another workbook's cells.
   */
  async execute(versionId: string, workbookId: string): Promise<Result<WorkbookVersionDto>> {
    const result = await this.workbookVersionRepository.findById(versionId, workbookId);

    if (result.isFailure()) {
      return result;
    }

    if (!result.value) {
      this.logger.warn({
        msg: "Workbook version not found in workbook",
        errorCode: ErrorCodes.WORKBOOK_VERSION_NOT_FOUND,
        operation: "getWorkbookVersion",
        versionId,
        workbookId,
      });
      return failure(AppError.notFound(`Workbook version with ID ${versionId} not found`));
    }

    return result as Result<WorkbookVersionDto>;
  }
}
