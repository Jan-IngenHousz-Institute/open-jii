import { assertSuccess } from "../../../common/utils/fp-utils";
import { TestHarness } from "../../../test/test-harness";
import { ExperimentDeviceRepository } from "./experiment-device.repository";

describe("ExperimentDeviceRepository", () => {
  const testApp = TestHarness.App;
  let repository: ExperimentDeviceRepository;
  let userId: string;

  beforeAll(async () => {
    await testApp.setup();
  });

  beforeEach(async () => {
    await testApp.beforeEach();
    userId = await testApp.createTestUser({ name: "Owner" });
    repository = testApp.module.get(ExperimentDeviceRepository);
  });

  afterEach(() => {
    testApp.afterEach();
  });

  afterAll(async () => {
    await testApp.teardown();
  });

  it("binds a device to experiments and lists it from both directions", async () => {
    const device = await testApp.createIotDevice({ createdBy: userId });
    const { experiment } = await testApp.createExperiment({ name: "Alpha", userId });

    const bound = await repository.addExperiments(device.id, [experiment.id], userId);
    assertSuccess(bound);

    const byExperiment = await repository.listByExperiment(experiment.id);
    assertSuccess(byExperiment);
    expect(byExperiment.value).toHaveLength(1);
    expect(byExperiment.value[0].device.serialNumber).toBe(device.serialNumber);
    expect(byExperiment.value[0].addedBy).toBe(userId);

    const byDevice = await repository.listExperimentsByDevice(device.id);
    assertSuccess(byDevice);
    expect(byDevice.value).toHaveLength(1);
    expect(byDevice.value[0].name).toBe("Alpha");
  });

  it("ignores a duplicate binding instead of raising a conflict", async () => {
    const device = await testApp.createIotDevice({ createdBy: userId });
    const { experiment } = await testApp.createExperiment({ name: "E", userId });

    await repository.addExperiments(device.id, [experiment.id], userId);
    const again = await repository.addExperiments(device.id, [experiment.id], userId);

    assertSuccess(again);
    const listed = await repository.listByExperiment(experiment.id);
    assertSuccess(listed);
    expect(listed.value).toHaveLength(1);
  });

  it("does nothing for an empty batch", async () => {
    const device = await testApp.createIotDevice({ createdBy: userId });

    const bound = await repository.addExperiments(device.id, [], userId);

    assertSuccess(bound);
    const listed = await repository.listExperimentsByDevice(device.id);
    assertSuccess(listed);
    expect(listed.value).toEqual([]);
  });

  it("reports whether a binding was actually removed", async () => {
    const device = await testApp.createIotDevice({ createdBy: userId });
    const { experiment } = await testApp.createExperiment({ name: "E", userId });
    await repository.addExperiments(device.id, [experiment.id], userId);

    const removed = await repository.removeDevice(experiment.id, device.id);
    assertSuccess(removed);
    expect(removed.value).toBe(true);

    const again = await repository.removeDevice(experiment.id, device.id);
    assertSuccess(again);
    expect(again.value).toBe(false);
  });

  it("returns a null workbook for experiments without a pinned version", async () => {
    const device = await testApp.createIotDevice({ createdBy: userId });
    const { experiment } = await testApp.createExperiment({ name: "Unpinned", userId });
    await repository.addExperiments(device.id, [experiment.id], userId);

    const onboarding = await repository.listOnboardingExperiments(device.id);

    assertSuccess(onboarding);
    expect(onboarding.value).toHaveLength(1);
    expect(onboarding.value[0].experimentName).toBe("Unpinned");
    expect(onboarding.value[0].workbook).toBeNull();
  });
});
