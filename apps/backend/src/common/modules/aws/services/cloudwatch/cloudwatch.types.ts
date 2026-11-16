export interface MetricPoint {
  name: string;
  value: number;
  unit: "Count" | "Milliseconds" | "Seconds";
  dimensions: Record<string, string>;
}
