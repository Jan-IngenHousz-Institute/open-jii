import type { AnyContractProcedure } from "@orpc/contract";
import { StatusCodes } from "http-status-codes";

import { FEATURE_FLAGS } from "@repo/analytics";
import { contract } from "@repo/api/contract";
import type {
  DeviceFirmwareVersion,
  DeviceMonitoring,
  IotDeviceActivity,
  ObservedExperiment,
} from "@repo/api/domains/iot/iot.schema";
import { experimentDevices } from "@repo/database";

import { AnalyticsAdapter } from "../../common/modules/analytics/analytics.adapter";
import { success } from "../../common/utils/fp-utils";
import type { MockAnalyticsAdapter } from "../../test/mocks/adapters/analytics.adapter.mock";
import { TestHarness } from "../../test/test-harness";
import type { SuperTestResponse } from "../../test/test-harness";
import { IOT_SERVING_STORE_PORT } from "../core/ports/serving-store.port";
import type { ServingStorePort } from "../core/ports/serving-store.port";

const THING = "device-page-thing";
const RANGE = { from: "2026-10-19T00:00:00.000Z", to: "2026-10-19T23:59:59.000Z", bucket: "hour" };

/** A measurement as the feed writes it, from the device that publishes as THING. */
function measurement(id: number, experimentId: string, timestamp: string, deviceVersion: string) {
  return {
    experiment_id: experimentId,
    id,
    device_id: "sensor-1",
    client_id: THING,
    timestamp,
    device_version: deviceVersion,
    questions_data: {},
    annotations: [],
    macros: [],
    _commit_version: 1,
    _commit_timestamp: "2026-10-20 09:00:00",
  };
}

describe("A device's page, read from the serving store's device views", () => {
  const testApp = TestHarness.App;
  let ada: string;
  let deviceId: string;
  let experimentId: string;

  function read(route: AnyContractProcedure, userId: string, status: StatusCodes) {
    const path = testApp.resolveOrpcPath(route, { deviceId });
    return testApp.get(path).withAuth(userId).query(RANGE).expect(status);
  }

  beforeAll(async () => {
    await testApp.setup({ mock: { AnalyticsAdapter: true } });
  });

  beforeEach(async () => {
    await testApp.beforeEach();
    const analytics: MockAnalyticsAdapter = testApp.module.get(AnalyticsAdapter);
    analytics.setFlag(FEATURE_FLAGS.STORE_EXPERIMENT_READS, true);

    ada = await testApp.createTestUser({ name: "Ada Lovelace" });
    const device = await testApp.createIotDevice({
      createdBy: ada,
      thingName: THING,
      visibility: "private",
    });
    deviceId = device.id;
    const { experiment } = await testApp.createExperiment({ name: "Device page", userId: ada });
    experimentId = experiment.id;

    // Two readings on 2.1 within an hour, then one on 2.2, and one outside the range.
    await testApp.store.insert({
      table: "measurements",
      values: [
        measurement(1, experimentId, "2026-10-19 10:05:00", "2.1"),
        measurement(2, experimentId, "2026-10-19 10:40:00", "2.1"),
        measurement(3, experimentId, "2026-10-19 11:10:00", "2.2"),
        measurement(4, experimentId, "2026-10-20 09:00:00", "2.2"),
      ],
      format: "JSONEachRow",
    });
    // Device pages read from the store only once a reload has written device events. The suite's
    // one app caches that answer, which an earlier spec may have left false, so it is stubbed here
    // and tested against the store in the data source's spec.
    const servingStore: ServingStorePort = testApp.module.get(IOT_SERVING_STORE_PORT);
    vi.spyOn(servingStore, "hasDeviceEventsLoaded").mockResolvedValue(success(true));
  });

  afterEach(() => {
    testApp.afterEach();
  });

  afterAll(async () => {
    await testApp.teardown();
  });

  const firmwareRuns: DeviceFirmwareVersion[] = [
    {
      version: "2.1",
      firstSeen: "2026-10-19T10:05:00.000Z",
      lastSeen: "2026-10-19T10:40:00.000Z",
      count: 2,
    },
    {
      version: "2.2",
      firstSeen: "2026-10-19T11:10:00.000Z",
      lastSeen: "2026-10-19T11:10:00.000Z",
      count: 1,
    },
  ];

  it("shows its owner the firmware it reported in the range, run by run", async () => {
    const response: SuperTestResponse<{ versions: DeviceFirmwareVersion[] }> = await read(
      contract.iot.getDeviceFirmwareHistory,
      ada,
      StatusCodes.OK,
    );

    expect(response.body.versions).toEqual(firmwareRuns);
  });

  it("refuses someone who does not own it", async () => {
    const stranger = await testApp.createTestUser({ name: "Cleo Stranger" });

    await read(contract.iot.getDeviceFirmwareHistory, stranger, StatusCodes.FORBIDDEN);
  });

  describe("to a viewer through one experiment's binding", () => {
    let bea: string;
    let hiddenId: string;

    beforeEach(async () => {
      bea = await testApp.createTestUser({ name: "Bea Viewer" });
      await testApp.database
        .insert(experimentDevices)
        .values({ experimentId, deviceId, addedBy: ada });
      await testApp.addExperimentCollaborator(experimentId, bea);
      const { experiment: hidden } = await testApp.createExperiment({
        name: "Hidden",
        userId: ada,
      });
      hiddenId = hidden.id;

      // As many newer readings as the page lists, on a firmware and battery of their own.
      await testApp.store.insert({
        table: "measurements",
        values: Array.from({ length: 50 }, (_, index) => ({
          ...measurement(
            100 + index,
            hiddenId,
            `2026-10-19 12:${String(index).padStart(2, "0")}:00`,
            "9.9",
          ),
          device_battery: 10,
        })),
        format: "JSONEachRow",
      });
    });

    it("shows nothing of another private experiment on the monitoring page", async () => {
      const response: SuperTestResponse<DeviceMonitoring> = await read(
        contract.iot.getDeviceMonitoring,
        bea,
        StatusCodes.OK,
      );

      expect(JSON.stringify(response.body)).not.toContain(hiddenId);
      expect(response.body.throughput).toEqual([
        { bucketStart: "2026-10-19T10:00:00.000Z", experimentId, count: 2 },
        { bucketStart: "2026-10-19T11:00:00.000Z", experimentId, count: 1 },
      ]);
      expect(response.body.battery.map(({ averageBattery }) => averageBattery)).toEqual([
        null,
        null,
      ]);
      expect(response.body.payload.totalMeasurements).toBe(3);
      expect(response.body.firmwareHistory).toEqual(firmwareRuns);
      expect(response.body.recentMeasurements.map(({ timestamp }) => timestamp)).toEqual([
        "2026-10-19T11:10:00.000Z",
        "2026-10-19T10:40:00.000Z",
        "2026-10-19T10:05:00.000Z",
      ]);
    });

    it("lists only the experiment it can read among those the device fed", async () => {
      const response: SuperTestResponse<{ experiments: ObservedExperiment[] }> = await read(
        contract.iot.listDeviceObservedExperiments,
        bea,
        StatusCodes.OK,
      );

      expect(response.body.experiments).toEqual([
        { experimentId, count: 3, lastAt: "2026-10-19T00:00:00.000Z" },
      ]);
    });

    it("shows only the firmware the device reported into the experiment it can read", async () => {
      const response: SuperTestResponse<{ versions: DeviceFirmwareVersion[] }> = await read(
        contract.iot.getDeviceFirmwareHistory,
        bea,
        StatusCodes.OK,
      );

      expect(response.body.versions).toEqual(firmwareRuns);
    });

    it("dates the device's last data by the experiment it can read", async () => {
      await testApp.store.insert({
        table: "measurements",
        values: [measurement(200, hiddenId, "2026-10-21 08:00:00", "9.9")],
        format: "JSONEachRow",
      });
      const path = testApp.resolveOrpcPath(contract.iot.getIotDeviceActivity, { deviceId });

      const asBea: SuperTestResponse<IotDeviceActivity> = await testApp
        .get(path)
        .withAuth(bea)
        .expect(StatusCodes.OK);
      const asAda: SuperTestResponse<IotDeviceActivity> = await testApp
        .get(path)
        .withAuth(ada)
        .expect(StatusCodes.OK);

      expect(asBea.body).toEqual({
        lastDataAt: "2026-10-20T09:00:00.000Z",
        pipelineUnavailable: false,
      });
      expect(asAda.body.lastDataAt).toBe("2026-10-21T08:00:00.000Z");
    });
  });
});
