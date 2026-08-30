import { Injectable } from "@nestjs/common";

import type { ResourceSeries } from "@repo/api/domains/metrics/metrics.schema";
import { ProtocolFilter } from "@repo/api/domains/protocol/protocol.schema";
import type { ResourceScope } from "@repo/api/shared/listing";

import { Result, success } from "../../../../common/utils/fp-utils";
import { ResourceMetricsService } from "../../../../metrics/application/resource-metrics.service";
import { ProtocolDto } from "../../../core/models/protocol.model";
import { ProtocolRepository } from "../../../core/repositories/protocol.repository";

/** A listed protocol plus the measurement series its row draws. */
type ProtocolWithActivity = ProtocolDto & { activity: ResourceSeries | null };

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
  ): Promise<Result<ProtocolDto[]>> {
    return this.protocolRepository.findAll(search, scope, userId);
  }

  async executePaginated(
    page: number,
    pageSize: number,
    search?: ProtocolFilter,
    scope?: ResourceScope,
    userId?: string,
  ): Promise<Result<{ items: ProtocolWithActivity[]; totalCount: number }>> {
    const paged = await this.protocolRepository.findPage(page, pageSize, search, scope, userId);
    if (paged.isFailure()) {
      return paged;
    }

    // The page has already passed the access check, so the series are read
    // for exactly these rows rather than for the whole workspace.
    const series = await this.resourceMetrics.seriesFor(
      "protocol",
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
