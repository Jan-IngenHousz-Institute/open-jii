import { AppError, assertFailure, assertSuccess, failure } from "../../../../common/utils/fp-utils";
import { ExperimentRepository } from "../../../../experiments/core/repositories/experiment.repository";
import { TestHarness } from "../../../../test/test-harness";
import { ExperimentDeviceRepository } from "../../../core/repositories/experiment-device.repository";
import { ListDeviceExperimentsUseCase } from "./list-device-experiments";

describe("ListDeviceExperimentsUseCase", () => {
  const testApp = TestHarness.App;
  let useCase: ListDeviceExperimentsUseCase;
  let repository: ExperimentDeviceRepository;
  let experimentRepository: ExperimentRepository;
  let userId: string;

  beforeAll(async () => {
    await testApp.setup();
  });

  beforeEach(async () => {
    await testApp.beforeEach();
    userId = await testApp.createTestUser({ name: "Owner" });
    useCase = testApp.module.get(ListDeviceExperimentsUseCase);
    repository = testApp.module.get(ExperimentDeviceRepository);
    experimentRepository = testApp.module.get(ExperimentRepository);
  });

  afterEach(() => {
    vi.restoreAllMocks();
    testApp.afterEach();
  });

  afterAll(async () => {
    await testApp.teardown();
  });

  it("returns not found for an unknown device", async () => {
    const result = await useCase.execute("11111111-1111-4111-8111-111111111111", userId);

    assertFailure(result);
    expect(result.error.statusCode).toBe(404);
  });

  it("lists every binding the caller can read", async () => {
    const device = await testApp.createIotDevice({ createdBy: userId });
    const { experiment: first } = await testApp.createExperiment({ name: "First", userId });
    const { experiment: second } = await testApp.createExperiment({ name: "Second", userId });
    await repository.addExperiments(device.id, [first.id, second.id], userId);

    const result = await useCase.execute(device.id, userId);

    assertSuccess(result);
    expect(result.value.map((binding) => binding.id).sort()).toEqual([first.id, second.id].sort());
  });

  it("hides bindings whose experiments the caller cannot read", async () => {
    const device = await testApp.createIotDevice({ createdBy: userId });
    const { experiment: hidden } = await testApp.createExperiment({ name: "Private", userId });
    const { experiment: visible } = await testApp.createExperiment({
      name: "Public",
      userId,
      visibility: "public",
    });
    await repository.addExperiments(device.id, [hidden.id, visible.id], userId);

    const stranger = await testApp.createTestUser({});
    const result = await useCase.execute(device.id, stranger);

    assertSuccess(result);
    expect(result.value.map((binding) => binding.id)).toEqual([visible.id]);
  });

  it("propagates an access-check failure instead of hiding bindings", async () => {
    const device = await testApp.createIotDevice({ createdBy: userId });
    const { experiment } = await testApp.createExperiment({ name: "E", userId });
    await repository.addExperiments(device.id, [experiment.id], userId);

    vi.spyOn(experimentRepository, "checkAccess").mockResolvedValue(
      failure(AppError.internal("access lookup failed")),
    );

    const result = await useCase.execute(device.id, userId);

    assertFailure(result);
    expect(result.error.message).toBe("access lookup failed");
  });
});
