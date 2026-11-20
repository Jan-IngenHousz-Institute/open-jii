import { Inject, Injectable, Logger } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { Cron, CronExpression } from "@nestjs/schedule";

import type { AppError } from "../../../common/utils/fp-utils";
import { EXPERIMENT_METRICS_PORT } from "../../core/ports/metrics.port";
import type { ExperimentMetric, MetricsPort } from "../../core/ports/metrics.port";
import { ExperimentDataOutboxRepository } from "../../core/repositories/experiment-data-outbox.repository";

export const EXPERIMENT_DATA_METRICS_NAMESPACE = "OpenJII/Backend";

/**
 * Publishes how many copies of annotations and metadata sheets are still owed, and how long the
 * oldest has been, so a copy stuck on every retry reaches someone. Only a deployed service
 * publishes; nothing here throws, so a CloudWatch failure never reaches a copy.
 */
@Injectable()
export class ExperimentDataOutboxMetricsService {
  private readonly logger = new Logger(ExperimentDataOutboxMetricsService.name);

  constructor(
    private readonly configService: ConfigService,
    private readonly outbox: ExperimentDataOutboxRepository,
    @Inject(EXPERIMENT_METRICS_PORT)
    private readonly metricsPort: MetricsPort,
  ) {}

  @Cron(CronExpression.EVERY_5_MINUTES)
  async publishGauges(): Promise<void> {
    const environment = this.deployedEnvironment();
    if (environment === null) {
      return;
    }

    const waiting = await this.outbox.countWaiting();
    if (waiting.isFailure()) {
      this.warn("Failed to count the waiting experiment data copies", waiting.error);
      return;
    }

    const dimensions = { Environment: environment };
    await this.publish([
      {
        name: "ExperimentDataCopiesWaiting",
        value: waiting.value.waiting,
        unit: "Count",
        dimensions,
      },
      {
        name: "ExperimentDataCopyOldestWaitingSeconds",
        value: waiting.value.oldestWaitingSeconds,
        unit: "Seconds",
        dimensions,
      },
    ]);
  }

  /** The cluster identifier is a setting only deployed services carry. */
  private deployedEnvironment(): string | null {
    if (!this.configService.get<string>("health.databaseClusterIdentifier")) {
      return null;
    }

    return this.configService.get<string>("health.environment") ?? "unknown";
  }

  private async publish(metrics: ExperimentMetric[]): Promise<void> {
    const published = await this.metricsPort.publishMetrics(
      EXPERIMENT_DATA_METRICS_NAMESPACE,
      metrics,
    );

    if (published.isFailure()) {
      this.warn("Failed to publish experiment data copy metrics", published.error);
    }
  }

  private warn(msg: string, error: AppError): void {
    this.logger.warn({ msg, operation: "experiment-data-outbox-metrics", error });
  }
}
