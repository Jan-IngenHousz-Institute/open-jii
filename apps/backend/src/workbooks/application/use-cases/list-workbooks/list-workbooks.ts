import { Injectable, Logger } from "@nestjs/common";

import { Result } from "../../../../common/utils/fp-utils";
import { WorkbookDto } from "../../../core/models/workbook.model";
import { WorkbookRepository, WorkbookFilter } from "../../../core/repositories/workbook.repository";

@Injectable()
export class ListWorkbooksUseCase {
  private readonly logger = new Logger(ListWorkbooksUseCase.name);

  constructor(private readonly workbookRepository: WorkbookRepository) {}

  async execute(filter?: WorkbookFilter): Promise<Result<WorkbookDto[]>> {
    this.logger.log({
      msg: "Listing workbooks",
      operation: "listWorkbooks",
      hasSearch: !!filter?.search,
    });
    return await this.workbookRepository.findAll(filter);
  }
}
