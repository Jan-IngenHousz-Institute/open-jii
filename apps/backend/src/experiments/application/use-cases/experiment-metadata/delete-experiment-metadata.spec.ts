import { assertFailure, success, failure, AppError } from "../../../../common/utils/fp-utils";
import { TestHarness } from "../../../../test/test-harness";
import { ExperimentMetadataRepository } from "../../../core/repositories/experiment-metadata.repository";
import { DeleteExperimentMetadataUseCase } from "./delete-experiment-metadata";

describe("DeleteExperimentMetadataUseCase", () => {
  const testApp = TestHarness.App;
  let testUserId: string;
  let useCase: DeleteExperimentMetadataUseCase;
  let metadataRepository: ExperimentMetadataRepository;

  beforeAll(async () => {
    await testApp.setup();
  });

  beforeEach(async () => {
    await testApp.beforeEach();
    testUserId = await testApp.createTestUser({});
    useCase = testApp.module.get(DeleteExperimentMetadataUseCase);
    metadataRepository = testApp.module.get(ExperimentMetadataRepository);
    vi.restoreAllMocks();
  });

  afterEach(() => {
    testApp.afterEach();
  });

  afterAll(async () => {
    await testApp.teardown();
  });

  it("should delete experiment metadata successfully", async () => {
    const { experiment } = await testApp.createExperiment({
      name: "Metadata Delete Test",
      userId: testUserId,
    });

    vi.spyOn(metadataRepository, "deleteByExperimentId").mockResolvedValue(success(true));

    const result = await useCase.execute(experiment.id, testUserId);

    expect(result.isSuccess()).toBe(true);
    expect(metadataRepository.deleteByExperimentId).toHaveBeenCalledWith(experiment.id);
  });

  it("should return NOT_FOUND if experiment does not exist", async () => {
    const nonExistentId = "00000000-0000-0000-0000-000000000000";

    const result = await useCase.execute(nonExistentId, testUserId);

    expect(result.isSuccess()).toBe(false);
    assertFailure(result);
    expect(result.error.code).toBe("NOT_FOUND");
  });

  it("should return FORBIDDEN if user does not have archive access", async () => {
    const { experiment } = await testApp.createExperiment({
      name: "Forbidden Metadata Delete Test",
      userId: testUserId,
    });

    const otherUserId = await testApp.createTestUser({});

    const result = await useCase.execute(experiment.id, otherUserId);

    expect(result.isSuccess()).toBe(false);
    assertFailure(result);
    expect(result.error.code).toBe("FORBIDDEN");
    expect(result.error.message).toBe("You do not have write access to this experiment");
  });

  it("should return failure if metadata repository delete fails", async () => {
    const { experiment } = await testApp.createExperiment({
      name: "Metadata Delete Failure Test",
      userId: testUserId,
    });

    vi.spyOn(metadataRepository, "deleteByExperimentId").mockResolvedValue(
      failure(AppError.internal("Databricks connection failed")),
    );

    const result = await useCase.execute(experiment.id, testUserId);

    expect(result.isSuccess()).toBe(false);
    assertFailure(result);
    expect(result.error.code).toBe("INTERNAL_ERROR");
  });
});
