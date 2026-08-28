import { Inject, Injectable, Logger } from "@nestjs/common";

import type {
  MetricsCaption,
  PublicMetricsResponse,
} from "@repo/api/domains/metrics/metrics.schema";

import { AppError, failure, success } from "../../../../common/utils/fp-utils";
import type { Result } from "../../../../common/utils/fp-utils";
import type {
  ActivityWindowsRow,
  DailyActivityRow,
  PlatformTotalsRow,
  PoolFactsRow,
} from "../../../core/models/public-metrics.model";
import { CACHE_PORT, CachePort } from "../../../core/ports/cache.port";
import { METRICS_DATABRICKS_PORT } from "../../../core/ports/databricks.port";
import type { DatabricksPort } from "../../../core/ports/databricks.port";
import { MetricsRepository } from "../../../core/repositories/metrics.repository";

export const PUBLIC_METRICS_CACHE_KEY = "public-snapshot";

const DAILY_ACTIVITY_DAYS = 366;
const WINDOW_DAYS = 30;

// Milestone thresholds follow the 1-2-5 decade pattern.
const MILESTONE_STEPS = [1, 2, 5];

/**
 * Serves the public metrics snapshot behind the read-through cache so
 * anonymous page views never fan out to the warehouse directly. Warehouse
 * reads degrade gracefully (the tables lag one pipeline refresh and may not
 * exist before the first run); an empty snapshot is still a valid response.
 */
@Injectable()
export class GetPublicMetricsUseCase {
  private readonly logger = new Logger(GetPublicMetricsUseCase.name);

  constructor(
    @Inject(METRICS_DATABRICKS_PORT)
    private readonly databricksPort: DatabricksPort,
    @Inject(CACHE_PORT)
    private readonly cachePort: CachePort,
    private readonly metricsRepository: MetricsRepository,
  ) {}

  async execute(): Promise<Result<PublicMetricsResponse>> {
    const snapshot = await this.cachePort.tryCache(PUBLIC_METRICS_CACHE_KEY, () => this.load());

    if (snapshot === null) {
      return failure(AppError.internal("Public metrics are unavailable"));
    }

    return success(snapshot);
  }

  private async load(): Promise<PublicMetricsResponse | null> {
    const [
      totals,
      daily,
      families,
      windows,
      hourly,
      derivedParameter,
      sensorParameter,
      poolFacts,
      contributorPairs,
    ] = await Promise.all([
      this.databricksPort.getPublicPlatformTotals(),
      this.databricksPort.getPublicDailyActivity(DAILY_ACTIVITY_DAYS),
      this.databricksPort.getPublicFamilyTotals(),
      this.databricksPort.getActivityWindows(),
      this.databricksPort.getHourlyActivity(),
      this.databricksPort.getTopParameter("derived"),
      this.databricksPort.getTopParameter("sensor"),
      this.databricksPort.getPoolFacts(),
      this.databricksPort.getContributorPairs(),
    ]);

    const failures = [
      totals,
      daily,
      families,
      windows,
      hourly,
      derivedParameter,
      sensorParameter,
      poolFacts,
    ].filter((result) => result.isFailure());
    if (failures.length > 0) {
      this.logger.warn({
        msg: "Some warehouse metrics are unavailable, serving a partial snapshot",
        operation: "load",
        unavailable: failures.length,
      });
    }

    const totalsRow = totals.isSuccess() ? totals.value : null;
    const dailyRows = daily.isSuccess() ? daily.value : [];
    const windowsRow = windows.isSuccess() ? windows.value : null;
    const poolRow = poolFacts.isSuccess() ? poolFacts.value : null;

    const institutions = await this.countInstitutions(
      contributorPairs.isSuccess() ? contributorPairs.value.map((pair) => pair.experimentId) : [],
    );

    return {
      hero: this.buildHero(totalsRow, dailyRows, poolRow),
      liveness: windowsRow
        ? {
            lastMeasurementAt: windowsRow.lastMeasurementAt,
            measurements24h: windowsRow.measurements24h,
          }
        : null,
      community: windowsRow
        ? {
            measurements30d: windowsRow.measurements30d,
            activeExperiments30d: windowsRow.experiments30d,
            contributors30d: windowsRow.contributors30d,
            institutions30d: institutions,
          }
        : null,
      activity: dailyRows,
      hourly: hourly.isSuccess() ? hourly.value : [],
      families: families.isSuccess() ? families.value : [],
      derivedParameter: derivedParameter.isSuccess() ? derivedParameter.value : null,
      sensorParameter: sensorParameter.isSuccess() ? sensorParameter.value : null,
      captions: await this.buildCaptions(totalsRow, dailyRows, windowsRow, poolRow),
      computedAt: windowsRow?.computedAt ?? totalsRow?.computedAt ?? null,
    };
  }

  private buildHero(
    totals: PlatformTotalsRow | null,
    daily: DailyActivityRow[],
    poolFacts: PoolFactsRow | null,
  ) {
    if (totals === null) {
      return null;
    }

    const totalVolumeBytes = daily.reduce((sum, row) => sum + row.volumeBytes, 0);

    return {
      totalMeasurements: totals.totalMeasurements,
      totalVolumeBytes,
      timezonesSpanned: poolFacts?.timezonesAllTime ?? 0,
    };
  }

  private async countInstitutions(activeExperimentIds: string[]): Promise<number> {
    const organizations = await this.metricsRepository.getExperimentOrganizations(
      Array.from(new Set(activeExperimentIds)),
    );
    if (organizations.isFailure()) {
      return 0;
    }

    const distinct = new Set(
      organizations.value
        .map((row) => row.organizationId)
        .filter((organizationId) => organizationId !== null),
    );
    return distinct.size;
  }

  private async buildCaptions(
    totals: PlatformTotalsRow | null,
    daily: DailyActivityRow[],
    windows: ActivityWindowsRow | null,
    poolFacts: PoolFactsRow | null,
  ): Promise<MetricsCaption[]> {
    const captions: MetricsCaption[] = [];

    const streak = this.currentStreakDays(daily);
    if (streak > 1) {
      captions.push({ kind: "streak", days: streak });
    }

    if (windows !== null && windows.measurements30d > 0) {
      const windowSeconds = WINDOW_DAYS * 24 * 60 * 60;
      captions.push({
        kind: "pace",
        secondsPerMeasurement: Math.round(windowSeconds / windows.measurements30d),
      });
    }

    if (poolFacts?.sessionMedianMeasurements != null) {
      captions.push({
        kind: "sessionSize",
        medianMeasurements: poolFacts.sessionMedianMeasurements,
      });
    }
    if (poolFacts?.deviceEnduranceDays != null && poolFacts.deviceEnduranceDays > 1) {
      captions.push({ kind: "endurance", days: poolFacts.deviceEnduranceDays });
    }
    if (poolFacts?.simultaneityPeakDevices != null && poolFacts.simultaneityPeakDevices > 1) {
      captions.push({ kind: "simultaneity", devices: poolFacts.simultaneityPeakDevices });
    }
    if (poolFacts?.timezonesPeakDay != null && poolFacts.timezonesPeakDay > 1) {
      captions.push({ kind: "zonesPeakDay", zones: poolFacts.timezonesPeakDay });
    }

    if (totals !== null && totals.totalMacroExecutions > 0) {
      captions.push({ kind: "analysesRun", count: totals.totalMacroExecutions });
    }
    if (totals !== null && totals.totalMeasurements > 0) {
      const totalVolumeBytes = daily.reduce((sum, row) => sum + row.volumeBytes, 0);
      if (totalVolumeBytes > 0) {
        captions.push({
          kind: "avgMeasurementSize",
          bytes: Math.round(totalVolumeBytes / totals.totalMeasurements),
        });
      }

      const milestone = this.latestMilestone(totals.totalMeasurements, daily);
      if (milestone !== null) {
        captions.push(milestone);
      }
    }

    const openDatasets = await this.metricsRepository.countPublicExperiments();
    if (openDatasets.isSuccess() && openDatasets.value > 0) {
      captions.push({ kind: "openDatasets", count: openDatasets.value });
    }

    const sharedExperiments = await this.metricsRepository.countSharedExperiments();
    if (sharedExperiments.isSuccess() && sharedExperiments.value > 0) {
      captions.push({ kind: "sharedExperiments", count: sharedExperiments.value });
    }

    return captions;
  }

  /** Consecutive days with data, counted back from the newest date present. */
  private currentStreakDays(daily: DailyActivityRow[]): number {
    const dayMs = 24 * 60 * 60 * 1000;
    let streak = 0;
    let expected: number | null = null;

    for (let i = daily.length - 1; i >= 0; i--) {
      const row = daily[i];
      if (row.measurements === 0) {
        break;
      }
      const time = Date.parse(row.date);
      if (expected !== null && expected - time !== dayMs) {
        break;
      }
      streak += 1;
      expected = time;
    }

    return streak;
  }

  /** The largest 1-2-5 decade milestone at or below the total, dated by the
   * day the cumulative count first crossed it. */
  private latestMilestone(total: number, daily: DailyActivityRow[]): MetricsCaption | null {
    let milestone = 0;
    for (let decade = 3; decade <= 12; decade++) {
      for (const step of MILESTONE_STEPS) {
        const candidate = step * 10 ** decade;
        if (candidate <= total && candidate > milestone) {
          milestone = candidate;
        }
      }
    }
    if (milestone === 0) {
      return null;
    }

    const crossing = daily.find((row) => row.cumulativeMeasurements >= milestone);
    if (crossing === undefined) {
      return null;
    }

    return { kind: "milestone", ordinal: milestone, date: crossing.date };
  }
}
