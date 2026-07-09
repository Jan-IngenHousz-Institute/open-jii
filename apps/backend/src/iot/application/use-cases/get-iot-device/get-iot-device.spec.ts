import { faker } from "@faker-js/faker";

import { assertFailure, assertSuccess } from "../../../../common/utils/fp-utils";
import { TestHarness } from "../../../../test/test-harness";
import { GetIotDeviceUseCase } from "./get-iot-device";

describe("GetIotDeviceUseCase", () => {
  const testApp = TestHarness.App;
  let useCase: GetIotDeviceUseCase;
  let userId: string;

  beforeAll(async () => {
    await testApp.setup();
  });

  beforeEach(async () => {
    await testApp.beforeEach();
    userId = await testApp.createTestUser({ name: "Owner" });
    useCase = testApp.module.get(GetIotDeviceUseCase);
  });

  afterEach(() => {
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
  });

  it("returns 404 for a missing device", async () => {
    const result = await useCase.execute(faker.string.uuid(), userId);

    assertFailure(result);
    expect(result.error.statusCode).toBe(404);
  });

  it("returns 404 for another user's device", async () => {
    const otherUser = await testApp.createTestUser({});
    const device = await testApp.createIotDevice({ createdBy: otherUser });

    const result = await useCase.execute(device.id, userId);

    assertFailure(result);
    expect(result.error.statusCode).toBe(404);
  });
});
