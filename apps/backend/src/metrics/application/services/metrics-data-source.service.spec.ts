import { FEATURE_FLAGS } from "@repo/analytics";

import { DatabricksAdapter } from "../../../common/modules/databricks/databricks.adapter";
import { TestHarness } from "../../../test/test-harness";
import { ANALYTICS_PORT } from "../../core/ports/analytics.port";
import type { AnalyticsPort } from "../../core/ports/analytics.port";
import { METRICS_SERVING_STORE_PORT } from "../../core/ports/serving-store.port";
import type { ServingStorePort } from "../../core/ports/serving-store.port";
import { MetricsDataSourceService } from "./metrics-data-source.service";
import { MetricsStoreReadsService } from "./metrics-store-reads.service";

describe("MetricsDataSourceService", () => {
  const testApp = TestHarness.App;
  let service: MetricsDataSourceService;
  let analyticsPort: AnalyticsPort;
  let servingStore: ServingStorePort;

  beforeAll(async () => {
    await testApp.setup();
  });

  beforeEach(async () => {
    await testApp.beforeEach();
    service = testApp.module.get(MetricsDataSourceService);
    analyticsPort = testApp.module.get(ANALYTICS_PORT);
    servingStore = testApp.module.get(METRICS_SERVING_STORE_PORT);
  });

  afterEach(() => {
    testApp.afterEach();
  });

  afterAll(async () => {
    await testApp.teardown();
  });

  it("reads from the store once its flag is on", async () => {
    vi.spyOn(servingStore, "isConfigured").mockReturnValue(true);
    const flag = vi.spyOn(analyticsPort, "isEnvironmentFeatureFlagEnabled").mockResolvedValue(true);

    const source = await service.sourceFor();

    expect(source).toBe("store");
    expect(flag).toHaveBeenCalledWith(FEATURE_FLAGS.STORE_EXPERIMENT_READS);
  });

  it("reads from the warehouse while the flag is off", async () => {
    vi.spyOn(servingStore, "isConfigured").mockReturnValue(true);
    vi.spyOn(analyticsPort, "isEnvironmentFeatureFlagEnabled").mockResolvedValue(false);

    expect(await service.sourceFor()).toBe("warehouse");
  });

  it("reads from the warehouse without a store, whatever the flag says", async () => {
    const flag = vi.spyOn(analyticsPort, "isEnvironmentFeatureFlagEnabled").mockResolvedValue(true);

    expect(servingStore.isConfigured()).toBe(false);
    expect(await service.sourceFor()).toBe("warehouse");
    expect(flag).not.toHaveBeenCalled();
  });

  it("reads each source through its own reads", () => {
    expect(service.readsFor("warehouse")).toBe(testApp.module.get(DatabricksAdapter));
    expect(service.readsFor("store")).toBe(testApp.module.get(MetricsStoreReadsService));
  });
});
