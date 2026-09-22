import { DatabricksAdapter } from "../../../../common/modules/databricks/databricks.adapter";
import { assertSuccess, success, failure, AppError } from "../../../../common/utils/fp-utils";
import { TestHarness } from "../../../../test/test-harness";
import { GetIotFleetMonitoringUseCase } from "./get-iot-fleet-monitoring";

const WINDOW = {
  from: "2026-08-17T00:00:00.000Z",
  to: "2026-08-18T00:00:00.000Z",
  bucket: "hour",
} as const;

describe("GetIotFleetMonitoringUseCase", () => {
  const testApp = TestHarness.App;
  let useCase: GetIotFleetMonitoringUseCase;
  let databricksAdapter: DatabricksAdapter;
  let userId: string;

  beforeAll(async () => {
    await testApp.setup();
  });

  beforeEach(async () => {
    await testApp.beforeEach();
    userId = await testApp.createTestUser({ name: "Fleet Owner" });
    useCase = testApp.module.get(GetIotFleetMonitoringUseCase);
    databricksAdapter = testApp.module.get(DatabricksAdapter);
  });

  afterEach(() => {
    vi.restoreAllMocks();
    testApp.afterEach();
  });

  afterAll(async () => {
    await testApp.teardown();
  });

  it("joins the warehouse facts onto the caller's devices by thing name", async () => {
    const device = await testApp.createIotDevice({ createdBy: userId, name: "Gateway" });
    vi.spyOn(databricksAdapter, "getDevicesLastActivity").mockResolvedValue(
      success(new Map([[device.thingName, "2026-08-18T10:00:00.000Z"]])),
    );
    vi.spyOn(databricksAdapter, "getDevicesThroughput").mockResolvedValue(
      success([
        { bucketStart: "2026-08-17T10:00:00.000Z", clientId: device.thingName, count: 4 },
        { bucketStart: "2026-08-17T11:00:00.000Z", clientId: "someone-elses-thing", count: 9 },
      ]),
    );
    vi.spyOn(databricksAdapter, "getDevicesLifecycleEvents").mockResolvedValue(
      success([
        {
          clientId: device.thingName,
          eventType: "connected",
          eventTimestamp: "2026-08-17T09:00:00.000Z",
          disconnectReason: null,
        },
      ]),
    );

    const result = await useCase.execute(userId, WINDOW);

    assertSuccess(result);
    expect(result.value.devices).toEqual([
      { deviceId: device.id, lastDataAt: "2026-08-18T10:00:00.000Z" },
    ]);
    expect(result.value.throughput).toEqual([
      { bucketStart: "2026-08-17T10:00:00.000Z", deviceId: device.id, count: 4 },
      // A row for a thing outside the fleet cannot be attributed.
      { bucketStart: "2026-08-17T11:00:00.000Z", deviceId: null, count: 9 },
    ]);
    expect(result.value.events).toEqual([
      {
        deviceId: device.id,
        eventType: "connected",
        eventTimestamp: "2026-08-17T09:00:00.000Z",
        disconnectReason: null,
      },
    ]);
    expect(result.value.pipelineUnavailable).toBe(false);
  });

  it("answers an empty fleet without touching the warehouse", async () => {
    const activitySpy = vi.spyOn(databricksAdapter, "getDevicesLastActivity");

    const result = await useCase.execute(userId, WINDOW);

    assertSuccess(result);
    expect(result.value).toEqual({
      devices: [],
      throughput: [],
      events: [],
      pipelineUnavailable: false,
    });
    expect(activitySpy).not.toHaveBeenCalled();
  });

  it("degrades a failed warehouse fact to empty and flags the pipeline", async () => {
    const device = await testApp.createIotDevice({ createdBy: userId });
    vi.spyOn(databricksAdapter, "getDevicesLastActivity").mockResolvedValue(
      failure(AppError.internal("warehouse down")),
    );
    vi.spyOn(databricksAdapter, "getDevicesThroughput").mockResolvedValue(success([]));
    vi.spyOn(databricksAdapter, "getDevicesLifecycleEvents").mockResolvedValue(success([]));

    const result = await useCase.execute(userId, WINDOW);

    assertSuccess(result);
    expect(result.value.devices).toEqual([{ deviceId: device.id, lastDataAt: null }]);
    expect(result.value.pipelineUnavailable).toBe(true);
  });

  it("scopes the scan to devices the caller can read, not the whole registry", async () => {
    await testApp.createIotDevice({ createdBy: userId, name: "Mine" });
    const strangerId = await testApp.createTestUser({ name: "Stranger" });
    const strangersDevice = await testApp.createIotDevice({ createdBy: strangerId });

    const throughputSpy = vi
      .spyOn(databricksAdapter, "getDevicesThroughput")
      .mockResolvedValue(success([]));
    vi.spyOn(databricksAdapter, "getDevicesLastActivity").mockResolvedValue(success(new Map()));
    vi.spyOn(databricksAdapter, "getDevicesLifecycleEvents").mockResolvedValue(success([]));

    const result = await useCase.execute(userId, WINDOW);

    assertSuccess(result);
    const scannedThings = throughputSpy.mock.calls[0][0];
    expect(scannedThings).not.toContain(strangersDevice.thingName);
  });
});
