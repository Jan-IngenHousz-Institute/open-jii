import type { MetricUnit } from "./format.js";

export type MetricFamily = "observability" | "usage";

export type MetricSlot = "alert" | "exception" | "pulse" | "weekly" | "dashboard" | "s3";

/** How the composer fetches a signal. Absent means CloudWatch, the original and only kind. */
export type SignalKind = "cloudwatch" | "logs_insights" | "posthog";

export interface MetricSignal {
  kind?: SignalKind;
  /** What the number is, so the digest can render it as a duration, a size or a rate. */
  unit?: MetricUnit;
  namespace?: string;
  metric?: string;
  search?: string;
  stat?: string;
  region?: string;
  dimensions?: Record<string, string>;
  /** logs_insights: the group to query and the query itself. */
  logGroup?: string;
  query?: string;
  /** logs_insights and posthog: which field of the result row carries the value. */
  resultField?: string;
}

export interface MetricBaseline {
  method?: "threshold" | "same-weekday-4w" | "wow";
  max?: number;
  anomaly?: "any-nonzero";
  anomaly_pct?: number;
  nodata?: "alert";
  /**
   * Replaces the fields above in the named environment. One catalog still serves every
   * environment, but a number that is right for a continuous consumer is wrong for a
   * scheduled one, and a threshold nothing can stay under is not a threshold.
   */
  per_environment?: Record<string, Omit<MetricBaseline, "per_environment">>;
}

/**
 * A cross-cutting view over observability entries. A performance signal is a level most
 * days and an exception on regression, so it is both families at once; a lens keeps it out
 * of the exception digest without re-partitioning what family means.
 */
export type MetricLens = "performance";

/** One numbering pass over the catalog; together they account for every num ever issued. */
export interface CatalogPass {
  date: string;
  range: [number, number];
  gaps?: number[];
  note: string;
}

export interface CatalogMetric {
  num: number;
  id: string;
  name: string;
  family: MetricFamily;
  lens?: MetricLens;
  source: string;
  phase: string;
  active: boolean;
  slots: MetricSlot[];
  severity?: "critical" | "warning";
  signal?: MetricSignal;
  baseline?: MetricBaseline;
  runbook?: string;
  notes?: string;
}

export interface MetricReading {
  metric: CatalogMetric;
  value: number | null;
  baseline: number | null;
  historyCount: number;
}

export type EvaluationState = "ok" | "anomaly" | "missing" | "no-data";

export interface Evaluation {
  state: EvaluationState;
  reason?: string;
}

export interface ForwarderDatum {
  namespace: string;
  datum: {
    MetricName: string;
    Value: number;
    Unit: string;
    Timestamp: Date;
    Dimensions: { Name: string; Value: string }[];
  };
}

export interface SkippedLine {
  line: number;
  reason: string;
}
