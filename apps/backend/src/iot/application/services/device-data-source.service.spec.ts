import { FEATURE_FLAGS } from "@repo/analytics";

import { TestHarness } from "../../../test/test-harness";
import { ANALYTICS_PORT } from "../../core/ports/analytics.port";
import type { AnalyticsPort } from "../../core/ports/analytics.port";
import { IOT_DATABRICKS_PORT } from "../../core/ports/databricks.port";
import { IOT_SERVING_STORE_PORT } from "../../core/ports/serving-store.port";
import type { ServingStorePort } from "../../core/ports/serving-store.port";
import { DeviceDataSourceService } from "./device-data-source.service";

describe("DeviceDataSourceService", () => {
  const testApp = TestHarness.App;
  const user = { id: "u1", email: "ada@example.com" };
  let service: DeviceDataSourceService;
  let analyticsPort: AnalyticsPort;
  let servingStore: ServingStorePort;

  beforeAll(async () => {
    await testApp.setup();
  });

  beforeEach(async () => {
    await testApp.beforeEach();
    service = testApp.module.get(DeviceDataSourceService);
    analyticsPort = testApp.module.get(ANALYTICS_PORT);
    servingStore = testApp.module.get(IOT_SERVING_STORE_PORT);
  });

  afterEach(() => {
    vi.restoreAllMocks();
    testApp.afterEach();
  });

  afterAll(async () => {
    await testApp.teardown();
  });

  it("reads from the store once its flag is on", async () => {
    vi.spyOn(servingStore, "isConfigured").mockReturnValue(true);
    const flag = vi.spyOn(analyticsPort, "isFeatureFlagEnabled").mockResolvedValue(true);

    const source = await service.sourceFor(user);

    expect(source).toBe("store");
    expect(flag).toHaveBeenCalledWith(FEATURE_FLAGS.STORE_EXPERIMENT_READS, user);
  });

  it("reads from the warehouse while the flag is off", async () => {
    vi.spyOn(servingStore, "isConfigured").mockReturnValue(true);
    vi.spyOn(analyticsPort, "isFeatureFlagEnabled").mockResolvedValue(false);

    expect(await service.sourceFor(user)).toBe("warehouse");
  });

  it("reads from the warehouse where there is no store, whatever the flag says", async () => {
    vi.spyOn(servingStore, "isConfigured").mockReturnValue(false);
    const flag = vi.spyOn(analyticsPort, "isFeatureFlagEnabled").mockResolvedValue(true);

    expect(await service.sourceFor(user)).toBe("warehouse");
    expect(flag).not.toHaveBeenCalled();
  });

  it("hands out each source's reads", () => {
    expect(service.readsFor("store")).toBe(servingStore);
    expect(service.readsFor("warehouse")).toBe(testApp.module.get(IOT_DATABRICKS_PORT));
  });
});
