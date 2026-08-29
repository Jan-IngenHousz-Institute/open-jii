import { Inject, Injectable, Logger } from "@nestjs/common";

import type {
  MetricsCaption,
  PublicMetricsResponse,
} from "@repo/api/domains/metrics/metrics.schema";

import { success } from "../../../../common/utils/fp-utils";
import type { Result } from "../../../../common/utils/fp-utils";
import { CACHE_PORT, CachePort } from "../../../core/ports/cache.port";
import { METRICS_DATABRICKS_PORT } from "../../../core/ports/databricks.port";
import type {
  ActivityWindowsRow,
  DailyActivityRow,
  DatabricksPort,
  PlatformTotalsRow,
  PoolFactsRow,
} from "../../../core/ports/databricks.port";
import { MetricsRepository } from "../../../core/repositories/metrics.repository";

export const PUBLIC_METRICS_CACHE_KEY = "public-snapshot";

const DAILY_ACTIVITY_DAYS = 366;

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
      // A fully-failed refresh serves empty slots and is never cached, so a
      // transient warehouse blip cannot pin an empty snapshot for a TTL.
      return success(this.emptySnapshot());
    }

    return success(snapshot);
  }

  private emptySnapshot(): PublicMetricsResponse {
    return {
      hero: null,
      liveness: null,
      community: null,
      activity: [],
      hourly: [],
      families: [],
      derivedParameter: null,
      sensorParameter: null,
      captions: [],
      computedAt: null,
    };
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

    if (totals.isFailure() && daily.isFailure() && windows.isFailure()) {
      this.logger.warn({ msg: "Warehouse unavailable for public metrics", operation: "load" });
      return null;
    }

    const failures = [
      totals,
      daily,
      families,
      windows,
      hourly,
      derivedParameter,
      sensorParameter,
      poolFacts,
      contributorPairs,
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

    const windowVolumeBytes = dailyRows.reduce((sum, row) => sum + row.volumeBytes, 0);
    const windowMeasurements = dailyRows.reduce((sum, row) => sum + row.measurements, 0);

    const institutions = contributorPairs.isSuccess()
      ? await this.countInstitutions(contributorPairs.value.map((pair) => pair.experimentId))
      : null;

    return {
      hero: this.buildHero(totalsRow, poolRow),
      liveness: windowsRow
        ? {
            lastMeasurementAt: windowsRow.lastMeasurementAt,
            measurements24h: windowsRow.measurements24h,
          }
        : null,
      // Hidden rather than shown with an invented zero when the institution
      // inputs are unavailable.
      community:
        windowsRow && institutions !== null
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
      captions: await this.buildCaptions(
        totalsRow,
        dailyRows,
        windowsRow,
        poolRow,
        windowVolumeBytes,
        windowMeasurements,
      ),
      computedAt: windowsRow?.computedAt ?? totalsRow?.computedAt ?? null,
    };
  }

  private buildHero(totals: PlatformTotalsRow | null, poolFacts: PoolFactsRow | null) {
    // Every figure measured, or no hero at all: a failed input must not
    // render as a zero.
    if (totals === null || poolFacts?.timezonesAllTime == null) {
      return null;
    }

    return {
      totalMeasurements: totals.totalMeasurements,
      totalVolumeBytes: totals.totalVolumeBytes,
      timezonesSpanned: poolFacts.timezonesAllTime,
    };
  }

  private async countInstitutions(activeExperimentIds: string[]): Promise<number | null> {
    const organizations = await this.metricsRepository.getExperimentOrganizations(
      Array.from(new Set(activeExperimentIds)),
    );
    if (organizations.isFailure()) {
      return null;
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
    windowVolumeBytes: number,
    windowMeasurements: number,
  ): Promise<MetricsCaption[]> {
    const captions: MetricsCaption[] = [];

    if (poolFacts?.currentStreakDays != null && poolFacts.currentStreakDays > 1) {
      captions.push({ kind: "streak", days: poolFacts.currentStreakDays });
    }

    // The measured interval between consecutive measurements, not a window
    // divided by a count. Measurements sharing a millisecond leave no gap to
    // report, which would read as "a measurement arrives every 0 seconds".
    if (poolFacts?.medianArrivalGapSeconds != null && poolFacts.medianArrivalGapSeconds > 0) {
      captions.push({
        kind: "pace",
        secondsPerMeasurement: poolFacts.medianArrivalGapSeconds,
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
    // Volume and count over the same fetched window, so the ratio stays
    // honest once the platform outgrows the window.
    if (windowVolumeBytes > 0 && windowMeasurements > 0) {
      captions.push({
        kind: "avgMeasurementSize",
        bytes: Math.round(windowVolumeBytes / windowMeasurements),
      });
    }

    if (totals !== null && totals.totalMeasurements > 0) {
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

    // The day the cumulative count actually passed the milestone. When the
    // crossing predates the fetched window, no row satisfies both bounds and
    // the caption is withheld rather than dated at the window edge.
    const crossing = daily.find(
      (row) =>
        row.cumulativeMeasurements >= milestone &&
        row.cumulativeMeasurements - row.measurements < milestone,
    );
    if (crossing === undefined) {
      return null;
    }

    return { kind: "milestone", ordinal: milestone, date: crossing.date };
  }
}
