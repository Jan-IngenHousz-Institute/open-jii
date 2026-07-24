import { Injectable, Logger } from "@nestjs/common";

import { hasDynamicCommandRef } from "@repo/api/transforms/dynamic-command-refs";

import { ErrorCodes } from "../../../../common/utils/error-codes";
import { Result, failure, AppError } from "../../../../common/utils/fp-utils";
import type { WorkbookVersionDto } from "../../../core/models/workbook-version.model";
import { WorkbookVersionRepository } from "../../../core/repositories/workbook-version.repository";

export interface GetWorkbookVersionOptions {
  /** Whether the requesting client advertised the dynamic-command-ref capability. */
  clientSupportsDynamicRef?: boolean;
}

@Injectable()
export class GetWorkbookVersionUseCase {
  private readonly logger = new Logger(GetWorkbookVersionUseCase.name);

  constructor(private readonly workbookVersionRepository: WorkbookVersionRepository) {}

  async execute(
    versionId: string,
    options: GetWorkbookVersionOptions = {},
  ): Promise<Result<WorkbookVersionDto>> {
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

    // Hard capability boundary: an old client's strict command schema cannot
    // parse a `{ kind: "ref" }` command, so refuse to hand it a dynamic version
    // (fail before it can misparse the payload) rather than trust the fail-open
    // CMS force gate. No cells are returned on refusal.
    if (!options.clientSupportsDynamicRef && hasDynamicCommandRef(result.value.cells)) {
      this.logger.warn({
        msg: "Refused dynamic workbook version: client lacks dynamic-command-ref capability",
        errorCode: ErrorCodes.DYNAMIC_COMMAND_CLIENT_UPGRADE_REQUIRED,
        operation: "getWorkbookVersion",
        versionId,
      });
      return failure(
        AppError.upgradeRequired(
          "This workbook version requires a newer client to open",
          ErrorCodes.DYNAMIC_COMMAND_CLIENT_UPGRADE_REQUIRED,
        ),
      );
    }

    return result as Result<WorkbookVersionDto>;
  }
}
