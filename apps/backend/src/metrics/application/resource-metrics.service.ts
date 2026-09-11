import { Inject, Injectable, Logger } from "@nestjs/common";

import type { MetricsWindowDay, ResourceKind } from "@repo/api/domains/metrics/metrics.schema";

import { CACHE_PORT, CachePort } from "../core/ports/cache.port";
import { METRICS_DATABRICKS_PORT } from "../core/ports/databricks.port";
import type { DatabricksPort, ResourceDailyRow } from "../core/ports/databricks.port";
import { MetricsRepository } from "../core/repositories/metrics.repository";

export const RESOURCE_METRICS_WINDOW_DAYS = 30;

// Two windows in one read: the header compares against the previous one.
const LOADED_DAYS = RESOURCE_METRICS_WINDOW_DAYS * 2;

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
  days: MetricsWindowDay[];
}

/** The window's totals and its shape, across a set of resources. */
export interface ResourceTotals {
  measurements: number;
  previousMeasurements: number;
  activeCount: number;
  activeDays: number;
  peak: MetricsWindowDay | null;
  lastActivityDate: string | null;
  /** The id that recorded most this window; the name is Postgres's to supply. */
  busiest: { id: string; measurements: number } | null;
  days: MetricsWindowDay[];
}

/**
 * Daily measurement series per resource. Callers pass ids that already passed
 * their own access check, so this service does not repeat it.
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

    const series = new Map<string, ResourceSeries>();

    for (const [id, days] of byResource) {
      const dense = this.densify(days);
      series.set(id, {
        measurements: dense.reduce((sum, day) => sum + day.measurements, 0),
        days: dense,
      });
    }

    return series;
  }

  /** The window's shape across the resources of this kind the caller may read. */
  async totalsFor(kind: ResourceKind, visibleIds: string[]): Promise<ResourceTotals> {
    if (visibleIds.length === 0) {
      return this.emptyTotals();
    }

    const rows = await this.cachePort.tryCache(resourceMetricsCacheKey(kind), () =>
      this.loadRows(kind),
    );
    if (rows === null) {
      return this.emptyTotals();
    }

    const attributed = await this.attributeToResources(kind, rows, visibleIds);
    const visible = new Set(visibleIds);
    const previousDates = new Set(this.windowDates(1));

    const byDate = new Map<string, number>();
    const byResource = new Map<string, number>();
    let previousMeasurements = 0;

    for (const row of attributed) {
      if (!visible.has(row.resourceId)) {
        continue;
      }

      if (previousDates.has(row.date)) {
        previousMeasurements += row.measurements;
        continue;
      }

      byResource.set(row.resourceId, (byResource.get(row.resourceId) ?? 0) + row.measurements);
      byDate.set(row.date, (byDate.get(row.date) ?? 0) + row.measurements);
    }

    return this.totals(this.densify(byDate), previousMeasurements, byResource);
  }

  private emptyTotals(): ResourceTotals {
    return this.totals(this.densify(new Map()), 0, new Map());
  }

  private totals(
    days: MetricsWindowDay[],
    previousMeasurements: number,
    byResource: Map<string, number>,
  ): ResourceTotals {
    const active = days.filter((day) => day.measurements > 0);

    const busiest = Array.from(byResource.entries()).reduce<{
      id: string;
      measurements: number;
    } | null>(
      (best, [id, measurements]) =>
        best === null || measurements > best.measurements ? { id, measurements } : best,
      null,
    );

    const peak = active.reduce<MetricsWindowDay | null>(
      (best, day) => (best === null || day.measurements > best.measurements ? day : best),
      null,
    );

    return {
      measurements: days.reduce((sum, day) => sum + day.measurements, 0),
      previousMeasurements,
      activeCount: byResource.size,
      activeDays: active.length,
      peak,
      lastActivityDate: active.length > 0 ? active[active.length - 1].date : null,
      busiest,
      days,
    };
  }

  private async loadRows(kind: ResourceKind): Promise<ResourceDailyRow[] | null> {
    const rows =
      kind === "experiment"
        ? await this.experimentRows()
        : await this.databricksPort.getResourceDailyActivity(WAREHOUSE_TYPE[kind], LOADED_DAYS);

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
    const scoped = await this.databricksPort.getScopedDailyActivity(LOADED_DAYS);
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

  /** Silent days keep a zero, so every series over the window is the same length. */
  private densify(totals: Map<string, number>): MetricsWindowDay[] {
    return this.windowDates().map((date) => ({
      date,
      measurements: totals.get(date) ?? 0,
    }));
  }

  /** Day keys oldest first; offset 1 is the window immediately before the current one. */
  private windowDates(offset = 0): string[] {
    const dayMs = 24 * 60 * 60 * 1000;
    const end = Date.now() - offset * RESOURCE_METRICS_WINDOW_DAYS * dayMs;

    return Array.from({ length: RESOURCE_METRICS_WINDOW_DAYS }, (_, index) =>
      new Date(end - (RESOURCE_METRICS_WINDOW_DAYS - 1 - index) * dayMs).toISOString().slice(0, 10),
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
}
