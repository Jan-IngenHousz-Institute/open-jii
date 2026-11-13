import { Injectable } from "@nestjs/common";

import type { ResourceSeries } from "@repo/api/domains/metrics/metrics.schema";
import type { ProtocolFilter, ProtocolSort } from "@repo/api/domains/protocol/protocol.schema";
import type { ResourceScope } from "@repo/api/shared/listing";

import { sortsByActivity, withoutActivity } from "../../../../common/utils/activity-sort";
import { Result, success } from "../../../../common/utils/fp-utils";
import { ResourceMetricsService } from "../../../../metrics/application/resource-metrics.service";
import { ProtocolDto } from "../../../core/models/protocol.model";
import type { ProtocolListFilter } from "../../../core/repositories/protocol.repository";
import { ProtocolRepository } from "../../../core/repositories/protocol.repository";

type ProtocolWithActivity = ProtocolDto & {
  activity: ResourceSeries | null;
  compatibleMacroCount: number;
};

@Injectable()
export class ListProtocolsUseCase {
  constructor(
    private readonly protocolRepository: ProtocolRepository,
    private readonly resourceMetrics: ResourceMetricsService,
  ) {}

  async execute(
    search?: ProtocolFilter,
    scope?: ResourceScope,
    userId?: string,
    sort?: ProtocolSort,
    filter?: ProtocolListFilter,
  ): Promise<Result<ProtocolDto[]>> {
    const snapshot = sortsByActivity(sort)
      ? await this.resourceMetrics.activitySnapshot("protocol")
      : undefined;
    const activeSort = snapshot === null ? withoutActivity(sort) : sort;
    return this.protocolRepository.findAll(
      search,
      scope,
      userId,
      undefined,
      undefined,
      activeSort,
      filter,
      sortsByActivity(activeSort) ? snapshot?.totals : undefined,
    );
  }

  async executePaginated(
    page: number,
    pageSize: number,
    search?: ProtocolFilter,
    scope?: ResourceScope,
    userId?: string,
    sort?: ProtocolSort,
    filter?: ProtocolListFilter,
  ): Promise<
    Result<{ items: ProtocolWithActivity[]; totalCount: number; activityAvailable: boolean }>
  > {
    const snapshot = await this.resourceMetrics.activitySnapshot("protocol");
    const activeSort = snapshot === null ? withoutActivity(sort) : sort;
    const paged = await this.protocolRepository.findPage(
      page,
      pageSize,
      search,
      scope,
      userId,
      undefined,
      activeSort,
      filter,
      sortsByActivity(activeSort) ? snapshot?.totals : undefined,
    );
    if (paged.isFailure()) {
      return paged;
    }

    // These ids already passed the access check.
    const series =
      snapshot?.seriesFor(paged.value.items.map((item) => item.id)) ??
      new Map<string, ResourceSeries>();

    return success({
      items: paged.value.items.map((item) => ({
        ...item,
        activity: series.get(item.id) ?? null,
      })),
      totalCount: paged.value.totalCount,
      activityAvailable: snapshot !== null,
    });
  }
}
