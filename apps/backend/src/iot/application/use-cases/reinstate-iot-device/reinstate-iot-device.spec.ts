import { assertFailure, assertSuccess } from "../../../../common/utils/fp-utils";
import { TestHarness } from "../../../../test/test-harness";
import { ReinstateIotDeviceUseCase } from "./reinstate-iot-device";

describe("ReinstateIotDeviceUseCase", () => {
  const testApp = TestHarness.App;
  let useCase: ReinstateIotDeviceUseCase;
  let userId: string;

  beforeAll(async () => {
    await testApp.setup();
  });

  beforeEach(async () => {
    await testApp.beforeEach();
    userId = await testApp.createTestUser({ name: "Owner" });
    useCase = testApp.module.get(ReinstateIotDeviceUseCase);
  });

  afterEach(() => {
    testApp.afterEach();
  });

  afterAll(async () => {
    await testApp.teardown();
  });

  it("returns a retired instrument as registered, since retiring revoked its certificate", async () => {
    const device = await testApp.createIotDevice({ createdBy: userId, status: "retired" });

    const result = await useCase.execute(device.id, userId);

    assertSuccess(result);
    expect(result.value.status).toBe("registered");
  });

  it("returns a retired phone straight to active, having no certificate to miss", async () => {
    const device = await testApp.createIotDevice({
      createdBy: userId,
      deviceType: "mobile",
      status: "retired",
    });

    const result = await useCase.execute(device.id, userId);

    assertSuccess(result);
    expect(result.value.status).toBe("active");
  });

  it("refuses a device that is not retired", async () => {
    const device = await testApp.createIotDevice({ createdBy: userId, status: "active" });

    assertFailure(await useCase.execute(device.id, userId));
  });
});
