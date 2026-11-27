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
import { IOT_SERVING_STORE_PORT } from "../../../core/ports/serving-store.port";
import type { ServingStorePort } from "../../../core/ports/serving-store.port";
import { GetIotDeviceActivityUseCase } from "./get-iot-device-activity";

describe("GetIotDeviceActivityUseCase", () => {
  const testApp = TestHarness.App;
  let useCase: GetIotDeviceActivityUseCase;
  let databricksAdapter: DatabricksAdapter;
  let servingStore: ServingStorePort;
  let userId: string;

  beforeAll(async () => {
    await testApp.setup();
  });

  beforeEach(async () => {
    await testApp.beforeEach();
    userId = await testApp.createTestUser({ name: "Owner" });
    useCase = testApp.module.get(GetIotDeviceActivityUseCase);
    databricksAdapter = testApp.module.get(DatabricksAdapter);
    servingStore = testApp.module.get(IOT_SERVING_STORE_PORT);
    vi.spyOn(databricksAdapter, "getDeviceExperimentIds").mockResolvedValue(success([]));
    vi.spyOn(servingStore, "getDeviceExperimentIds").mockResolvedValue(success([]));
  });

  afterEach(() => {
    vi.restoreAllMocks();
    testApp.afterEach();
  });

  afterAll(async () => {
    await testApp.teardown();
  });

  it("returns the device's last data arrival from the warehouse", async () => {
    const device = await testApp.createIotDevice({ createdBy: userId });
    const getLastActivity = vi
      .spyOn(databricksAdapter, "getDeviceLastActivity")
      .mockResolvedValue(success({ lastDataAt: "2026-08-13T09:00:00.000Z" }));

    const result = await useCase.execute(device.id, userId, "warehouse");

    assertSuccess(result);
    expect(result.value).toEqual({
      lastDataAt: "2026-08-13T09:00:00.000Z",
      pipelineUnavailable: false,
    });
    expect(getLastActivity).toHaveBeenCalledWith(device.thingName, []);
  });

  it("dates the last data by the experiments the caller can read, over every row", async () => {
    const device = await testApp.createIotDevice({ createdBy: userId });
    const { experiment: readable } = await testApp.createExperiment({ name: "Readable", userId });
    const otherOwner = await testApp.createTestUser({ name: "Other owner" });
    const { experiment: hidden } = await testApp.createExperiment({
      name: "Hidden",
      userId: otherOwner,
    });
    const claimed = vi
      .spyOn(databricksAdapter, "getDeviceExperimentIds")
      .mockResolvedValue(success([readable.id, hidden.id]));
    const getLastActivity = vi
      .spyOn(databricksAdapter, "getDeviceLastActivity")
      .mockResolvedValue(success({ lastDataAt: "2026-08-13T09:00:00.000Z" }));

    const result = await useCase.execute(device.id, userId, "warehouse");

    assertSuccess(result);
    expect(claimed).toHaveBeenCalledWith(device.thingName, undefined);
    expect(getLastActivity).toHaveBeenCalledWith(device.thingName, [readable.id]);
  });

  it("marks the lookup unavailable when the device's experiments cannot be read", async () => {
    const device = await testApp.createIotDevice({ createdBy: userId });
    vi.spyOn(databricksAdapter, "getDeviceExperimentIds").mockResolvedValue(
      failure(AppError.internal("warehouse down")),
    );
    const getLastActivity = vi.spyOn(databricksAdapter, "getDeviceLastActivity");

    const result = await useCase.execute(device.id, userId, "warehouse");

    assertSuccess(result);
    expect(result.value).toEqual({ lastDataAt: null, pipelineUnavailable: true });
    expect(getLastActivity).not.toHaveBeenCalled();
  });

  it("reports never-landed data as null with the pipeline available", async () => {
    const device = await testApp.createIotDevice({ createdBy: userId });
    vi.spyOn(databricksAdapter, "getDeviceLastActivity").mockResolvedValue(
      success({ lastDataAt: null }),
    );

    const result = await useCase.execute(device.id, userId, "warehouse");

    assertSuccess(result);
    expect(result.value).toEqual({ lastDataAt: null, pipelineUnavailable: false });
  });

  it("marks the lookup unavailable on a warehouse failure, never failing the panel", async () => {
    const device = await testApp.createIotDevice({ createdBy: userId });
    vi.spyOn(databricksAdapter, "getDeviceLastActivity").mockResolvedValue(
      failure(AppError.internal("warehouse down")),
    );

    const result = await useCase.execute(device.id, userId, "warehouse");

    assertSuccess(result);
    // Unknown, not "never sent data": the flag is what stops the frontend
    // from raising a device-health warning on a warehouse outage.
    expect(result.value).toEqual({ lastDataAt: null, pipelineUnavailable: true });
  });

  it("returns 404 for a missing device, which stays a real failure", async () => {
    const result = await useCase.execute(faker.string.uuid(), userId, "warehouse");

    assertFailure(result);
    expect(result.error.statusCode).toBe(404);
  });

  it.each([
    { name: "a last arrival", answer: success({ lastDataAt: "2026-08-13T09:00:00.000Z" }) },
    { name: "a failed read", answer: failure(AppError.internal("down")) },
  ])(
    "reads $name from the store, not the warehouse, when the source is the store",
    async ({ answer }) => {
      const device = await testApp.createIotDevice({ createdBy: userId });
      const warehouse = vi
        .spyOn(databricksAdapter, "getDeviceLastActivity")
        .mockResolvedValue(answer);
      const store = vi.spyOn(servingStore, "getDeviceLastActivity").mockResolvedValue(answer);

      const fromWarehouse = await useCase.execute(device.id, userId, "warehouse");
      const fromStore = await useCase.execute(device.id, userId, "store");

      assertSuccess(fromWarehouse);
      assertSuccess(fromStore);
      expect(fromStore.value).toEqual(fromWarehouse.value);
      expect(warehouse).toHaveBeenCalledOnce();
      expect(store).toHaveBeenCalledOnce();
      expect(store).toHaveBeenCalledWith(device.thingName, []);
    },
  );

  it("reads nothing from the store for a device that does not exist", async () => {
    const store = vi.spyOn(servingStore, "getDeviceLastActivity");

    const result = await useCase.execute(faker.string.uuid(), userId, "store");

    assertFailure(result);
    expect(result.error.statusCode).toBe(404);
    expect(store).not.toHaveBeenCalled();
  });
});
