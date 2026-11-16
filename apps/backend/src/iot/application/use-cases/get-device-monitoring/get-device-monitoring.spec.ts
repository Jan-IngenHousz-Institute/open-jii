import { faker } from "@faker-js/faker";
import { Logger } from "@nestjs/common";

import { DatabricksAdapter } from "../../../../common/modules/databricks/databricks.adapter";
import {
  AppError,
  assertFailure,
  assertSuccess,
  failure,
  success,
} from "../../../../common/utils/fp-utils";
import { TestHarness } from "../../../../test/test-harness";
import type { DeviceReads } from "../../../core/ports/device-reads.port";
import { IOT_SERVING_STORE_PORT } from "../../../core/ports/serving-store.port";
import type { ServingStorePort } from "../../../core/ports/serving-store.port";
import { GetDeviceMonitoringUseCase } from "./get-device-monitoring";

const FROM = "2026-08-13T00:00:00.000Z";
const TO = "2026-08-13T12:00:00.000Z";

describe("GetDeviceMonitoringUseCase", () => {
  const testApp = TestHarness.App;
  let useCase: GetDeviceMonitoringUseCase;
  let databricksAdapter: DatabricksAdapter;
  let servingStore: ServingStorePort;
  let userId: string;

  beforeAll(async () => {
    await testApp.setup();
  });

  beforeEach(async () => {
    await testApp.beforeEach();
    userId = await testApp.createTestUser({ name: "Owner" });
    useCase = testApp.module.get(GetDeviceMonitoringUseCase);
    databricksAdapter = testApp.module.get(DatabricksAdapter);
    servingStore = testApp.module.get(IOT_SERVING_STORE_PORT);
    vi.spyOn(databricksAdapter, "getDeviceLifecycleEvents").mockResolvedValue(success([]));
    vi.spyOn(databricksAdapter, "getDeviceThroughput").mockResolvedValue(success([]));
    vi.spyOn(databricksAdapter, "getDeviceBatterySeries").mockResolvedValue(success([]));
    vi.spyOn(databricksAdapter, "getDevicePayloadBreakdown").mockResolvedValue(success([]));
    vi.spyOn(databricksAdapter, "getDeviceMacroBreakdown").mockResolvedValue(success([]));
    vi.spyOn(databricksAdapter, "getDeviceFirmwareHistory").mockResolvedValue(success([]));
    vi.spyOn(databricksAdapter, "getDeviceRecentMeasurements").mockResolvedValue(success([]));
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

    const result = await useCase.execute(device.id, FROM, TO, "hour", userId, "warehouse");

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

    const result = await useCase.execute(device.id, FROM, TO, "hour", userId, "warehouse");

    assertFailure(result);
  });

  it("fails loudly when the session log fails", async () => {
    const device = await testApp.createIotDevice({ createdBy: userId });
    vi.spyOn(databricksAdapter, "getDeviceLifecycleEvents").mockResolvedValue(
      failure(AppError.internal("warehouse down")),
    );

    const result = await useCase.execute(device.id, FROM, TO, "hour", userId, "warehouse");

    assertFailure(result);
  });

  it("fails loudly when the battery series fails", async () => {
    const device = await testApp.createIotDevice({ createdBy: userId });
    vi.spyOn(databricksAdapter, "getDeviceBatterySeries").mockResolvedValue(
      failure(AppError.internal("warehouse down")),
    );

    const result = await useCase.execute(device.id, FROM, TO, "hour", userId, "warehouse");

    assertFailure(result);
  });

  it("fails loudly when the payload breakdown fails", async () => {
    const device = await testApp.createIotDevice({ createdBy: userId });
    vi.spyOn(databricksAdapter, "getDevicePayloadBreakdown").mockResolvedValue(
      failure(AppError.internal("warehouse down")),
    );

    const result = await useCase.execute(device.id, FROM, TO, "hour", userId, "warehouse");

    assertFailure(result);
  });

  it("fails loudly when the measurement log fails", async () => {
    const device = await testApp.createIotDevice({ createdBy: userId });
    vi.spyOn(databricksAdapter, "getDeviceRecentMeasurements").mockResolvedValue(
      failure(AppError.internal("warehouse down")),
    );

    const result = await useCase.execute(device.id, FROM, TO, "hour", userId, "warehouse");

    assertFailure(result);
  });

  it("returns 404 for a missing device", async () => {
    const result = await useCase.execute(
      faker.string.uuid(),
      FROM,
      TO,
      "hour",
      userId,
      "warehouse",
    );

    assertFailure(result);
    expect(result.error.statusCode).toBe(404);
  });

  it("reads every section from the store, not the warehouse, when the source is the store", async () => {
    const device = await testApp.createIotDevice({ createdBy: userId });
    const experimentId = faker.string.uuid();
    const events = [
      {
        eventType: "connected",
        eventTimestamp: "2026-08-13T01:00:00.000Z",
        disconnectReason: null,
        sessionIdentifier: "s-1",
      },
      {
        eventType: "disconnected",
        eventTimestamp: "2026-08-13T03:00:00.000Z",
        disconnectReason: "CONNECTION_LOST",
        sessionIdentifier: "s-1",
      },
    ];
    const throughput = [{ bucketStart: "2026-08-13T01:00:00.000Z", experimentId, count: 12 }];
    const battery = [{ bucketStart: "2026-08-13T01:00:00.000Z", averageBattery: 88 }];
    const breakdown = [
      {
        deviceVersion: "2.1",
        protocolId: "p1",
        workbookVersionId: null,
        workbookRunId: "wr1",
        count: 12,
        withGps: 3,
        withBattery: 12,
      },
    ];
    const firmware = [
      {
        version: "2.1",
        firstSeen: "2026-08-13T01:05:00.000Z",
        lastSeen: "2026-08-13T01:55:00.000Z",
        count: 12,
      },
    ];
    const measurements = [
      {
        timestamp: "2026-08-13T01:55:00.000Z",
        experimentId,
        protocolId: "p1",
        workbookVersionId: null,
        deviceVersion: "2.1",
        battery: 88,
        latitude: 52.1,
        longitude: 5.1,
        sample: '{"par":120}',
      },
    ];
    const answerWith = (reads: DeviceReads) => [
      vi.spyOn(reads, "getDeviceLifecycleEvents").mockResolvedValue(success(events)),
      vi.spyOn(reads, "getDeviceThroughput").mockResolvedValue(success(throughput)),
      vi.spyOn(reads, "getDeviceBatterySeries").mockResolvedValue(success(battery)),
      vi.spyOn(reads, "getDevicePayloadBreakdown").mockResolvedValue(success(breakdown)),
      vi
        .spyOn(reads, "getDeviceMacroBreakdown")
        .mockResolvedValue(success([{ macroId: "m1", count: 12 }])),
      vi.spyOn(reads, "getDeviceFirmwareHistory").mockResolvedValue(success(firmware)),
      vi.spyOn(reads, "getDeviceRecentMeasurements").mockResolvedValue(success(measurements)),
    ];
    const warehouseReads = answerWith(databricksAdapter);
    const storeReads = answerWith(servingStore);

    const fromWarehouse = await useCase.execute(device.id, FROM, TO, "hour", userId, "warehouse");
    const fromStore = await useCase.execute(device.id, FROM, TO, "hour", userId, "store");

    assertSuccess(fromWarehouse);
    assertSuccess(fromStore);
    expect(fromStore.value).toEqual(fromWarehouse.value);
    expect(fromStore.value.recentMeasurements).toEqual(measurements);
    for (const read of [...warehouseReads, ...storeReads]) {
      expect(read).toHaveBeenCalledOnce();
    }
    for (const read of storeReads) {
      expect(read.mock.calls[0][0]).toBe(device.thingName);
    }
  });

  it("reads nothing from the store for a device that does not exist", async () => {
    const store = vi.spyOn(servingStore, "getDeviceThroughput");

    const result = await useCase.execute(faker.string.uuid(), FROM, TO, "hour", userId, "store");

    assertFailure(result);
    expect(result.error.statusCode).toBe(404);
    expect(store).not.toHaveBeenCalled();
  });

  it("logs the source a device page reads from", async () => {
    const logSpy = vi.spyOn(Logger.prototype, "log").mockImplementation(() => undefined);

    await useCase.execute(faker.string.uuid(), FROM, TO, "hour", userId, "store");

    expect(logSpy).toHaveBeenCalledWith(
      expect.objectContaining({ operation: "getDeviceMonitoring", source: "store" }),
    );
  });
});
