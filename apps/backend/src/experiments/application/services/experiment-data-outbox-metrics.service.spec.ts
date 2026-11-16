import { Logger } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import type { MockInstance } from "vitest";

import { AwsAdapter } from "../../../common/modules/aws/aws.adapter";
import { AppError, failure, success } from "../../../common/utils/fp-utils";
import { TestHarness } from "../../../test/test-harness";
import { ExperimentDataOutboxRepository } from "../../core/repositories/experiment-data-outbox.repository";
import {
  EXPERIMENT_DATA_METRICS_NAMESPACE,
  ExperimentDataOutboxMetricsService,
} from "./experiment-data-outbox-metrics.service";

describe("ExperimentDataOutboxMetricsService", () => {
  const testApp = TestHarness.App;
  let service: ExperimentDataOutboxMetricsService;
  let publishMetrics: MockInstance<AwsAdapter["publishMetrics"]>;
  let countWaiting: MockInstance<ExperimentDataOutboxRepository["countWaiting"]>;
  let config: Record<string, string | undefined>;

  beforeAll(async () => {
    await testApp.setup();
  });

  beforeEach(async () => {
    await testApp.beforeEach();
    service = testApp.module.get(ExperimentDataOutboxMetricsService);

    // The harness, like any local run, carries no cluster identifier; a case that needs the
    // deployed path sets one here.
    config = {};
    vi.spyOn(ConfigService.prototype, "get").mockImplementation((key: string) => config[key]);

    publishMetrics = vi
      .spyOn(testApp.module.get(AwsAdapter), "publishMetrics")
      .mockResolvedValue(success(undefined));
    countWaiting = vi
      .spyOn(testApp.module.get(ExperimentDataOutboxRepository), "countWaiting")
      .mockResolvedValue(success({ waiting: 3, oldestWaitingSeconds: 1900 }));
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

  it("publishes nothing outside the deployed service", async () => {
    await service.publishGauges();

    expect(countWaiting).not.toHaveBeenCalled();
    expect(publishMetrics).not.toHaveBeenCalled();
  });

  it("publishes how many copies are owed and the age of the oldest", async () => {
    deployed();

    await service.publishGauges();

    expect(publishMetrics).toHaveBeenCalledWith(EXPERIMENT_DATA_METRICS_NAMESPACE, [
      {
        name: "ExperimentDataCopiesWaiting",
        value: 3,
        unit: "Count",
        dimensions: { Environment: "dev" },
      },
      {
        name: "ExperimentDataCopyOldestWaitingSeconds",
        value: 1900,
        unit: "Seconds",
        dimensions: { Environment: "dev" },
      },
    ]);
  });

  it("publishes nothing and warns when the outbox cannot be counted", async () => {
    deployed();
    countWaiting.mockResolvedValue(failure(AppError.internal("connection refused")));
    const warn = vi.spyOn(Logger.prototype, "warn").mockImplementation(() => undefined);

    await service.publishGauges();

    expect(publishMetrics).not.toHaveBeenCalled();
    expect(warn).toHaveBeenCalledWith(
      expect.objectContaining({ msg: "Failed to count the waiting experiment data copies" }),
    );
  });
});
