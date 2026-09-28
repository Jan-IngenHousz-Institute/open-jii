/** Units a signal may declare. The report dashboards map each to a Grafana unit id. */
export type MetricUnit = "milliseconds" | "seconds" | "minutes" | "bytes" | "percent" | "ratio";

export type MetricFamily = "observability" | "usage";

export type MetricSlot = "alert" | "exception" | "weekly" | "dashboard" | "s3";

/** The row of its report an entry sits in. */
export type MetricArea =
  | "volume"
  | "latency"
  | "path"
  | "web"
  | "api"
  | "ingest"
  | "lakehouse"
  | "sandboxes"
  | "usage"
  | "platform";

/** Where a signal is read from. Absent means CloudWatch. */
export type SignalKind = "cloudwatch" | "logs_insights" | "posthog";

export interface MetricSignal {
  kind?: SignalKind;
  /** What the number is, so a panel can render it as a duration, a size or a rate. */
  unit?: MetricUnit;
  namespace?: string;
  metric?: string;
  search?: string;
  stat?: string;
  region?: string;
  dimensions?: Record<string, string>;
  /**
   * CloudWatch period in seconds, for a signal counted per period rather than read as its
   * latest value. The weekly report compares its last two periods.
   */
  period?: number;
  /** logs_insights: the group to query and the query itself. */
  logGroup?: string;
  query?: string;
  /** logs_insights and posthog: which field of the result row carries the value. */
  resultField?: string;
}

export interface MetricBaseline {
  method?: "threshold" | "same-weekday-4w" | "wow";
  max?: number;
  /** A floor the value must not drop below, for a status that reads 1 when healthy. */
  min?: number;
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
 * days and an exception on regression, so it is both families at once; a lens marks it
 * without re-partitioning what family means.
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
  area?: MetricArea;
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

export interface EvaluatedReading extends MetricReading {
  evaluation: Evaluation;
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
