import { Inject, Injectable, Logger } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { Cron, CronExpression } from "@nestjs/schedule";

import type { AppError } from "../../../common/utils/fp-utils";
import { NOTIFICATION_METRICS_PORT } from "../../core/ports/metrics.port";
import type { MetricsPort, NotificationMetric } from "../../core/ports/metrics.port";
import { NotificationDeliveryRepository } from "../../core/repositories/notification-delivery.repository";
import type { DrainCounts } from "./notification-outbox.worker";

export const NOTIFICATION_METRICS_NAMESPACE = "OpenJII/Backend";

/** A key added to `DrainCounts` starts no metric series until it is listed here too. */
const PUBLISHED_OUTCOMES = [
  "sent",
  "retried",
  "deferred",
  "skipped",
  "failed",
] as const satisfies readonly (keyof DrainCounts)[];

/**
 * Publishes what the outbox is doing to CloudWatch: how many emails each drain sent or
 * set back, and how many are still owed and for how long. Only a deployed service
 * publishes; nothing here throws, so a CloudWatch failure never reaches a delivery.
 */
@Injectable()
export class NotificationOutboxMetricsService {
  private readonly logger = new Logger(NotificationOutboxMetricsService.name);

  constructor(
    private readonly configService: ConfigService,
    private readonly deliveries: NotificationDeliveryRepository,
    @Inject(NOTIFICATION_METRICS_PORT)
    private readonly metricsPort: MetricsPort,
  ) {}

  @Cron(CronExpression.EVERY_5_MINUTES)
  async publishGauges(): Promise<void> {
    const environment = this.deployedEnvironment();
    if (environment === null) {
      return;
    }

    const waiting = await this.deliveries.countWaiting();
    if (waiting.isFailure()) {
      this.warn("Failed to count the waiting notification emails", waiting.error);
      return;
    }

    const dimensions = { Environment: environment };
    await this.publish([
      {
        name: "NotificationEmailsWaiting",
        value: waiting.value.waiting,
        unit: "Count",
        dimensions,
      },
      {
        name: "NotificationEmailOldestWaitingSeconds",
        value: waiting.value.oldestWaitingSeconds,
        unit: "Seconds",
        dimensions,
      },
    ]);
  }

  async publishOutcomes(counts: DrainCounts): Promise<void> {
    const environment = this.deployedEnvironment();
    if (environment === null) {
      return;
    }

    const metrics = PUBLISHED_OUTCOMES.filter((outcome) => counts[outcome] > 0).map(
      (outcome): NotificationMetric => ({
        name: "NotificationEmails",
        value: counts[outcome],
        unit: "Count",
        dimensions: { Environment: environment, Outcome: outcome },
      }),
    );

    if (metrics.length > 0) {
      await this.publish(metrics);
    }
  }

  /** The cluster identifier is a setting only deployed services carry. */
  private deployedEnvironment(): string | null {
    if (!this.configService.get<string>("health.databaseClusterIdentifier")) {
      return null;
    }

    return this.configService.get<string>("health.environment") ?? "unknown";
  }

  private async publish(metrics: NotificationMetric[]): Promise<void> {
    const published = await this.metricsPort.publishMetrics(
      NOTIFICATION_METRICS_NAMESPACE,
      metrics,
    );

    if (published.isFailure()) {
      this.warn("Failed to publish notification email metrics", published.error);
    }
  }

  private warn(msg: string, error: AppError): void {
    this.logger.warn({ msg, operation: "notification-outbox-metrics", error });
  }
}
