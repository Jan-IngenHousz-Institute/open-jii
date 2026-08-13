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
import { GetIotDeviceActivityUseCase } from "./get-iot-device-activity";

describe("GetIotDeviceActivityUseCase", () => {
  const testApp = TestHarness.App;
  let useCase: GetIotDeviceActivityUseCase;
  let databricksAdapter: DatabricksAdapter;
  let userId: string;

  beforeAll(async () => {
    await testApp.setup();
  });

  beforeEach(async () => {
    await testApp.beforeEach();
    userId = await testApp.createTestUser({ name: "Owner" });
    useCase = testApp.module.get(GetIotDeviceActivityUseCase);
    databricksAdapter = testApp.module.get(DatabricksAdapter);
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

    const result = await useCase.execute(device.id, userId);

    assertSuccess(result);
    expect(result.value).toEqual({ lastDataAt: "2026-08-13T09:00:00.000Z" });
    expect(getLastActivity).toHaveBeenCalledWith(device.thingName);
  });

  it("returns null when the device has never landed data", async () => {
    const device = await testApp.createIotDevice({ createdBy: userId });
    vi.spyOn(databricksAdapter, "getDeviceLastActivity").mockResolvedValue(
      success({ lastDataAt: null }),
    );

    const result = await useCase.execute(device.id, userId);

    assertSuccess(result);
    expect(result.value).toEqual({ lastDataAt: null });
  });

  it("degrades to null when the warehouse is unavailable, never failing the panel", async () => {
    const device = await testApp.createIotDevice({ createdBy: userId });
    vi.spyOn(databricksAdapter, "getDeviceLastActivity").mockResolvedValue(
      failure(AppError.internal("warehouse down")),
    );

    const result = await useCase.execute(device.id, userId);

    assertSuccess(result);
    expect(result.value).toEqual({ lastDataAt: null });
  });

  it("returns 404 for a missing device, which stays a real failure", async () => {
    const result = await useCase.execute(faker.string.uuid(), userId);

    assertFailure(result);
    expect(result.error.statusCode).toBe(404);
  });
});
