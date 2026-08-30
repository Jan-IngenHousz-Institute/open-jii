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

  async execute(kind: ResourceKind, userId: string): Promise<Result<ResourceActivityResponse>> {
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

    return success(this.aggregate(kind, owned.value, new Set(visible.value)));
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
        return this.metricsRepository.getUserExperimentIds(userId);
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

  private aggregate(
    kind: ResourceKind,
    rows: ResourceDailyRow[],
    visible: Set<string>,
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

    const resources = Array.from(byResource.entries()).map(([id, days]) => {
      const series = Array.from(days.entries())
        .map(([date, measurements]) => ({ date, measurements }))
        .sort((a, b) => a.date.localeCompare(b.date));

      return {
        id,
        measurements: series.reduce((sum, day) => sum + day.measurements, 0),
        days: series,
      };
    });

    return {
      kind,
      resources,
      totalMeasurements: resources.reduce((sum, resource) => sum + resource.measurements, 0),
      activeCount: resources.length,
      windowDays: WINDOW_DAYS,
      computedAt: null,
    };
  }
}
