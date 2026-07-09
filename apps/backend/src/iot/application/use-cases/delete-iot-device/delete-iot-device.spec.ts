import { faker } from "@faker-js/faker";

import { eq, iotDevices } from "@repo/database";

import { AwsAdapter } from "../../../../common/modules/aws/aws.adapter";
import { assertFailure, assertSuccess, success } from "../../../../common/utils/fp-utils";
import { TestHarness } from "../../../../test/test-harness";
import { DeleteIotDeviceUseCase } from "./delete-iot-device";

describe("DeleteIotDeviceUseCase", () => {
  const testApp = TestHarness.App;
  let useCase: DeleteIotDeviceUseCase;
  let awsAdapter: AwsAdapter;
  let deleteThingSpy: ReturnType<typeof vi.spyOn>;
  let userId: string;

  beforeAll(async () => {
    await testApp.setup();
  });

  beforeEach(async () => {
    await testApp.beforeEach();
    userId = await testApp.createTestUser({ name: "Owner" });
    useCase = testApp.module.get(DeleteIotDeviceUseCase);
    awsAdapter = testApp.module.get(AwsAdapter);
    deleteThingSpy = vi.spyOn(awsAdapter, "deleteThing").mockResolvedValue(success(undefined));
  });

  afterEach(() => {
    testApp.afterEach();
  });

  afterAll(async () => {
    await testApp.teardown();
  });

  it("deletes the owner's device and its Thing", async () => {
    const device = await testApp.createIotDevice({ createdBy: userId });

    const result = await useCase.execute(device.id, userId);

    assertSuccess(result);
    expect(deleteThingSpy).toHaveBeenCalledWith(device.thingName);

    const rows = await testApp.database
      .select()
      .from(iotDevices)
      .where(eq(iotDevices.id, device.id));
    expect(rows).toHaveLength(0);
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
