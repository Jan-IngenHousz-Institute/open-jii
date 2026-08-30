import { Injectable } from "@nestjs/common";

import type {
  ResourceKind,
  ResourceMetricsResponse,
} from "@repo/api/domains/metrics/metrics.schema";

import { failure, success } from "../../../../common/utils/fp-utils";
import type { Result } from "../../../../common/utils/fp-utils";
import { MetricsRepository } from "../../../core/repositories/metrics.repository";
import {
  RESOURCE_METRICS_WINDOW_DAYS,
  ResourceMetricsService,
} from "../../resource-metrics.service";

/**
 * What a list page's header states: how much of this kind is collecting, and
 * how much it recorded, across everything the caller may read. The per-row
 * series ride on the rows themselves.
 */
@Injectable()
export class GetResourceMetricsUseCase {
  constructor(
    private readonly metricsRepository: MetricsRepository,
    private readonly resourceMetrics: ResourceMetricsService,
  ) {}

  async execute(kind: ResourceKind, userId: string): Promise<Result<ResourceMetricsResponse>> {
    const visible = await this.visibleIds(kind, userId);
    if (visible.isFailure()) {
      return failure(visible.error);
    }

    const totals = await this.resourceMetrics.totalsFor(kind, visible.value);

    return success({
      kind,
      totalMeasurements: totals.measurements,
      activeCount: totals.activeCount,
      windowDays: RESOURCE_METRICS_WINDOW_DAYS,
      computedAt: null,
    });
  }

  /** The same predicate each list page filters with, so the header agrees with the rows. */
  private async visibleIds(kind: ResourceKind, userId: string): Promise<Result<string[]>> {
    switch (kind) {
      case "protocol":
        return this.metricsRepository.getVisibleProtocolIds(userId);
      case "macro":
        return this.metricsRepository.getVisibleMacroIds(userId);
      case "workbook":
        return this.metricsRepository.getVisibleWorkbookIds(userId);
      case "experiment":
        return this.metricsRepository.getVisibleExperimentIds(userId);
    }
  }
}
