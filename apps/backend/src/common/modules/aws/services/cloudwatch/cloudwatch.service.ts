import {
  CloudWatchClient,
  GetMetricDataCommand,
  PutMetricDataCommand,
} from "@aws-sdk/client-cloudwatch";
import { Injectable } from "@nestjs/common";

import { ErrorCodes } from "../../../../utils/error-codes";
import { AppError, Result, tryCatch } from "../../../../utils/fp-utils";
import { AwsConfigService } from "../config/config.service";
import type { MetricPoint } from "./cloudwatch.types";

// Aurora reports capacity every minute, and a few minutes covers the delay before a point lands.
const CAPACITY_WINDOW_MS = 10 * 60 * 1000;

@Injectable()
export class AwsCloudWatchService {
  private readonly cloudWatchClient: CloudWatchClient;

  constructor(private readonly awsConfig: AwsConfigService) {
    this.cloudWatchClient = new CloudWatchClient({ region: this.awsConfig.region });
  }

  // Reading the metric never wakes a paused cluster, which any connection attempt would.
  async latestDatabaseCapacity(clusterIdentifier: string): Promise<Result<number | null>> {
    return tryCatch(
      async () => {
        const now = Date.now();
        const response = await this.cloudWatchClient.send(
          new GetMetricDataCommand({
            StartTime: new Date(now - CAPACITY_WINDOW_MS),
            EndTime: new Date(now),
            ScanBy: "TimestampDescending",
            MetricDataQueries: [
              {
                Id: "capacity",
                MetricStat: {
                  Metric: {
                    Namespace: "AWS/RDS",
                    MetricName: "ServerlessDatabaseCapacity",
                    Dimensions: [{ Name: "DBClusterIdentifier", Value: clusterIdentifier }],
                  },
                  Period: 60,
                  Stat: "Maximum",
                },
              },
            ],
          }),
        );

        return response.MetricDataResults?.at(0)?.Values?.at(0) ?? null;
      },
      (error) => this.mapError(error, ErrorCodes.AWS_CLOUDWATCH_READ_FAILED),
    );
  }

  async publish(namespace: string, points: MetricPoint[]): Promise<Result<void>> {
    return tryCatch(
      async () => {
        await this.cloudWatchClient.send(
          new PutMetricDataCommand({
            Namespace: namespace,
            MetricData: points.map((point) => ({
              MetricName: point.name,
              Value: point.value,
              Unit: point.unit,
              Dimensions: Object.entries(point.dimensions).map(([Name, Value]) => ({
                Name,
                Value,
              })),
            })),
          }),
        );
      },
      (error) => this.mapError(error, ErrorCodes.AWS_CLOUDWATCH_PUBLISH_FAILED),
    );
  }

  private mapError(error: unknown, code: ErrorCodes): AppError {
    if (error instanceof AppError) {
      return error;
    }

    const message = error instanceof Error ? error.message : "Unknown error";
    return AppError.internal(`CloudWatch request failed: ${message}`, code);
  }
}
