import { assertSuccess } from "../../../../common/utils/fp-utils";
import { TestHarness } from "../../../../test/test-harness";
import { ListIotDevicesUseCase } from "./list-iot-devices";

describe("ListIotDevicesUseCase", () => {
  const testApp = TestHarness.App;
  let useCase: ListIotDevicesUseCase;
  let userId: string;

  beforeAll(async () => {
    await testApp.setup();
  });

  beforeEach(async () => {
    await testApp.beforeEach();
    userId = await testApp.createTestUser({ name: "Owner" });
    useCase = testApp.module.get(ListIotDevicesUseCase);
  });

  afterEach(() => {
    testApp.afterEach();
  });

  afterAll(async () => {
    await testApp.teardown();
  });

  it("lists the user's own devices", async () => {
    await testApp.createIotDevice({ createdBy: userId });
    await testApp.createIotDevice({ createdBy: userId });

    const result = await useCase.execute(userId);

    assertSuccess(result);
    expect(result.value).toHaveLength(2);
  });

  it("does not list other users' devices", async () => {
    const otherUser = await testApp.createTestUser({});
    await testApp.createIotDevice({ createdBy: otherUser });

    const result = await useCase.execute(userId);

    assertSuccess(result);
    expect(result.value).toHaveLength(0);
  });
});
