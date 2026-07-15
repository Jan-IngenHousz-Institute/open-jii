import { eq, experiments, workbookVersions } from "@repo/database";

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

    const byDevice = await repository.listExperimentsByDeviceForOwner(device.id, userId);
    assertSuccess(byDevice);
    expect(byDevice.value).toHaveLength(1);
    expect(byDevice.value?.[0].name).toBe("Alpha");
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
    const listed = await repository.listExperimentsByDeviceForOwner(device.id, userId);
    assertSuccess(listed);
    expect(listed.value).toEqual([]);
  });

  it("distinguishes a missing device (null) from a device with no bindings ([])", async () => {
    const stranger = await testApp.createTestUser({});
    const mine = await testApp.createIotDevice({ createdBy: userId });
    const theirs = await testApp.createIotDevice({ createdBy: stranger });

    const unbound = await repository.listExperimentsByDeviceForOwner(mine.id, userId);
    assertSuccess(unbound);
    expect(unbound.value).toEqual([]);

    const notMine = await repository.listExperimentsByDeviceForOwner(theirs.id, userId);
    assertSuccess(notMine);
    expect(notMine.value).toBeNull();
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

  it("degrades a nonconforming pinned workbook to null instead of failing the whole call", async () => {
    const device = await testApp.createIotDevice({ createdBy: userId });
    const { experiment: healthy } = await testApp.createExperiment({ name: "Healthy", userId });
    const { experiment: poisoned } = await testApp.createExperiment({ name: "Poisoned", userId });
    await repository.addExperiments(device.id, [healthy.id, poisoned.id], userId);

    const workbook = await testApp.createWorkbook({ name: "WB", createdBy: userId });
    const [badVersion] = await testApp.database
      .insert(workbookVersions)
      .values({
        workbookId: workbook.id,
        version: 1,
        // Not a valid cell shape: predates the current cell schema.
        cells: [{ kind: "legacy-cell" }],
        metadata: {},
        entitySnapshots: { protocols: {}, macros: {} },
        createdBy: userId,
      })
      .returning();
    await testApp.database
      .update(experiments)
      .set({ workbookId: workbook.id, workbookVersionId: badVersion.id })
      .where(eq(experiments.id, poisoned.id));

    const onboarding = await repository.listOnboardingExperiments(device.id);

    assertSuccess(onboarding);
    expect(onboarding.value).toHaveLength(2);
    const poisonedRow = onboarding.value.find((row) => row.experimentId === poisoned.id);
    expect(poisonedRow?.workbook).toBeNull();
  });
});
