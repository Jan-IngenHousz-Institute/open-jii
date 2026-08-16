export type MetricFamily = "observability" | "usage";

export type MetricSlot = "alert" | "exception" | "pulse" | "weekly" | "dashboard" | "s3";

export interface MetricSignal {
  namespace?: string;
  metric?: string;
  search?: string;
  stat?: string;
  region?: string;
  dimensions?: Record<string, string>;
}

export interface MetricBaseline {
  method?: "threshold" | "same-weekday-4w" | "wow";
  max?: number;
  anomaly?: "any-nonzero";
  anomaly_pct?: number;
  nodata?: "alert";
}

export interface CatalogMetric {
  num: number;
  id: string;
  name: string;
  family: MetricFamily;
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

/** One NDJSON line the Databricks heartbeat job writes for the forwarder. */
export interface HeartbeatObservation {
  namespace: string;
  metric: string;
  value: number;
  unit?: string;
  timestamp: string;
  dimensions?: Record<string, string | number>;
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
