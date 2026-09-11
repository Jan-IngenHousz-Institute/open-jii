import { z } from "zod";

export const zMetricsHero = z.object({
  totalMeasurements: z.number(),
  totalVolumeBytes: z.number(),
  timezonesSpanned: z.number(),
});

export const zMetricsLiveness = z.object({
  lastMeasurementAt: z.string().nullable(),
  measurements24h: z.number(),
});

/**
 * `contributors30d` counts only the people a measurement names, which is the
 * app's path; a logger publishes with no contributor at all. `devices30d` is
 * what the rest of the volume came through, so the two are stated together.
 */
export const zMetricsCommunity = z.object({
  measurements30d: z.number(),
  activeExperiments30d: z.number(),
  contributors30d: z.number(),
  devices30d: z.number(),
  institutions30d: z.number(),
});

export const zMetricsActivityDay = z.object({
  date: z.string(),
  measurements: z.number(),
  cumulativeMeasurements: z.number(),
  volumeBytes: z.number(),
});

export const zMetricsHourlyBin = z.object({
  hourLocal: z.number().int().min(0).max(23),
  measurements: z.number(),
});

export const zMetricsFamily = z.object({
  family: z.string(),
  measurements: z.number(),
});

export const zMetricsParameter = z.object({
  /** Display copy for the parameter; the pipeline ships it ready to render. */
  label: z.string(),
  name: z.string(),
  observations: z.number(),
  median: z.number(),
});

/**
 * The rotating caption pool as typed facts. The API ships data, never copy;
 * the frontend holds one i18n template per kind and skips unknown kinds, so
 * adding a pool metric never changes the endpoint shape.
 */
export const zMetricsCaption = z.discriminatedUnion("kind", [
  z.object({ kind: z.literal("streak"), days: z.number() }),
  z.object({ kind: z.literal("pace"), secondsPerMeasurement: z.number() }),
  z.object({ kind: z.literal("sessionSize"), medianMeasurements: z.number() }),
  z.object({ kind: z.literal("endurance"), days: z.number() }),
  z.object({ kind: z.literal("simultaneity"), devices: z.number() }),
  z.object({ kind: z.literal("zonesPeakDay"), zones: z.number() }),
  z.object({ kind: z.literal("analysesRun"), count: z.number() }),
  z.object({ kind: z.literal("avgMeasurementSize"), bytes: z.number() }),
  z.object({ kind: z.literal("openDatasets"), count: z.number() }),
  z.object({ kind: z.literal("sharedExperiments"), count: z.number() }),
  z.object({ kind: z.literal("milestone"), ordinal: z.number(), date: z.string() }),
]);

/**
 * Everything here is pre-aggregated and anonymous; this payload is the public
 * disclosure boundary and must contain exactly what the public UI renders.
 * `hero` is null and the arrays are empty until the metrics pipeline has
 * produced its first refresh.
 */
export const zPublicMetricsResponse = z.object({
  hero: zMetricsHero.nullable(),
  liveness: zMetricsLiveness.nullable(),
  community: zMetricsCommunity.nullable(),
  activity: z.array(zMetricsActivityDay),
  hourly: z.array(zMetricsHourlyBin),
  families: z.array(zMetricsFamily),
  derivedParameter: zMetricsParameter.nullable(),
  sensorParameter: zMetricsParameter.nullable(),
  captions: z.array(zMetricsCaption),
  computedAt: z.string().nullable(),
});

/** A single day's total inside an activity window. */
export const zMetricsWindowDay = z.object({ date: z.string(), measurements: z.number() });

export const zMetricsScope = z.enum(["organization", "mine", "experiment"]);

/**
 * `organizationId` is required for organization scope and `experimentId` for
 * experiment scope; both are checked against the caller's access before any
 * cached figure is served.
 */
export const zScopedMetricsQuery = z.object({
  scope: zMetricsScope,
  organizationId: z.string().uuid().optional(),
  experimentId: z.string().uuid().optional(),
});

/**
 * `activity` spans the whole window, silent days included, so a series is read
 * by its shape. `previousMeasurements` covers the window immediately before it,
 * which is what makes the headline figure mean something.
 */
export const zScopedActivity = z.object({
  measurements30d: z.number(),
  activeExperiments30d: z.number(),
  contributors30d: z.number(),
  activity: z.array(zMetricsWindowDay),
  previousMeasurements: z.number(),
  activeDays: z.number(),
  peak: zMetricsWindowDay.nullable(),
  lastActivityDate: z.string().nullable(),
});

/**
 * `scoped` and `baseline` are null before the pipeline's first refresh and
 * while the warehouse is unavailable; both endpoints degrade to empty slots
 * rather than an error.
 */
export const zScopedMetricsResponse = z.object({
  scope: zMetricsScope,
  scoped: zScopedActivity.nullable(),
  baseline: z
    .object({
      measurements30d: z.number(),
      activeExperiments30d: z.number(),
    })
    .nullable(),
  computedAt: z.string().nullable(),
});

export const zResourceKind = z.enum(["experiment", "protocol", "macro", "workbook"]);

export const zResourceMetricsQuery = z.object({
  kind: zResourceKind,
});

/** A resource's daily measurements, carried on the row it belongs to. */
export const zResourceSeries = z.object({
  measurements: z.number(),
  days: z.array(zMetricsWindowDay),
});

/** The single resource of its kind that recorded the most this window. */
export const zBusiestResource = z.object({
  id: z.string(),
  name: z.string(),
  measurements: z.number(),
});

/**
 * What a list page's header states: the window's totals and shape across every
 * resource of this kind the caller may read. The per-row series ride on the
 * rows themselves, so this response stays the same size whatever the workspace
 * holds. `activeCount` counts the resources that recorded something and
 * `visibleCount` those the caller may read at all, which is the comparison the
 * header makes.
 */
export const zResourceMetricsResponse = z.object({
  kind: zResourceKind,
  totalMeasurements: z.number(),
  previousMeasurements: z.number(),
  activeCount: z.number(),
  visibleCount: z.number(),
  activeDays: z.number(),
  peak: zMetricsWindowDay.nullable(),
  lastActivityDate: z.string().nullable(),
  busiest: zBusiestResource.nullable(),
  days: z.array(zMetricsWindowDay),
  windowDays: z.number(),
});

export type MetricsHero = z.infer<typeof zMetricsHero>;
export type MetricsLiveness = z.infer<typeof zMetricsLiveness>;
export type MetricsCommunity = z.infer<typeof zMetricsCommunity>;
export type MetricsActivityDay = z.infer<typeof zMetricsActivityDay>;
export type MetricsHourlyBin = z.infer<typeof zMetricsHourlyBin>;
export type MetricsFamily = z.infer<typeof zMetricsFamily>;
export type MetricsParameter = z.infer<typeof zMetricsParameter>;
export type MetricsCaption = z.infer<typeof zMetricsCaption>;
export type PublicMetricsResponse = z.infer<typeof zPublicMetricsResponse>;
export type MetricsWindowDay = z.infer<typeof zMetricsWindowDay>;
export type MetricsScope = z.infer<typeof zMetricsScope>;
export type ScopedMetricsQuery = z.infer<typeof zScopedMetricsQuery>;
export type ScopedActivity = z.infer<typeof zScopedActivity>;
export type ScopedMetricsResponse = z.infer<typeof zScopedMetricsResponse>;
export type ResourceKind = z.infer<typeof zResourceKind>;
export type ResourceSeries = z.infer<typeof zResourceSeries>;
export type BusiestResource = z.infer<typeof zBusiestResource>;
export type ResourceMetricsQuery = z.infer<typeof zResourceMetricsQuery>;
export type ResourceMetricsResponse = z.infer<typeof zResourceMetricsResponse>;
