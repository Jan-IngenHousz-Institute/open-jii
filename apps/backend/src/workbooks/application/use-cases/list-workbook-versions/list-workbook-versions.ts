import { Injectable, Logger } from "@nestjs/common";

import type { Result } from "../../../../common/utils/fp-utils";
import type { WorkbookVersionDto } from "../../../core/models/workbook-version.model";
import { WorkbookVersionRepository } from "../../../core/repositories/workbook-version.repository";

@Injectable()
export class ListWorkbookVersionsUseCase {
  private readonly logger = new Logger(ListWorkbookVersionsUseCase.name);

  constructor(private readonly workbookVersionRepository: WorkbookVersionRepository) {}

  async execute(workbookId: string): Promise<Result<WorkbookVersionDto[]>> {
    this.logger.log({
      msg: "Listing workbook versions",
      operation: "listWorkbookVersions",
      workbookId,
    });

    return this.workbookVersionRepository.findByWorkbookId(workbookId);
  }
}
