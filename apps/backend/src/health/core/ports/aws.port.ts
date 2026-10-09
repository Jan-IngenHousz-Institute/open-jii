import type { Result } from "../../../common/utils/fp-utils";

export const HEALTH_AWS_PORT = Symbol("HEALTH_AWS_PORT");

export interface HealthMetric {
  name: string;
  value: number;
  unit: "Count" | "Milliseconds";
  dimensions: Record<string, string>;
}

export interface AwsPort {
  databaseClusterStatus(clusterIdentifier: string): Promise<Result<string>>;
  latestDatabaseCapacity(clusterIdentifier: string): Promise<Result<number | null>>;
  probeIotEndpoint(): Promise<Result<void>>;
  publishMetrics(namespace: string, metrics: HealthMetric[]): Promise<Result<void>>;
}
