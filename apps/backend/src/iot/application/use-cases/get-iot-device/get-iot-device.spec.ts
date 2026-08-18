import { faker } from "@faker-js/faker";

import { AwsAdapter } from "../../../../common/modules/aws/aws.adapter";
import {
  AppError,
  assertFailure,
  assertSuccess,
  failure,
  success,
} from "../../../../common/utils/fp-utils";
import { TestHarness } from "../../../../test/test-harness";
import { GetIotDeviceUseCase } from "./get-iot-device";

describe("GetIotDeviceUseCase", () => {
  const testApp = TestHarness.App;
  let useCase: GetIotDeviceUseCase;
  let awsAdapter: AwsAdapter;
  let userId: string;

  beforeAll(async () => {
    await testApp.setup();
  });

  beforeEach(async () => {
    await testApp.beforeEach();
    userId = await testApp.createTestUser({ name: "Owner" });
    useCase = testApp.module.get(GetIotDeviceUseCase);
    awsAdapter = testApp.module.get(AwsAdapter);
    vi.spyOn(awsAdapter, "searchThingsConnectivity").mockResolvedValue(success(new Map()));
  });

  afterEach(() => {
    vi.restoreAllMocks();
    testApp.afterEach();
  });

  afterAll(async () => {
    await testApp.teardown();
  });

  it("returns the owner's device", async () => {
    const device = await testApp.createIotDevice({ createdBy: userId });

    const result = await useCase.execute(device.id, userId);

    assertSuccess(result);
    expect(result.value.id).toBe(device.id);
    expect(result.value.serialNumber).toBe(device.serialNumber);
    expect(result.value.connectivity).toBeNull();
  });

  it("carries the device's fleet-index connectivity", async () => {
    const device = await testApp.createIotDevice({ createdBy: userId });
    vi.spyOn(awsAdapter, "searchThingsConnectivity").mockResolvedValue(
      success(
        new Map([
          [device.thingName, { thingName: device.thingName, connected: false, lastSeenAt: null }],
        ]),
      ),
    );

    const result = await useCase.execute(device.id, userId);

    assertSuccess(result);
    expect(result.value.connectivity).toEqual({ connected: false, lastSeenAt: null });
  });

  it("degrades to null connectivity when the fleet index is unavailable", async () => {
    const device = await testApp.createIotDevice({ createdBy: userId });
    vi.spyOn(awsAdapter, "searchThingsConnectivity").mockResolvedValue(
      failure(AppError.internal("index down")),
    );

    const result = await useCase.execute(device.id, userId);

    assertSuccess(result);
    expect(result.value.connectivity).toBeNull();
  });

  it("returns 404 for a missing device", async () => {
    const result = await useCase.execute(faker.string.uuid(), userId);

    assertFailure(result);
    expect(result.error.statusCode).toBe(404);
  });

  // Non-owner access is denied by the @CanAccess guard (device/read), covered in
  // authorization.service.spec + the controller spec — not by the use-case.
});
