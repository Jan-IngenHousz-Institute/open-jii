import { eq, experiments } from "@repo/database";

import { assertFailure, assertSuccess } from "../../../../common/utils/fp-utils";
import { TestHarness } from "../../../../test/test-harness";
import { ExperimentDeviceRepository } from "../../../core/repositories/experiment-device.repository";
import { RemoveExperimentDeviceUseCase } from "./remove-experiment-device";

describe("RemoveExperimentDeviceUseCase", () => {
  const testApp = TestHarness.App;
  let useCase: RemoveExperimentDeviceUseCase;
  let repository: ExperimentDeviceRepository;
  let userId: string;

  beforeAll(async () => {
    await testApp.setup();
  });

  beforeEach(async () => {
    await testApp.beforeEach();
    userId = await testApp.createTestUser({ name: "Owner" });
    useCase = testApp.module.get(RemoveExperimentDeviceUseCase);
    repository = testApp.module.get(ExperimentDeviceRepository);
  });

  afterEach(() => {
    testApp.afterEach();
  });

  afterAll(async () => {
    await testApp.teardown();
  });

  const bindDevice = async (experimentId: string) => {
    const device = await testApp.createIotDevice({ createdBy: userId });
    await repository.addExperiments(device.id, [experimentId], userId);
    return device;
  };

  it("detaches a bound device as a member", async () => {
    const { experiment } = await testApp.createExperiment({ name: "E", userId });
    const device = await bindDevice(experiment.id);

    const result = await useCase.execute(experiment.id, device.id, userId);

    assertSuccess(result);
    const remaining = await repository.listByExperiment(experiment.id);
    assertSuccess(remaining);
    expect(remaining.value).toEqual([]);
  });

  it("allows detaching from an archived experiment", async () => {
    const { experiment } = await testApp.createExperiment({ name: "E", userId });
    const device = await bindDevice(experiment.id);

    await testApp.database
      .update(experiments)
      .set({ status: "archived" })
      .where(eq(experiments.id, experiment.id));

    const result = await useCase.execute(experiment.id, device.id, userId);

    assertSuccess(result);
  });

  it("allows an IAM updater who is not a member", async () => {
    const { experiment } = await testApp.createExperiment({ name: "E", userId });
    const device = await bindDevice(experiment.id);

    const orgAdmin = await testApp.createTestUser({});
    await testApp.addOrganizationMember(experiment.organizationId, orgAdmin, "admin");

    const result = await useCase.execute(experiment.id, device.id, orgAdmin);

    assertSuccess(result);
  });

  it("rejects a caller without update rights", async () => {
    const { experiment } = await testApp.createExperiment({ name: "E", userId });
    const device = await bindDevice(experiment.id);
    const stranger = await testApp.createTestUser({});

    const result = await useCase.execute(experiment.id, device.id, stranger);

    assertFailure(result);
    expect(result.error.statusCode).toBe(403);

    const remaining = await repository.listByExperiment(experiment.id);
    assertSuccess(remaining);
    expect(remaining.value).toHaveLength(1);
  });

  it("returns not found when the device is not bound", async () => {
    const { experiment } = await testApp.createExperiment({ name: "E", userId });
    const device = await testApp.createIotDevice({ createdBy: userId });

    const result = await useCase.execute(experiment.id, device.id, userId);

    assertFailure(result);
    expect(result.error.statusCode).toBe(404);
  });

  it("returns not found for an unknown experiment", async () => {
    const device = await testApp.createIotDevice({ createdBy: userId });

    const result = await useCase.execute("11111111-1111-4111-8111-111111111111", device.id, userId);

    assertFailure(result);
    expect(result.error.statusCode).toBe(404);
  });
});
