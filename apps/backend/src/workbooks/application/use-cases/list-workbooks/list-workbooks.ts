import { Injectable, Logger } from "@nestjs/common";

import { Result } from "../../../../common/utils/fp-utils";
import { WorkbookListItemDto } from "../../../core/models/workbook.model";
import { WorkbookRepository, WorkbookFilter } from "../../../core/repositories/workbook.repository";

@Injectable()
export class ListWorkbooksUseCase {
  private readonly logger = new Logger(ListWorkbooksUseCase.name);

  constructor(private readonly workbookRepository: WorkbookRepository) {}

  async execute(filter?: WorkbookFilter): Promise<Result<WorkbookListItemDto[]>> {
    this.logger.log({
      msg: "Listing workbooks",
      operation: "listWorkbooks",
      hasSearch: !!filter?.search,
    });
    return await this.workbookRepository.findAll(filter);
  }

  async executePaginated(
    page: number,
    pageSize: number,
    filter?: WorkbookFilter,
  ): Promise<Result<{ items: WorkbookListItemDto[]; totalCount: number }>> {
    this.logger.log({
      msg: "Listing workbooks",
      operation: "listWorkbooksPaginated",
      page,
      pageSize,
      hasSearch: !!filter?.search,
    });
    return await this.workbookRepository.findPage(page, pageSize, filter);
  }
}
