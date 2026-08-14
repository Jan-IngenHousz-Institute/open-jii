import { faker } from "@faker-js/faker";

import { DatabricksAdapter } from "../../../../common/modules/databricks/databricks.adapter";
import {
  AppError,
  assertFailure,
  assertSuccess,
  failure,
  success,
} from "../../../../common/utils/fp-utils";
import { TestHarness } from "../../../../test/test-harness";
import { GetDeviceMonitoringUseCase } from "./get-device-monitoring";

const FROM = "2026-08-13T00:00:00.000Z";
const TO = "2026-08-13T12:00:00.000Z";

describe("GetDeviceMonitoringUseCase", () => {
  const testApp = TestHarness.App;
  let useCase: GetDeviceMonitoringUseCase;
  let databricksAdapter: DatabricksAdapter;
  let userId: string;

  beforeAll(async () => {
    await testApp.setup();
  });

  beforeEach(async () => {
    await testApp.beforeEach();
    userId = await testApp.createTestUser({ name: "Owner" });
    useCase = testApp.module.get(GetDeviceMonitoringUseCase);
    databricksAdapter = testApp.module.get(DatabricksAdapter);
    vi.spyOn(databricksAdapter, "getDeviceLifecycleEvents").mockResolvedValue(success([]));
    vi.spyOn(databricksAdapter, "getDeviceThroughput").mockResolvedValue(success([]));
    vi.spyOn(databricksAdapter, "getDeviceBatterySeries").mockResolvedValue(success([]));
    vi.spyOn(databricksAdapter, "getDevicePayloadBreakdown").mockResolvedValue(success([]));
  });

  afterEach(() => {
    vi.restoreAllMocks();
    testApp.afterEach();
  });

  afterAll(async () => {
    await testApp.teardown();
  });

  it("assembles all sections against the device's thing name", async () => {
    const device = await testApp.createIotDevice({ createdBy: userId });
    const experimentId = faker.string.uuid();
    const events = vi.spyOn(databricksAdapter, "getDeviceLifecycleEvents");
    vi.spyOn(databricksAdapter, "getDeviceThroughput").mockResolvedValue(
      success([{ bucketStart: "2026-08-13T01:00:00.000Z", experimentId, count: 12 }]),
    );
    vi.spyOn(databricksAdapter, "getDeviceBatterySeries").mockResolvedValue(
      success([
        { bucketStart: "2026-08-13T01:00:00.000Z", averageBattery: 88 },
        { bucketStart: null, averageBattery: null },
      ]),
    );

    const result = await useCase.execute(device.id, FROM, TO, "hour", userId);

    assertSuccess(result);
    expect(result.value.bucket).toBe("hour");
    expect(result.value.throughput).toEqual([
      { bucketStart: "2026-08-13T01:00:00.000Z", experimentId, count: 12 },
    ]);
    expect(result.value.battery).toEqual([
      { bucketStart: "2026-08-13T01:00:00.000Z", averageBattery: 88 },
    ]);
    expect(result.value.payload.totalMeasurements).toBe(0);
    expect(events).toHaveBeenCalledWith(device.thingName, FROM, TO, 1001);
  });

  it("fails loudly when any section fails, so the dashboard shows a real error", async () => {
    const device = await testApp.createIotDevice({ createdBy: userId });
    vi.spyOn(databricksAdapter, "getDeviceThroughput").mockResolvedValue(
      failure(AppError.internal("warehouse down")),
    );

    const result = await useCase.execute(device.id, FROM, TO, "hour", userId);

    assertFailure(result);
  });

  it("returns 404 for a missing device", async () => {
    const result = await useCase.execute(faker.string.uuid(), FROM, TO, "hour", userId);

    assertFailure(result);
    expect(result.error.statusCode).toBe(404);
  });
});
