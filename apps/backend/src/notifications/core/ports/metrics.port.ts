import type { Result } from "../../../common/utils/fp-utils";

export const NOTIFICATION_METRICS_PORT = Symbol("NOTIFICATION_METRICS_PORT");

export interface NotificationMetric {
  name: string;
  value: number;
  unit: "Count" | "Seconds";
  dimensions: Record<string, string>;
}

export interface MetricsPort {
  publishMetrics(namespace: string, metrics: NotificationMetric[]): Promise<Result<void>>;
}
