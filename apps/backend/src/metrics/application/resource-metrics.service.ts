import { Inject, Injectable, Logger } from "@nestjs/common";

import type { ResourceKind } from "@repo/api/domains/metrics/metrics.schema";

import { CACHE_PORT, CachePort } from "../core/ports/cache.port";
import { METRICS_DATABRICKS_PORT } from "../core/ports/databricks.port";
import type { DatabricksPort, ResourceDailyRow } from "../core/ports/databricks.port";
import { MetricsRepository } from "../core/repositories/metrics.repository";

export const RESOURCE_METRICS_WINDOW_DAYS = 30;

/** The warehouse keys workbook activity by the version that produced it. */
const WAREHOUSE_TYPE: Record<ResourceKind, string> = {
  experiment: "experiment",
  protocol: "protocol",
  macro: "macro",
  workbook: "workbook_version",
};

export const resourceMetricsCacheKey = (kind: ResourceKind) => `resource-metrics-${kind}`;

export interface ResourceSeries {
  measurements: number;
  days: { date: string; measurements: number }[];
}

/**
 * Daily measurement series per resource, for the list pages.
 *
 * Callers pass the ids of the rows they are already returning, so the work is
 * proportional to a page rather than to the workspace. Those ids have passed
 * the caller's own access check by the time they arrive here, which is why this
 * service does not repeat it.
 */
@Injectable()
export class ResourceMetricsService {
  private readonly logger = new Logger(ResourceMetricsService.name);

  constructor(
    @Inject(METRICS_DATABRICKS_PORT)
    private readonly databricksPort: DatabricksPort,
    @Inject(CACHE_PORT)
    private readonly cachePort: CachePort,
    private readonly metricsRepository: MetricsRepository,
  ) {}

  /** Series keyed by resource id; a resource with no activity is absent. */
  async seriesFor(kind: ResourceKind, ids: string[]): Promise<Map<string, ResourceSeries>> {
    if (ids.length === 0) {
      return new Map();
    }

    const rows = await this.cachePort.tryCache(resourceMetricsCacheKey(kind), () =>
      this.loadRows(kind),
    );
    if (rows === null) {
      return new Map();
    }

    const attributed = await this.attributeToResources(kind, rows, ids);
    const wanted = new Set(ids);
    const byResource = new Map<string, Map<string, number>>();

    for (const row of attributed) {
      if (!wanted.has(row.resourceId)) {
        continue;
      }
      const days = byResource.get(row.resourceId) ?? new Map<string, number>();
      days.set(row.date, (days.get(row.date) ?? 0) + row.measurements);
      byResource.set(row.resourceId, days);
    }

    // Every resource spans the same window: a sparkline is read by its shape,
    // and a series that skipped silent days would draw a different length.
    const window = this.windowDates();
    const series = new Map<string, ResourceSeries>();

    for (const [id, days] of byResource) {
      const dense = window.map((date) => ({ date, measurements: days.get(date) ?? 0 }));
      series.set(id, {
        measurements: dense.reduce((sum, day) => sum + day.measurements, 0),
        days: dense,
      });
    }

    return series;
  }

  /** Totals across the resources of this kind the caller may read. */
  async totalsFor(
    kind: ResourceKind,
    visibleIds: string[],
  ): Promise<{ measurements: number; activeCount: number }> {
    if (visibleIds.length === 0) {
      return { measurements: 0, activeCount: 0 };
    }

    const rows = await this.cachePort.tryCache(resourceMetricsCacheKey(kind), () =>
      this.loadRows(kind),
    );
    if (rows === null) {
      return { measurements: 0, activeCount: 0 };
    }

    const attributed = await this.attributeToResources(kind, rows, visibleIds);
    const visible = new Set(visibleIds);
    const active = new Set<string>();
    let measurements = 0;

    for (const row of attributed) {
      if (!visible.has(row.resourceId)) {
        continue;
      }
      active.add(row.resourceId);
      measurements += row.measurements;
    }

    return { measurements, activeCount: active.size };
  }

  private async loadRows(kind: ResourceKind): Promise<ResourceDailyRow[] | null> {
    const rows =
      kind === "experiment"
        ? await this.experimentRows()
        : await this.databricksPort.getResourceDailyActivity(
            WAREHOUSE_TYPE[kind],
            RESOURCE_METRICS_WINDOW_DAYS,
          );

    if (rows.isFailure()) {
      this.logger.warn({
        msg: "Warehouse unavailable for resource metrics",
        operation: "loadRows",
        kind,
      });
      return null;
    }

    return rows.value;
  }

  /** Experiments predate the per-resource table and keep their own. */
  private async experimentRows() {
    const scoped = await this.databricksPort.getScopedDailyActivity(RESOURCE_METRICS_WINDOW_DAYS);
    if (scoped.isFailure()) {
      return scoped;
    }

    return scoped.map((rows) =>
      rows.map((row) => ({
        date: row.date,
        resourceType: "experiment",
        resourceId: row.experimentId,
        measurements: row.measurements,
      })),
    );
  }

  /** Workbook rows arrive keyed by version and fold onto their workbook. */
  private async attributeToResources(
    kind: ResourceKind,
    rows: ResourceDailyRow[],
    workbookIds: string[],
  ): Promise<ResourceDailyRow[]> {
    if (kind !== "workbook") {
      return rows;
    }

    const versions = await this.metricsRepository.getWorkbookVersionMap(workbookIds);
    if (versions.isFailure()) {
      return [];
    }

    const owned: ResourceDailyRow[] = [];
    for (const row of rows) {
      const workbookId = versions.value.get(row.resourceId);
      if (workbookId !== undefined) {
        owned.push({ ...row, resourceId: workbookId });
      }
    }

    return owned;
  }

  private windowDates(): string[] {
    const today = new Date();
    const dayMs = 24 * 60 * 60 * 1000;

    return Array.from({ length: RESOURCE_METRICS_WINDOW_DAYS }, (_, offset) =>
      new Date(today.getTime() - (RESOURCE_METRICS_WINDOW_DAYS - 1 - offset) * dayMs)
        .toISOString()
        .slice(0, 10),
    );
  }
}
