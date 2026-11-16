import type { Result } from "../../../common/utils/fp-utils";

export const EXPERIMENT_METRICS_PORT = Symbol("EXPERIMENT_METRICS_PORT");

export interface ExperimentMetric {
  name: string;
  value: number;
  unit: "Count" | "Seconds";
  dimensions: Record<string, string>;
}

export interface ExperimentMetricsPort {
  publishMetrics(namespace: string, metrics: ExperimentMetric[]): Promise<Result<void>>;
}
