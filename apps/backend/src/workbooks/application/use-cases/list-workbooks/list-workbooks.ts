import { Injectable, Logger } from "@nestjs/common";

import type { ResourceSeries } from "@repo/api/domains/metrics/metrics.schema";

import { Result, success } from "../../../../common/utils/fp-utils";
import { ResourceMetricsService } from "../../../../metrics/application/resource-metrics.service";
import { WorkbookListItemDto } from "../../../core/models/workbook.model";
import { WorkbookRepository, WorkbookFilter } from "../../../core/repositories/workbook.repository";

/** A listed resource plus the measurement series its row draws. */
type WorkbookWithActivity = WorkbookListItemDto & { activity: ResourceSeries | null };

@Injectable()
export class ListWorkbooksUseCase {
  private readonly logger = new Logger(ListWorkbooksUseCase.name);

  constructor(
    private readonly workbookRepository: WorkbookRepository,
    private readonly resourceMetrics: ResourceMetricsService,
  ) {}

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
  ): Promise<Result<{ items: WorkbookWithActivity[]; totalCount: number }>> {
    this.logger.log({
      msg: "Listing workbooks",
      operation: "listWorkbooksPaginated",
      page,
      pageSize,
      hasSearch: !!filter?.search,
    });
    const paged = await this.workbookRepository.findPage(page, pageSize, filter);
    if (paged.isFailure()) {
      return paged;
    }

    // The page has already passed the access check, so the series are read
    // for exactly these rows rather than for the whole workspace.
    const series = await this.resourceMetrics.seriesFor(
      "workbook",
      paged.value.items.map((item) => item.id),
    );

    return success({
      items: paged.value.items.map((item) => ({
        ...item,
        activity: series.get(item.id) ?? null,
      })),
      totalCount: paged.value.totalCount,
    });
  }
}
