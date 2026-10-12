import { Inject, Injectable, Logger } from "@nestjs/common";
import { HealthIndicatorService } from "@nestjs/terminus";
import type { HealthIndicatorResult } from "@nestjs/terminus";

import { HEALTH_AWS_PORT } from "../../core/ports/aws.port";
import type { AwsPort } from "../../core/ports/aws.port";

// States in which the cluster still serves queries; anything else means it cannot.
const SERVING_STATUSES = new Set([
  "available",
  "backing-up",
  "maintenance",
  "modifying",
  "renaming",
  "resetting-master-credentials",
  "storage-optimization",
  "update-iam-db-auth",
  "upgrading",
]);

// Asks AWS rather than the database. A connection every few minutes would stop the cluster from
// ever reaching the idle time it needs to pause, and any connection attempt wakes a paused one.
@Injectable()
export class DatabaseHealthIndicator {
  private readonly logger = new Logger(DatabaseHealthIndicator.name);

  constructor(
    private readonly healthIndicatorService: HealthIndicatorService,
    @Inject(HEALTH_AWS_PORT)
    private readonly awsPort: AwsPort,
  ) {}

  async check(clusterIdentifier: string): Promise<HealthIndicatorResult<"database">> {
    const indicator = this.healthIndicatorService.check("database");

    const status = await this.awsPort.databaseClusterStatus(clusterIdentifier);
    if (status.isFailure()) {
      return indicator.down({ reason: status.error.message });
    }
    if (!SERVING_STATUSES.has(status.value)) {
      return indicator.down({ reason: `The cluster is ${status.value}` });
    }

    // Capacity only tells a paused cluster from a running one, so a failed read leaves it up.
    const capacity = await this.awsPort.latestDatabaseCapacity(clusterIdentifier);
    if (capacity.isFailure()) {
      this.logger.warn({
        msg: "Failed to read database capacity",
        errorCode: capacity.error.code,
        operation: "checkDatabase",
        error: capacity.error.message,
      });
    }
    const isPaused = capacity.isSuccess() && capacity.value === 0;

    return indicator.up({ paused: isPaused });
  }
}
