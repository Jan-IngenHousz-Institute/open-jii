import { Inject, Injectable, Logger } from "@nestjs/common";

import type {
  ResourceActivityResponse,
  ResourceKind,
} from "@repo/api/domains/metrics/metrics.schema";

import { failure, success } from "../../../../common/utils/fp-utils";
import type { Result } from "../../../../common/utils/fp-utils";
import { CACHE_PORT, CachePort } from "../../../core/ports/cache.port";
import { METRICS_DATABRICKS_PORT } from "../../../core/ports/databricks.port";
import type { DatabricksPort, ResourceDailyRow } from "../../../core/ports/databricks.port";
import { MetricsRepository } from "../../../core/repositories/metrics.repository";

const WINDOW_DAYS = 30;

/**
 * The warehouse keys workbook activity by the version that produced it, so the
 * kind a list page asks for is not always the kind the table stores.
 */
const WAREHOUSE_TYPE: Record<ResourceKind, string> = {
  experiment: "experiment",
  protocol: "protocol",
  macro: "macro",
  workbook: "workbook_version",
};

export const resourceActivityCacheKey = (kind: ResourceKind) => `resource-activity-${kind}`;

/**
 * Per-resource activity for a list page. Warehouse rows are intersected with
 * the resources the caller may read before anything is returned, so the strips
 * never reveal a resource the list itself would not show.
 */
@Injectable()
export class GetResourceActivityUseCase {
  private readonly logger = new Logger(GetResourceActivityUseCase.name);

  constructor(
    @Inject(METRICS_DATABRICKS_PORT)
    private readonly databricksPort: DatabricksPort,
    @Inject(CACHE_PORT)
    private readonly cachePort: CachePort,
    private readonly metricsRepository: MetricsRepository,
  ) {}

  async execute(
    kind: ResourceKind,
    userId: string,
    ids?: string[],
  ): Promise<Result<ResourceActivityResponse>> {
    const visible = await this.visibleIds(kind, userId);
    if (visible.isFailure()) {
      return visible;
    }

    const rows = await this.cachePort.tryCache(resourceActivityCacheKey(kind), () =>
      this.loadRows(kind),
    );

    const empty: ResourceActivityResponse = {
      kind,
      resources: [],
      totalMeasurements: 0,
      activeCount: 0,
      windowDays: WINDOW_DAYS,
      computedAt: null,
    };

    if (rows === null) {
      // A lagging warehouse leaves the strips empty rather than the page broken.
      return success(empty);
    }

    const owned = await this.attributeToResources(kind, rows, visible.value);
    if (owned.isFailure()) {
      return failure(owned.error);
    }

    return success(this.aggregate(kind, owned.value, new Set(visible.value), ids));
  }

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

  private async loadRows(kind: ResourceKind): Promise<ResourceDailyRow[] | null> {
    const rows =
      kind === "experiment"
        ? await this.experimentRows()
        : await this.databricksPort.getResourceDailyActivity(WAREHOUSE_TYPE[kind], WINDOW_DAYS);

    if (rows.isFailure()) {
      this.logger.warn({
        msg: "Warehouse unavailable for resource activity",
        operation: "loadRows",
        kind,
      });
      return null;
    }

    return rows.value;
  }

  /** Experiments predate the per-resource table and keep their own. */
  private async experimentRows(): Promise<Result<ResourceDailyRow[]>> {
    const scoped = await this.databricksPort.getScopedDailyActivity(WINDOW_DAYS);
    if (scoped.isFailure()) {
      return scoped;
    }

    return success(
      scoped.value.map((row) => ({
        date: row.date,
        resourceType: "experiment",
        resourceId: row.experimentId,
        measurements: row.measurements,
      })),
    );
  }

  /** Workbook rows arrive keyed by version and are folded onto their workbook. */
  private async attributeToResources(
    kind: ResourceKind,
    rows: ResourceDailyRow[],
    visibleIds: string[],
  ): Promise<Result<ResourceDailyRow[]>> {
    if (kind !== "workbook") {
      return success(rows);
    }

    const versions = await this.metricsRepository.getWorkbookVersionMap(visibleIds);
    if (versions.isFailure()) {
      return failure(versions.error);
    }

    const owned: ResourceDailyRow[] = [];
    for (const row of rows) {
      const workbookId = versions.value.get(row.resourceId);
      if (workbookId !== undefined) {
        owned.push({ ...row, resourceId: workbookId });
      }
    }

    return success(owned);
  }

  /** The window's dates, oldest first, matching the warehouse read's range. */
  private windowDates(): string[] {
    const today = new Date();
    const dayMs = 24 * 60 * 60 * 1000;

    return Array.from({ length: WINDOW_DAYS }, (_, offset) =>
      new Date(today.getTime() - (WINDOW_DAYS - 1 - offset) * dayMs).toISOString().slice(0, 10),
    );
  }

  private aggregate(
    kind: ResourceKind,
    rows: ResourceDailyRow[],
    visible: Set<string>,
    requested: string[] | undefined,
  ): ResourceActivityResponse {
    const byResource = new Map<string, Map<string, number>>();

    for (const row of rows) {
      if (!visible.has(row.resourceId)) {
        continue;
      }
      const days = byResource.get(row.resourceId) ?? new Map<string, number>();
      days.set(row.date, (days.get(row.date) ?? 0) + row.measurements);
      byResource.set(row.resourceId, days);
    }

    // Every resource spans the same window: a strip is read by its shape, and
    // a series that skipped silent days would draw a different length per row.
    const window = this.windowDates();

    const resources = Array.from(byResource.entries()).map(([id, days]) => {
      const series = window.map((date) => ({ date, measurements: days.get(date) ?? 0 }));

      return {
        id,
        measurements: series.reduce((sum, day) => sum + day.measurements, 0),
        days: series,
      };
    });

    // The header describes everything visible; only the series are narrowed to
    // the rows that asked for them.
    const onScreen =
      requested === undefined ? resources : resources.filter((r) => requested.includes(r.id));

    return {
      kind,
      resources: onScreen,
      totalMeasurements: resources.reduce((sum, resource) => sum + resource.measurements, 0),
      activeCount: resources.length,
      windowDays: WINDOW_DAYS,
      computedAt: null,
    };
  }
}
