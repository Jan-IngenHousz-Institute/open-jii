import { Inject, Injectable, Logger, ServiceUnavailableException } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { Cron, CronExpression } from "@nestjs/schedule";
import { HealthCheckService, HealthIndicatorService } from "@nestjs/terminus";
import type { HealthCheckResult, HealthIndicatorResult } from "@nestjs/terminus";

import { ErrorCodes } from "../../../common/utils/error-codes";
import { HEALTH_AWS_PORT } from "../../core/ports/aws.port";
import type { AwsPort, HealthMetric } from "../../core/ports/aws.port";
import { DatabaseHealthIndicator } from "../indicators/database.indicator";
import { DatabricksHealthIndicator } from "../indicators/databricks.indicator";
import { EmailHealthIndicator } from "../indicators/email.indicator";
import { IotHealthIndicator } from "../indicators/iot.indicator";

export const DEPENDENCY_HEALTH_NAMESPACE = "OpenJII/Backend";
export const DEPENDENCY_CHECK_TIMEOUT_MS = 10_000;

@Injectable()
export class DependencyHealthService {
  private readonly logger = new Logger(DependencyHealthService.name);

  constructor(
    private readonly healthCheckService: HealthCheckService,
    private readonly healthIndicatorService: HealthIndicatorService,
    private readonly configService: ConfigService,
    private readonly databaseIndicator: DatabaseHealthIndicator,
    private readonly databricksIndicator: DatabricksHealthIndicator,
    private readonly emailIndicator: EmailHealthIndicator,
    private readonly iotIndicator: IotHealthIndicator,
    @Inject(HEALTH_AWS_PORT)
    private readonly awsPort: AwsPort,
  ) {}

  @Cron(CronExpression.EVERY_5_MINUTES)
  async checkDependencies(): Promise<void> {
    if (!this.configService.get<boolean>("health.deployed")) {
      return;
    }

    const environment = this.configService.get<string>("health.environment") ?? "unknown";
    const durations = new Map<string, number>();
    const result = await this.runChecks(durations);
    const down = Object.entries(result.details)
      .filter(([, detail]) => detail.status === "down")
      .map(([dependency]) => dependency);

    if (down.length > 0) {
      this.logger.warn({
        msg: "Dependencies unreachable",
        operation: "checkDependencies",
        down,
        details: result.details,
      });
    }

    const published = await this.awsPort.publishMetrics(
      DEPENDENCY_HEALTH_NAMESPACE,
      this.metricsOf(result, durations, environment),
    );

    if (published.isFailure()) {
      this.logger.error({
        msg: "Failed to publish dependency health",
        errorCode: ErrorCodes.DEPENDENCY_HEALTH_PUBLISH_FAILED,
        operation: "checkDependencies",
        error: published.error,
      });
    }
  }

  private async runChecks(durations: Map<string, number>): Promise<HealthCheckResult> {
    try {
      return await this.healthCheckService.check([
        () => this.timed("database", () => this.databaseIndicator.check(), durations),
        () => this.timed("databricks", () => this.databricksIndicator.check(), durations),
        () => this.timed("email", () => this.emailIndicator.check(), durations),
        () => this.timed("iot", () => this.iotIndicator.check(), durations),
      ]);
    } catch (error) {
      // Terminus throws when any check is down, and the full result travels on the exception.
      if (error instanceof ServiceUnavailableException) {
        const response = error.getResponse();
        if (this.isHealthCheckResult(response)) {
          return response;
        }
      }
      throw error;
    }
  }

  private async timed<const Key extends string>(
    key: Key,
    check: () => Promise<HealthIndicatorResult<Key>>,
    durations: Map<string, number>,
  ): Promise<HealthIndicatorResult<Key>> {
    const started = Date.now();
    let timer: NodeJS.Timeout | undefined;
    const timeout = new Promise<HealthIndicatorResult<Key>>((resolve) => {
      timer = setTimeout(() => {
        resolve(
          this.healthIndicatorService
            .check(key)
            .down({ reason: `No answer within ${DEPENDENCY_CHECK_TIMEOUT_MS} ms` }),
        );
      }, DEPENDENCY_CHECK_TIMEOUT_MS);
    });

    try {
      return await Promise.race([check(), timeout]);
    } finally {
      clearTimeout(timer);
      durations.set(key, Date.now() - started);
    }
  }

  // Paused is reported only by the database, so only it carries that metric.
  private metricsOf(
    result: HealthCheckResult,
    durations: Map<string, number>,
    environment: string,
  ): HealthMetric[] {
    return Object.entries(result.details).flatMap(([dependency, detail]): HealthMetric[] => {
      const dimensions = { Environment: environment, Dependency: dependency };
      const metrics: HealthMetric[] = [
        { name: "DependencyUp", value: detail.status === "up" ? 1 : 0, unit: "Count", dimensions },
        {
          name: "DependencyCheckMilliseconds",
          value: durations.get(dependency) ?? 0,
          unit: "Milliseconds",
          dimensions,
        },
      ];
      if ("paused" in detail) {
        metrics.push({
          name: "DependencyPaused",
          value: detail.paused === true ? 1 : 0,
          unit: "Count",
          dimensions,
        });
      }
      return metrics;
    });
  }

  private isHealthCheckResult(value: unknown): value is HealthCheckResult {
    return (
      typeof value === "object" &&
      value !== null &&
      "details" in value &&
      typeof value.details === "object" &&
      value.details !== null
    );
  }
}
