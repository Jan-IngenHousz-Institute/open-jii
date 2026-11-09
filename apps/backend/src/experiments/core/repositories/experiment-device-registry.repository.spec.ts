import { assertSuccess } from "../../../common/utils/fp-utils";
import { TestHarness } from "../../../test/test-harness";
import { ExperimentDeviceRegistryRepository } from "./experiment-device-registry.repository";

describe("ExperimentDeviceRegistryRepository", () => {
  const testApp = TestHarness.App;
  let repository: ExperimentDeviceRegistryRepository;

  beforeAll(async () => {
    await testApp.setup();
  });

  beforeEach(async () => {
    await testApp.beforeEach();
    repository = testApp.module.get(ExperimentDeviceRegistryRepository);
  });

  afterEach(() => {
    testApp.afterEach();
  });

  afterAll(async () => {
    await testApp.teardown();
  });

  it("finds registered devices by the thing name they publish under", async () => {
    const owner = await testApp.createTestUser({});
    const device = await testApp.createIotDevice({
      createdBy: owner,
      serialNumber: "SN-42",
      thingName: "thing-42",
      deviceType: "ambyte",
    });

    const result = await repository.findByThingNames(["thing-42", "phone-client"]);

    assertSuccess(result);
    expect(result.value).toEqual([
      {
        thingName: "thing-42",
        id: device.id,
        serialNumber: "SN-42",
        createdBy: owner,
        status: "registered",
        deviceType: "ambyte",
      },
    ]);
  });

  it("looks nothing up for no names", async () => {
    const result = await repository.findByThingNames([]);

    assertSuccess(result);
    expect(result.value).toEqual([]);
  });
});
