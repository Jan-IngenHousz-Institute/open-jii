import { Injectable } from "@nestjs/common";

import type {
  BusiestResource,
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

/** What a list page's header states. The per-row series ride on the rows themselves. */
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
    const busiest = await this.nameBusiest(kind, totals.busiest);

    return success({
      kind,
      totalMeasurements: totals.measurements,
      previousMeasurements: totals.previousMeasurements,
      activeCount: totals.activeCount,
      visibleCount: visible.value.length,
      activeDays: totals.activeDays,
      peak: totals.peak,
      lastActivityDate: totals.lastActivityDate,
      busiest,
      days: totals.days,
      windowDays: RESOURCE_METRICS_WINDOW_DAYS,
    });
  }

  /** A resource deleted since the pipeline ran would surface as a bare id. */
  private async nameBusiest(
    kind: ResourceKind,
    busiest: { id: string; measurements: number } | null,
  ): Promise<BusiestResource | null> {
    if (busiest === null) {
      return null;
    }

    const name = await this.metricsRepository.getResourceName(kind, busiest.id);
    if (name.isFailure() || name.value === null) {
      return null;
    }

    return { id: busiest.id, name: name.value, measurements: busiest.measurements };
  }

  /** The same predicate the list pages filter with, so header and rows agree. */
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
