import {
  cellNumber,
  cellString,
  cellUtcIso,
} from "../../../common/modules/databricks/services/sql/cell-values";
import type {
  ActivityWindowsRow,
  ContributorPairRow,
  DailyActivityRow,
  DevicePairRow,
  FamilyTotalsRow,
  HourlyActivityRow,
  ParameterStatsRow,
  PlatformTotalsRow,
  PoolFactsRow,
  ResourceDailyRow,
  ScopedDailyRow,
} from "../ports/metrics-reads.port";

/**
 * A metrics table's rows as the warehouse writes its cells, each column found by its name, so
 * either source reads into the same rows. A row without a figure it needs is left out, and a
 * single-row table without one reads as no row, never as a zero.
 */
export class MetricsTable {
  constructor(
    readonly rows: (string | null)[][],
    private readonly index: Record<string, number>,
  ) {}

  /** Most measurements first and a tie by name, so neither source's read order shows. */
  static byMeasurements(families: FamilyTotalsRow[]): FamilyTotalsRow[] {
    return [...families].sort(
      (a, b) => b.measurements - a.measurements || a.family.localeCompare(b.family),
    );
  }

  platformTotals(): PlatformTotalsRow | null {
    if (this.rows.length === 0) {
      return null;
    }

    const row = this.rows[0];
    const totalMeasurements = cellNumber(row[this.index.total_measurements]);
    if (totalMeasurements === null) {
      return null;
    }

    return {
      totalMeasurements,
      totalVolumeBytes: cellNumber(row[this.index.total_volume_bytes]) ?? 0,
      totalUploadedRows: cellNumber(row[this.index.total_uploaded_rows]) ?? 0,
      totalMacroExecutions: cellNumber(row[this.index.total_macro_executions]) ?? 0,
      devicesAllTime: cellNumber(row[this.index.devices_all_time]) ?? 0,
      experimentsWithData: cellNumber(row[this.index.experiments_with_data]) ?? 0,
      firstMeasurementAt: cellUtcIso(row[this.index.first_measurement_at]),
      lastMeasurementAt: cellUtcIso(row[this.index.last_measurement_at]),
      computedAt: cellUtcIso(row[this.index.computed_at]),
    };
  }

  dailyActivity(): DailyActivityRow[] {
    return this.rows
      .map((row) => ({
        date: cellString(row[this.index.date]),
        measurements: cellNumber(row[this.index.measurements]),
        cumulativeMeasurements: cellNumber(row[this.index.cumulative_measurements]),
        volumeBytes: cellNumber(row[this.index.volume_bytes]),
      }))
      .filter(
        (row): row is DailyActivityRow =>
          row.date !== null &&
          row.measurements !== null &&
          row.cumulativeMeasurements !== null &&
          row.volumeBytes !== null,
      );
  }

  familyTotals(): FamilyTotalsRow[] {
    const families = this.rows
      .map((row) => ({
        family: cellString(row[this.index.family]),
        measurements: cellNumber(row[this.index.total_measurements]),
      }))
      .filter((row): row is FamilyTotalsRow => row.family !== null && row.measurements !== null);
    return MetricsTable.byMeasurements(families);
  }

  activityWindows(): ActivityWindowsRow | null {
    if (this.rows.length === 0) {
      return null;
    }

    const row = this.rows[0];
    const measurements24h = cellNumber(row[this.index.measurements_24h]);
    const measurements30d = cellNumber(row[this.index.measurements_30d]);
    const experiments30d = cellNumber(row[this.index.experiments_30d]);
    const contributors30d = cellNumber(row[this.index.contributors_30d]);
    if (
      measurements24h === null ||
      measurements30d === null ||
      experiments30d === null ||
      contributors30d === null
    ) {
      return null;
    }

    return {
      measurements24h,
      measurements30d,
      experiments30d,
      contributors30d,
      devices30d: cellNumber(row[this.index.devices_30d]) ?? 0,
      lastMeasurementAt: cellUtcIso(row[this.index.last_measurement_at]),
      computedAt: cellUtcIso(row[this.index.computed_at]),
    };
  }

  hourlyActivity(): HourlyActivityRow[] {
    return this.rows
      .map((row) => ({
        hourLocal: cellNumber(row[this.index.hour_local]),
        measurements: cellNumber(row[this.index.measurements]),
      }))
      .filter(
        (row): row is HourlyActivityRow =>
          row.hourLocal !== null &&
          Number.isInteger(row.hourLocal) &&
          row.hourLocal >= 0 &&
          row.hourLocal <= 23 &&
          row.measurements !== null,
      );
  }

  /** The most observed parameter of the rows, a tie going to the first by name. */
  topParameter(): ParameterStatsRow | null {
    const row = this.rows.reduce<(string | null)[] | null>(
      (top, candidate) => (top === null || this.outranks(candidate, top) ? candidate : top),
      null,
    );
    if (row === null) {
      return null;
    }

    const name = cellString(row[this.index.parameter]);
    const label = cellString(row[this.index.label]) ?? name;
    const observations = cellNumber(row[this.index.observations]);
    const median = cellNumber(row[this.index.median_value]);
    if (name === null || observations === null || median === null) {
      return null;
    }

    return { label: label ?? name, name, observations, median };
  }

  poolFacts(): PoolFactsRow | null {
    if (this.rows.length === 0) {
      return null;
    }

    const row = this.rows[0];
    return {
      sessionMedianMeasurements: cellNumber(row[this.index.session_median_measurements]),
      meanArrivalGapSeconds: cellNumber(row[this.index.mean_arrival_gap_seconds]),
      currentStreakDays: cellNumber(row[this.index.current_streak_days]),
      deviceEnduranceDays: cellNumber(row[this.index.device_endurance_days]),
      simultaneityPeakDevices: cellNumber(row[this.index.simultaneity_peak_devices]),
      timezonesAllTime: cellNumber(row[this.index.timezones_all_time]),
      timezonesPeakDay: cellNumber(row[this.index.timezones_peak_day]),
    };
  }

  scopedDaily(): ScopedDailyRow[] {
    return this.rows
      .map((row) => ({
        date: cellString(row[this.index.date]),
        experimentId: cellString(row[this.index.experiment_id]),
        measurements: cellNumber(row[this.index.measurements]),
      }))
      .filter(
        (row): row is ScopedDailyRow =>
          row.date !== null && row.experimentId !== null && row.measurements !== null,
      );
  }

  resourceDaily(): ResourceDailyRow[] {
    return this.rows
      .map((row) => ({
        date: cellString(row[this.index.date]),
        resourceType: cellString(row[this.index.resource_type]),
        resourceId: cellString(row[this.index.resource_id]),
        measurements: cellNumber(row[this.index.measurements]),
      }))
      .filter(
        (row): row is ResourceDailyRow =>
          row.date !== null &&
          row.resourceType !== null &&
          row.resourceId !== null &&
          row.measurements !== null,
      );
  }

  contributorPairs(): ContributorPairRow[] {
    return this.rows
      .map((row) => ({
        experimentId: cellString(row[this.index.experiment_id]),
        userId: cellString(row[this.index.user_id]),
      }))
      .filter((row): row is ContributorPairRow => row.experimentId !== null && row.userId !== null);
  }

  devicePairs(): DevicePairRow[] {
    return this.rows
      .map((row) => ({
        experimentId: cellString(row[this.index.experiment_id]),
        clientId: cellString(row[this.index.client_id]),
      }))
      .filter((row): row is DevicePairRow => row.experimentId !== null && row.clientId !== null);
  }

  private outranks(row: (string | null)[], other: (string | null)[]): boolean {
    const observations = cellNumber(row[this.index.observations]) ?? -1;
    const otherObservations = cellNumber(other[this.index.observations]) ?? -1;
    if (observations !== otherObservations) {
      return observations > otherObservations;
    }

    const name = cellString(row[this.index.parameter]) ?? "";
    const otherName = cellString(other[this.index.parameter]) ?? "";
    return name.localeCompare(otherName) < 0;
  }
}
