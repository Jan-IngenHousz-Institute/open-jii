import { z } from "zod";

export const zPublicPlatformTotals = z.object({
  totalMeasurements: z.number(),
  totalUploadedRows: z.number(),
  totalMacroExecutions: z.number(),
  devicesAllTime: z.number(),
  experimentsWithData: z.number(),
  firstMeasurementAt: z.string().nullable(),
  lastMeasurementAt: z.string().nullable(),
  computedAt: z.string().nullable(),
});

export const zPublicDailyActivity = z.object({
  date: z.string(),
  measurements: z.number(),
  liveMeasurements: z.number(),
  importedMeasurements: z.number(),
  activeDevices: z.number(),
  activeExperiments: z.number(),
  macroExecutions: z.number(),
  uploadedRows: z.number(),
  cumulativeMeasurements: z.number(),
});

export const zPublicFamilyTotals = z.object({
  family: z.string(),
  totalMeasurements: z.number(),
  devicesAllTime: z.number(),
  devicesActive7d: z.number(),
  lastMeasurementAt: z.string().nullable(),
});

export const zPublicRegistryCounts = z.object({
  registeredUsers: z.number(),
  organizations: z.number(),
  experiments: z.number(),
  protocols: z.number(),
  macros: z.number(),
});

/**
 * Everything here is pre-aggregated and anonymous. `totals` is null and the
 * arrays are empty until the metrics pipeline has produced its first refresh.
 */
export const zPublicMetricsResponse = z.object({
  totals: zPublicPlatformTotals.nullable(),
  registry: zPublicRegistryCounts,
  dailyActivity: z.array(zPublicDailyActivity),
  familyTotals: z.array(zPublicFamilyTotals),
});

export type PublicPlatformTotals = z.infer<typeof zPublicPlatformTotals>;
export type PublicDailyActivity = z.infer<typeof zPublicDailyActivity>;
export type PublicFamilyTotals = z.infer<typeof zPublicFamilyTotals>;
export type PublicRegistryCounts = z.infer<typeof zPublicRegistryCounts>;
export type PublicMetricsResponse = z.infer<typeof zPublicMetricsResponse>;
