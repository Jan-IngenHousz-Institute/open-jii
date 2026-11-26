import { Inject, Injectable, Logger } from "@nestjs/common";

import type {
  MetricsCaption,
  PublicMetricsResponse,
} from "@repo/api/domains/metrics/metrics.schema";

import { success } from "../../../../common/utils/fp-utils";
import type { Result } from "../../../../common/utils/fp-utils";
import type { MetricsDataSource } from "../../../core/models/metrics-data.model";
import { CACHE_PORT, CachePort } from "../../../core/ports/cache.port";
import type {
  ActivityWindowsRow,
  DailyActivityRow,
  PlatformTotalsRow,
  PoolFactsRow,
} from "../../../core/ports/metrics-reads.port";
import { MetricsRepository } from "../../../core/repositories/metrics.repository";
import { MetricsDataSourceService } from "../../services/metrics-data-source.service";

// Keyed by source, so a snapshot never mixes sources and a switch reads the other key at once.
export const publicMetricsCacheKey = (source: MetricsDataSource) => `public-snapshot:${source}`;

const DAILY_ACTIVITY_DAYS = 366;

// Milestone thresholds follow the 1-2-5 decade pattern.
const MILESTONE_STEPS = [1, 2, 5];

// Complete when every read and lookup answered and the totals, windows, pool facts
// and parameter views have refreshed, so no slot is missing for a failure or a
// refresh still on its way.
interface LoadedSnapshot {
  snapshot: PublicMetricsResponse;
  isComplete: boolean;
}

/**
 * Serves the public metrics snapshot behind the read-through cache so
 * anonymous page views never fan out to the source directly. Source reads
 * degrade gracefully (the figures lag one refresh and may not exist before the
 * first); an empty snapshot is still a valid response.
 */
@Injectable()
export class GetPublicMetricsUseCase {
  private readonly logger = new Logger(GetPublicMetricsUseCase.name);

  constructor(
    private readonly dataSource: MetricsDataSourceService,
    @Inject(CACHE_PORT)
    private readonly cachePort: CachePort,
    private readonly metricsRepository: MetricsRepository,
  ) {}

  async execute(): Promise<Result<PublicMetricsResponse>> {
    const source = await this.dataSource.sourceFor();
    const loaded = await this.cachePort.tryCache(
      publicMetricsCacheKey(source),
      () => this.load(source),
      // So one failed read cannot blank a complete snapshot's slots for a TTL.
      (candidate) => candidate.isComplete,
    );

    if (loaded === null) {
      // A failed or not yet refreshed source serves empty slots and is never
      // cached, so neither a transient blip nor a fresh store pins an empty
      // snapshot for a TTL.
      return success(this.emptySnapshot());
    }

    return success(loaded.snapshot);
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

  private async load(source: MetricsDataSource): Promise<LoadedSnapshot | null> {
    const reads = this.dataSource.readsFor(source);
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
      reads.getPublicPlatformTotals(),
      reads.getPublicDailyActivity(DAILY_ACTIVITY_DAYS),
      reads.getPublicFamilyTotals(),
      reads.getActivityWindows(),
      reads.getHourlyActivity(),
      reads.getTopParameter("derived"),
      reads.getTopParameter("sensor"),
      reads.getPoolFacts(),
      reads.getContributorPairs(),
    ]);

    if (totals.isFailure() && daily.isFailure() && windows.isFailure()) {
      this.logger.warn({
        msg: "Metrics source unavailable for public metrics",
        operation: "load",
        source,
      });
      return null;
    }

    const totalsRow = totals.isSuccess() ? totals.value : null;
    const dailyRows = daily.isSuccess() ? daily.value : [];
    const windowsRow = windows.isSuccess() ? windows.value : null;
    const poolRow = poolFacts.isSuccess() ? poolFacts.value : null;

    // A store view before its first refresh holds no row, where a refreshed one
    // on an empty platform holds zeros, so no figures at all is not yet a snapshot.
    const hasNoFigures = totalsRow === null && windowsRow === null && dailyRows.length === 0;
    if (hasNoFigures) {
      this.logger.warn({
        msg: "Metrics source has no platform figures yet",
        operation: "load",
        source,
      });
      return null;
    }

    // The views refresh one after another, so a cold store can hold the totals
    // before the windows and pool facts. The parameter view refreshes last and
    // fails its reads until it has, so it counts with the failures below.
    const hasUnrefreshedView = totalsRow === null || windowsRow === null || poolRow === null;

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
        msg: "Some metrics are unavailable, serving a partial snapshot",
        operation: "load",
        source,
        unavailable: failures.length,
      });
    }

    const windowVolumeBytes = dailyRows.reduce((sum, row) => sum + row.volumeBytes, 0);
    const windowMeasurements = dailyRows.reduce((sum, row) => sum + row.measurements, 0);

    const institutions = contributorPairs.isSuccess()
      ? await this.countInstitutions(contributorPairs.value.map((pair) => pair.experimentId))
      : null;
    const openDatasets = await this.metricsRepository.countPublicExperiments();
    const sharedExperiments = await this.metricsRepository.countSharedExperiments();
    const hasFailedLookup = [institutions, openDatasets, sharedExperiments].some(
      (lookup) => lookup?.isFailure() === true,
    );

    const snapshot: PublicMetricsResponse = {
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
        windowsRow && institutions?.isSuccess()
          ? {
              measurements30d: windowsRow.measurements30d,
              activeExperiments30d: windowsRow.experiments30d,
              contributors30d: windowsRow.contributors30d,
              devices30d: windowsRow.devices30d,
              institutions30d: institutions.value,
            }
          : null,
      activity: dailyRows,
      hourly: hourly.isSuccess() ? hourly.value : [],
      families: families.isSuccess() ? families.value : [],
      derivedParameter: derivedParameter.isSuccess() ? derivedParameter.value : null,
      sensorParameter: sensorParameter.isSuccess() ? sensorParameter.value : null,
      captions: this.buildCaptions(
        totalsRow,
        dailyRows,
        windowsRow,
        poolRow,
        windowVolumeBytes,
        windowMeasurements,
        openDatasets,
        sharedExperiments,
      ),
      computedAt: windowsRow?.computedAt ?? totalsRow?.computedAt ?? null,
    };

    return {
      snapshot,
      isComplete: failures.length === 0 && !hasUnrefreshedView && !hasFailedLookup,
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

  private async countInstitutions(activeExperimentIds: string[]): Promise<Result<number>> {
    const organizations = await this.metricsRepository.getExperimentOrganizations(
      Array.from(new Set(activeExperimentIds)),
    );
    if (organizations.isFailure()) {
      return organizations;
    }

    const distinct = new Set(
      organizations.value
        .map((row) => row.organizationId)
        .filter((organizationId) => organizationId !== null),
    );
    return success(distinct.size);
  }

  private buildCaptions(
    totals: PlatformTotalsRow | null,
    daily: DailyActivityRow[],
    windows: ActivityWindowsRow | null,
    poolFacts: PoolFactsRow | null,
    windowVolumeBytes: number,
    windowMeasurements: number,
    openDatasets: Result<number>,
    sharedExperiments: Result<number>,
  ): MetricsCaption[] {
    const captions: MetricsCaption[] = [];

    if (poolFacts?.currentStreakDays != null && poolFacts.currentStreakDays > 1) {
      captions.push({ kind: "streak", days: poolFacts.currentStreakDays });
    }

    // The measured interval between consecutive measurements, not a window
    // divided by a count. Measurements sharing a millisecond leave no gap to
    // report, which would read as "a measurement arrives every 0 seconds".
    if (poolFacts?.meanArrivalGapSeconds != null && poolFacts.meanArrivalGapSeconds > 0) {
      captions.push({
        kind: "pace",
        secondsPerMeasurement: poolFacts.meanArrivalGapSeconds,
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

    if (openDatasets.isSuccess() && openDatasets.value > 0) {
      captions.push({ kind: "openDatasets", count: openDatasets.value });
    }

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
