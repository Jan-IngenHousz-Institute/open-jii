export interface MetricPoint {
  name: string;
  value: number;
  unit: "Count" | "Milliseconds";
  dimensions: Record<string, string>;
}
