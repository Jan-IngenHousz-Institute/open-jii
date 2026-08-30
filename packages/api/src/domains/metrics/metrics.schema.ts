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

export const zMetricsCommunity = z.object({
  measurements30d: z.number(),
  activeExperiments30d: z.number(),
  contributors30d: z.number(),
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

export const zScopedActivity = z.object({
  measurements30d: z.number(),
  activeExperiments30d: z.number(),
  contributors30d: z.number(),
  activity: z.array(z.object({ date: z.string(), measurements: z.number() })),
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
  /**
   * The rows on screen. Series are returned only for these, so a page of 20
   * does not carry the whole workspace; the totals still cover everything the
   * caller may see. Ids are intersected with that same visibility, so listing
   * an id reveals nothing about it.
   */
  ids: z.array(z.string().uuid()).max(200).optional(),
});

export const zResourceMetrics = z.object({
  id: z.string(),
  measurements: z.number(),
  days: z.array(z.object({ date: z.string(), measurements: z.number() })),
});

/**
 * Per-resource activity for a list page, covering only resources the caller may
 * read. `resources` carries one entry per resource with recorded activity; the
 * totals describe the same visible set, so the header and the rows agree.
 */
export const zResourceMetricsResponse = z.object({
  kind: zResourceKind,
  resources: z.array(zResourceMetrics),
  totalMeasurements: z.number(),
  activeCount: z.number(),
  windowDays: z.number(),
  computedAt: z.string().nullable(),
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
export type MetricsScope = z.infer<typeof zMetricsScope>;
export type ScopedMetricsQuery = z.infer<typeof zScopedMetricsQuery>;
export type ScopedMetricsResponse = z.infer<typeof zScopedMetricsResponse>;
export type ResourceKind = z.infer<typeof zResourceKind>;
export type ResourceMetrics = z.infer<typeof zResourceMetrics>;
export type ResourceMetricsQuery = z.infer<typeof zResourceMetricsQuery>;
export type ResourceMetricsResponse = z.infer<typeof zResourceMetricsResponse>;
