import { Logger } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import type { MockInstance } from "vitest";

import { AwsAdapter } from "../../../common/modules/aws/aws.adapter";
import { AppError, failure, success } from "../../../common/utils/fp-utils";
import { TestHarness } from "../../../test/test-harness";
import { NotificationDeliveryRepository } from "../../core/repositories/notification-delivery.repository";
import {
  NOTIFICATION_METRICS_NAMESPACE,
  NotificationOutboxMetricsService,
} from "./notification-outbox-metrics.service";

describe("NotificationOutboxMetricsService", () => {
  const testApp = TestHarness.App;
  let service: NotificationOutboxMetricsService;
  let publishMetrics: MockInstance<AwsAdapter["publishMetrics"]>;
  let countWaiting: MockInstance<NotificationDeliveryRepository["countWaiting"]>;
  let config: Record<string, string | undefined>;

  beforeAll(async () => {
    await testApp.setup();
  });

  beforeEach(async () => {
    await testApp.beforeEach();
    service = testApp.module.get(NotificationOutboxMetricsService);

    // The harness, like any local run, carries no cluster identifier; a case that
    // needs the deployed path sets one here.
    config = {};
    vi.spyOn(ConfigService.prototype, "get").mockImplementation((key: string) => config[key]);

    publishMetrics = vi
      .spyOn(testApp.module.get(AwsAdapter), "publishMetrics")
      .mockResolvedValue(success(undefined));
    countWaiting = vi
      .spyOn(testApp.module.get(NotificationDeliveryRepository), "countWaiting")
      .mockResolvedValue(success({ waiting: 4, oldestWaitingSeconds: 932 }));
  });

  afterEach(() => {
    testApp.afterEach();
  });

  afterAll(async () => {
    await testApp.teardown();
  });

  const deployed = () => {
    config = {
      "health.databaseClusterIdentifier": "open-jii-dev-db-cluster",
      "health.environment": "dev",
    };
  };

  function published() {
    expect(publishMetrics).toHaveBeenCalledOnce();
    const [namespace, metrics] = publishMetrics.mock.calls[0];
    expect(namespace).toBe(NOTIFICATION_METRICS_NAMESPACE);
    return metrics;
  }

  it("publishes nothing outside the deployed service", async () => {
    await service.publishGauges();
    await service.publishOutcomes({ sent: 2, retried: 0, deferred: 0, skipped: 0, failed: 1 });

    expect(countWaiting).not.toHaveBeenCalled();
    expect(publishMetrics).not.toHaveBeenCalled();
  });

  it("publishes how many emails are waiting and the age of the oldest", async () => {
    deployed();

    await service.publishGauges();

    expect(published()).toEqual([
      {
        name: "NotificationEmailsWaiting",
        value: 4,
        unit: "Count",
        dimensions: { Environment: "dev" },
      },
      {
        name: "NotificationEmailOldestWaitingSeconds",
        value: 932,
        unit: "Seconds",
        dimensions: { Environment: "dev" },
      },
    ]);
  });

  it("publishes one point per outcome a drain recorded, and none for the rest", async () => {
    deployed();

    await service.publishOutcomes({ sent: 2, retried: 0, deferred: 0, skipped: 0, failed: 1 });

    expect(published()).toEqual([
      {
        name: "NotificationEmails",
        value: 2,
        unit: "Count",
        dimensions: { Environment: "dev", Outcome: "sent" },
      },
      {
        name: "NotificationEmails",
        value: 1,
        unit: "Count",
        dimensions: { Environment: "dev", Outcome: "failed" },
      },
    ]);
  });

  it("publishes nothing for a drain that recorded nothing", async () => {
    deployed();

    await service.publishOutcomes({ sent: 0, retried: 0, deferred: 0, skipped: 0, failed: 0 });

    expect(publishMetrics).not.toHaveBeenCalled();
  });

  it("logs a failed publish as a warning and resolves", async () => {
    deployed();
    publishMetrics.mockResolvedValue(failure(AppError.internal("AccessDenied")));
    const warn = vi.spyOn(Logger.prototype, "warn").mockImplementation(() => undefined);

    await expect(
      service.publishOutcomes({ sent: 1, retried: 0, deferred: 0, skipped: 0, failed: 0 }),
    ).resolves.toBeUndefined();
    await expect(service.publishGauges()).resolves.toBeUndefined();

    expect(warn).toHaveBeenCalledTimes(2);
    expect(warn).toHaveBeenCalledWith(
      expect.objectContaining({ operation: "notification-outbox-metrics" }),
    );
  });

  it("logs a failed count as a warning and publishes nothing", async () => {
    deployed();
    countWaiting.mockResolvedValue(failure(AppError.internal("Database unavailable")));
    const warn = vi.spyOn(Logger.prototype, "warn").mockImplementation(() => undefined);

    await expect(service.publishGauges()).resolves.toBeUndefined();

    expect(publishMetrics).not.toHaveBeenCalled();
    expect(warn).toHaveBeenCalledExactlyOnceWith(
      expect.objectContaining({ operation: "notification-outbox-metrics" }),
    );
  });
});
