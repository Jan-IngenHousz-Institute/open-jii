export interface PlatformTotalsRow {
  totalMeasurements: number;
  totalUploadedRows: number;
  totalMacroExecutions: number;
  devicesAllTime: number;
  experimentsWithData: number;
  firstMeasurementAt: string | null;
  lastMeasurementAt: string | null;
  computedAt: string | null;
}

export interface DailyActivityRow {
  date: string;
  measurements: number;
  cumulativeMeasurements: number;
  volumeBytes: number;
}

export interface HourlyActivityRow {
  hourLocal: number;
  measurements: number;
}

export interface FamilyTotalsRow {
  family: string;
  measurements: number;
}

export interface ActivityWindowsRow {
  measurements24h: number;
  measurements30d: number;
  experiments30d: number;
  contributors30d: number;
  devices30d: number;
  lastMeasurementAt: string | null;
  computedAt: string | null;
}

export type ParameterCategory = "derived" | "sensor";

export interface ParameterStatsRow {
  name: string;
  count30d: number;
  median: number;
}

export interface PoolFactsRow {
  sessionMedianMeasurements: number | null;
  deviceEnduranceDays: number | null;
  simultaneityPeakDevices: number | null;
  timezonesAllTime: number | null;
  timezonesPeakDay: number | null;
}

export interface ScopedDailyRow {
  date: string;
  experimentId: string;
  measurements: number;
}

export interface ContributorPairRow {
  experimentId: string;
  userId: string;
}

export interface ExperimentOrganizationRow {
  experimentId: string;
  organizationId: string | null;
}
