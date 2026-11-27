import { FEATURE_FLAGS } from "@repo/analytics";

import { ServingStoreClientService } from "../../../common/modules/serving-store/services/client/client.service";
import { ServingStoreAdapter } from "../../../common/modules/serving-store/serving-store.adapter";
import { AppError, failure, success } from "../../../common/utils/fp-utils";
import { TestHarness } from "../../../test/test-harness";
import { ANALYTICS_PORT } from "../../core/ports/analytics.port";
import type { AnalyticsPort } from "../../core/ports/analytics.port";
import { IOT_DATABRICKS_PORT } from "../../core/ports/databricks.port";
import type { DatabricksPort } from "../../core/ports/databricks.port";
import { IOT_SERVING_STORE_PORT } from "../../core/ports/serving-store.port";
import type { ServingStorePort } from "../../core/ports/serving-store.port";
import { DeviceDataSourceService } from "./device-data-source.service";

describe("DeviceDataSourceService", () => {
  const testApp = TestHarness.App;
  const user = { id: "u1", email: "ada@example.com" };
  let service: DeviceDataSourceService;
  let analyticsPort: AnalyticsPort;
  let servingStore: ServingStorePort;
  let databricksPort: DatabricksPort;

  beforeAll(async () => {
    await testApp.setup();
  });

  beforeEach(async () => {
    await testApp.beforeEach();
    service = testApp.module.get(DeviceDataSourceService);
    analyticsPort = testApp.module.get(ANALYTICS_PORT);
    servingStore = testApp.module.get(IOT_SERVING_STORE_PORT);
    databricksPort = testApp.module.get(IOT_DATABRICKS_PORT);
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
    testApp.afterEach();
  });

  afterAll(async () => {
    await testApp.teardown();
  });

  it("reads from the store once its flag is on and a reload has written its device events", async () => {
    vi.spyOn(servingStore, "isConfigured").mockReturnValue(true);
    vi.spyOn(servingStore, "hasDeviceEventsLoaded").mockResolvedValue(success(true));
    const flag = vi.spyOn(analyticsPort, "isFeatureFlagEnabled").mockResolvedValue(true);

    const source = await service.sourceFor(user);

    expect(source).toBe("store");
    expect(flag).toHaveBeenCalledWith(FEATURE_FLAGS.STORE_EXPERIMENT_READS, user);
  });

  it("reads from the warehouse while the flag is off, without asking the store", async () => {
    vi.spyOn(servingStore, "isConfigured").mockReturnValue(true);
    vi.spyOn(analyticsPort, "isFeatureFlagEnabled").mockResolvedValue(false);
    const loaded = vi.spyOn(servingStore, "hasDeviceEventsLoaded");

    expect(await service.sourceFor(user)).toBe("warehouse");
    expect(loaded).not.toHaveBeenCalled();
  });

  it("reads from the warehouse where there is no store, whatever the flag says", async () => {
    vi.spyOn(servingStore, "isConfigured").mockReturnValue(false);
    const flag = vi.spyOn(analyticsPort, "isFeatureFlagEnabled").mockResolvedValue(true);

    expect(await service.sourceFor(user)).toBe("warehouse");
    expect(flag).not.toHaveBeenCalled();
  });

  it("reads from the warehouse when the store cannot say whether its device events are loaded", async () => {
    vi.spyOn(servingStore, "isConfigured").mockReturnValue(true);
    vi.spyOn(analyticsPort, "isFeatureFlagEnabled").mockResolvedValue(true);
    vi.spyOn(servingStore, "hasDeviceEventsLoaded").mockResolvedValue(
      failure(AppError.internal("store timed out")),
    );

    expect(await service.sourceFor(user)).toBe("warehouse");
  });

  it("reads from the warehouse until both full reloads have passed, then from the store", async () => {
    vi.useFakeTimers({ now: new Date("2026-10-21T12:00:00Z"), toFake: ["Date"] });
    vi.spyOn(analyticsPort, "isFeatureFlagEnabled").mockResolvedValue(true);
    // A task of its own, so no answer another spec left in the shared app's store adapter decides.
    const task = new DeviceDataSourceService(
      analyticsPort,
      new ServingStoreAdapter(testApp.module.get(ServingStoreClientService)),
      databricksPort,
    );
    const event = {
      client_id: "dev-1",
      event_type: "connected",
      event_timestamp: "2026-10-19 10:00:00",
      session_identifier: "s1",
      disconnect_reason: null,
      _commit_version: 1,
      _commit_timestamp: "2026-10-21 09:00:00",
    };
    const passed = (tableName: string) =>
      testApp.store.insert({
        table: "completed_reloads",
        values: [{ table_name: tableName, version: 1 }],
        format: "JSONEachRow",
      });
    await testApp.store.insert({ table: "device_events", values: [event], format: "JSONEachRow" });

    const fedOnly = await task.sourceFor(user);
    await passed("measurements");
    vi.setSystemTime(new Date("2026-10-21T12:01:01Z"));
    const oneReload = await task.sourceFor(user);
    await passed("device_events");
    const withinTheMinute = await task.sourceFor(user);
    vi.setSystemTime(new Date("2026-10-21T12:02:02Z"));
    const afterIt = await task.sourceFor(user);

    expect([fedOnly, oneReload, withinTheMinute, afterIt]).toEqual([
      "warehouse",
      "warehouse",
      "warehouse",
      "store",
    ]);
  });

  it("hands out each source's reads", () => {
    expect(service.readsFor("store")).toBe(servingStore);
    expect(service.readsFor("warehouse")).toBe(databricksPort);
  });
});
