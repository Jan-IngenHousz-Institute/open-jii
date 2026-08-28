import { Inject, Injectable, Logger } from "@nestjs/common";

import type { MetricsScope, ScopedMetricsResponse } from "@repo/api/domains/metrics/metrics.schema";

import { AppError, failure, success } from "../../../../common/utils/fp-utils";
import type { Result } from "../../../../common/utils/fp-utils";
import { CACHE_PORT, CachePort } from "../../../core/ports/cache.port";
import { METRICS_DATABRICKS_PORT } from "../../../core/ports/databricks.port";
import type { DatabricksPort } from "../../../core/ports/databricks.port";
import { MetricsRepository } from "../../../core/repositories/metrics.repository";

const WINDOW_DAYS = 30;

/**
 * Org- and user-scoped activity: per-experiment warehouse rows are joined
 * against Postgres ownership/membership here, aggregated to the requested
 * scope, and served with the platform baseline for comparison. The
 * experiment- and user-grain inputs never leave this use case unaggregated.
 */
@Injectable()
export class GetScopedMetricsUseCase {
  private readonly logger = new Logger(GetScopedMetricsUseCase.name);

  constructor(
    @Inject(METRICS_DATABRICKS_PORT)
    private readonly databricksPort: DatabricksPort,
    @Inject(CACHE_PORT)
    private readonly cachePort: CachePort,
    private readonly metricsRepository: MetricsRepository,
  ) {}

  async execute(
    scope: MetricsScope,
    userId: string,
    organizationId?: string,
  ): Promise<Result<ScopedMetricsResponse>> {
    if (scope === "organization") {
      if (organizationId === undefined) {
        return failure(AppError.badRequest("organizationId is required for organization scope"));
      }

      const membership = await this.metricsRepository.isOrganizationMember(userId, organizationId);
      if (membership.isFailure()) {
        return membership;
      }
      if (!membership.value) {
        return failure(AppError.forbidden("Not a member of this organization"));
      }
    }

    const cacheKey =
      scope === "organization" ? `scoped-org-${organizationId}` : `scoped-user-${userId}`;

    const snapshot = await this.cachePort.tryCache(cacheKey, () =>
      this.load(scope, userId, organizationId),
    );

    if (snapshot === null) {
      return failure(AppError.internal("Scoped metrics are unavailable"));
    }

    return success(snapshot);
  }

  private async load(
    scope: MetricsScope,
    userId: string,
    organizationId?: string,
  ): Promise<ScopedMetricsResponse | null> {
    const experimentIds =
      scope === "organization" && organizationId !== undefined
        ? await this.metricsRepository.getOrganizationExperimentIds(organizationId)
        : await this.metricsRepository.getUserExperimentIds(userId);

    if (experimentIds.isFailure()) {
      this.logger.error({
        msg: "Could not resolve experiments for scope",
        operation: "load",
        scope,
        error: experimentIds.error,
      });
      return null;
    }

    const [scopedDaily, contributorPairs, windows] = await Promise.all([
      this.databricksPort.getScopedDailyActivity(WINDOW_DAYS),
      this.databricksPort.getContributorPairs(),
      this.databricksPort.getActivityWindows(),
    ]);

    if (scopedDaily.isFailure() || windows.isFailure() || windows.value === null) {
      this.logger.warn({ msg: "Warehouse unavailable for scoped metrics", operation: "load" });
      return null;
    }

    const scopeIds = new Set(experimentIds.value);
    const rows = scopedDaily.value.filter((row) => scopeIds.has(row.experimentId));

    const byDate = new Map<string, number>();
    for (const row of rows) {
      byDate.set(row.date, (byDate.get(row.date) ?? 0) + row.measurements);
    }
    const activity = Array.from(byDate.entries())
      .map(([date, measurements]) => ({ date, measurements }))
      .sort((a, b) => a.date.localeCompare(b.date));

    const measurements30d = rows.reduce((sum, row) => sum + row.measurements, 0);
    const activeExperiments = new Set(rows.map((row) => row.experimentId));

    const contributors = contributorPairs.isSuccess()
      ? new Set(
          contributorPairs.value
            .filter((pair) => scopeIds.has(pair.experimentId))
            .map((pair) => pair.userId),
        ).size
      : 0;

    const lastDate = activity.length > 0 ? activity[activity.length - 1].date : null;
    const baseline = windows.value;

    return {
      scope,
      scoped: {
        measurements30d,
        activeExperiments30d: activeExperiments.size,
        contributors30d: contributors,
        activity,
        lastMeasurementAt: lastDate,
        // Scoped rows are date-grain; a 24h count is not derivable from them.
        measurements24h: null,
      },
      baseline: {
        measurements30d: baseline.measurements30d,
        activeExperiments30d: baseline.experiments30d,
      },
      computedAt: baseline.computedAt,
    };
  }
}
