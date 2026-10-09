import { Inject, Injectable } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { HealthIndicatorService } from "@nestjs/terminus";
import type { HealthIndicatorResult } from "@nestjs/terminus";

import { HEALTH_AWS_PORT } from "../../core/ports/aws.port";
import type { AwsPort } from "../../core/ports/aws.port";

// States in which the cluster still serves queries; anything else means it cannot.
const SERVING_STATUSES = new Set([
  "available",
  "backing-up",
  "modifying",
  "upgrading",
  "maintenance",
  "renaming",
  "storage-optimization",
]);

// Asks AWS rather than the database. A connection every few minutes would stop the cluster from
// ever reaching the idle time it needs to pause, and any connection attempt wakes a paused one.
@Injectable()
export class DatabaseHealthIndicator {
  constructor(
    private readonly healthIndicatorService: HealthIndicatorService,
    private readonly configService: ConfigService,
    @Inject(HEALTH_AWS_PORT)
    private readonly awsPort: AwsPort,
  ) {}

  async check(): Promise<HealthIndicatorResult<"database">> {
    const indicator = this.healthIndicatorService.check("database");
    const clusterIdentifier = this.configService.get<string>("health.databaseClusterIdentifier");

    if (!clusterIdentifier) {
      return indicator.down({ reason: "No database cluster identifier is configured" });
    }

    const status = await this.awsPort.databaseClusterStatus(clusterIdentifier);
    if (status.isFailure()) {
      return indicator.down({ reason: status.error.message });
    }
    if (!SERVING_STATUSES.has(status.value)) {
      return indicator.down({ reason: `The cluster is ${status.value}` });
    }

    const capacity = await this.awsPort.latestDatabaseCapacity(clusterIdentifier);
    const isPaused = capacity.isSuccess() && capacity.value === 0;

    return indicator.up({ paused: isPaused });
  }
}
