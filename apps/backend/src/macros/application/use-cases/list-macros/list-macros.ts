import { Injectable, Logger } from "@nestjs/common";

import type { ResourceSeries } from "@repo/api/domains/metrics/metrics.schema";

import { Result, success } from "../../../../common/utils/fp-utils";
import { ResourceMetricsService } from "../../../../metrics/application/resource-metrics.service";
import { MacroDto } from "../../../core/models/macro.model";
import { MacroRepository, MacroFilter } from "../../../core/repositories/macro.repository";

/** A listed resource plus the measurement series its row draws. */
type MacroWithActivity = MacroDto & { activity: ResourceSeries | null };

@Injectable()
export class ListMacrosUseCase {
  private readonly logger = new Logger(ListMacrosUseCase.name);

  constructor(
    private readonly macroRepository: MacroRepository,
    private readonly resourceMetrics: ResourceMetricsService,
  ) {}

  async execute(filter?: MacroFilter): Promise<Result<MacroDto[]>> {
    this.logger.log({
      msg: "Listing macros",
      operation: "listMacros",
      language: filter?.language,
      hasSearch: !!filter?.search,
    });
    return await this.macroRepository.findAll(filter);
  }

  async executePaginated(
    page: number,
    pageSize: number,
    filter?: MacroFilter,
  ): Promise<Result<{ items: MacroWithActivity[]; totalCount: number }>> {
    this.logger.log({
      msg: "Listing macros",
      operation: "listMacrosPaginated",
      page,
      pageSize,
      language: filter?.language,
      hasSearch: !!filter?.search,
    });
    const paged = await this.macroRepository.findPage(page, pageSize, filter);
    if (paged.isFailure()) {
      return paged;
    }

    // The page has already passed the access check, so the series are read
    // for exactly these rows rather than for the whole workspace.
    const series = await this.resourceMetrics.seriesFor(
      "macro",
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
