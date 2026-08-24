import { faker } from "@faker-js/faker";

import { assertFailure, assertSuccess, failure, success } from "../../../../common/utils/fp-utils";
import { AppError } from "../../../../common/utils/fp-utils";
import { TestHarness } from "../../../../test/test-harness";
import { GetDeviceFirmwareHistoryUseCase } from "../get-device-firmware-history/get-device-firmware-history";
import { GetIotDeviceFirmwareHistoryUseCase } from "./get-iot-device-firmware-history";

const RANGE = { from: "2026-07-15T00:00:00.000Z", to: "2026-08-14T00:00:00.000Z" } as const;

describe("GetIotDeviceFirmwareHistoryUseCase", () => {
  const testApp = TestHarness.App;
  let useCase: GetIotDeviceFirmwareHistoryUseCase;
  let inner: GetDeviceFirmwareHistoryUseCase;
  let userId: string;

  beforeAll(async () => {
    await testApp.setup();
  });

  beforeEach(async () => {
    await testApp.beforeEach();
    userId = await testApp.createTestUser({ name: "Owner" });
    useCase = testApp.module.get(GetIotDeviceFirmwareHistoryUseCase);
    inner = testApp.module.get(GetDeviceFirmwareHistoryUseCase);
  });

  afterEach(() => {
    vi.restoreAllMocks();
    testApp.afterEach();
  });

  afterAll(async () => {
    await testApp.teardown();
  });

  it("resolves the device's thing name before reading the warehouse", async () => {
    const device = await testApp.createIotDevice({ createdBy: userId });
    const execute = vi.spyOn(inner, "execute").mockResolvedValue(success([]));

    const result = await useCase.execute(device.id, RANGE.from, RANGE.to, "day");

    assertSuccess(result);
    expect(execute).toHaveBeenCalledWith(device.thingName, RANGE.from, RANGE.to, "day");
  });

  it("returns 404 for a device that does not exist", async () => {
    const result = await useCase.execute(faker.string.uuid(), RANGE.from, RANGE.to, "day");

    assertFailure(result);
    expect(result.error.statusCode).toBe(404);
  });

  it("passes a warehouse failure through", async () => {
    const device = await testApp.createIotDevice({ createdBy: userId });
    vi.spyOn(inner, "execute").mockResolvedValue(failure(AppError.internal("boom")));

    const result = await useCase.execute(device.id, RANGE.from, RANGE.to, "day");

    assertFailure(result);
    expect(result.error.statusCode).toBe(500);
  });
});
