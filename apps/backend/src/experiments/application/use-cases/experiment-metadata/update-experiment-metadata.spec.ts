import { assertFailure, success, failure, AppError } from "../../../../common/utils/fp-utils";
import { TestHarness } from "../../../../test/test-harness";
import type {
  ExperimentMetadataDto,
  UpdateExperimentMetadataDto,
} from "../../../core/models/experiment-metadata.model";
import { ExperimentMetadataRepository } from "../../../core/repositories/experiment-metadata.repository";
import { UpdateExperimentMetadataUseCase } from "./update-experiment-metadata";

describe("UpdateExperimentMetadataUseCase", () => {
  const testApp = TestHarness.App;
  let testUserId: string;
  let useCase: UpdateExperimentMetadataUseCase;
  let metadataRepository: ExperimentMetadataRepository;

  beforeAll(async () => {
    await testApp.setup();
  });

  beforeEach(async () => {
    await testApp.beforeEach();
    testUserId = await testApp.createTestUser({});
    useCase = testApp.module.get(UpdateExperimentMetadataUseCase);
    metadataRepository = testApp.module.get(ExperimentMetadataRepository);
  });

  afterEach(() => {
    testApp.afterEach();
  });

  afterAll(async () => {
    await testApp.teardown();
  });

  const metadataId = "metadata-uuid-1";

  const sampleUpdate: UpdateExperimentMetadataDto = {
    metadata: { location: "GH 8.3 Updated", sampleCount: 20 },
  };

  it("should update experiment metadata successfully", async () => {
    const { experiment } = await testApp.createExperiment({
      name: "Metadata Update Test",
      userId: testUserId,
    });

    const mockResult: ExperimentMetadataDto = {
      metadataId,
      experimentId: experiment.id,
      metadata: sampleUpdate.metadata,
      createdBy: testUserId,
      createdAt: new Date("2025-01-01"),
      updatedAt: new Date("2025-01-02"),
    };

    vi.spyOn(metadataRepository, "update").mockResolvedValue(success(mockResult));

    const result = await useCase.execute(experiment.id, metadataId, sampleUpdate, testUserId);

    expect(result.isSuccess()).toBe(true);
    expect(result.value).toEqual(mockResult);
    // eslint-disable-next-line @typescript-eslint/unbound-method
    expect(metadataRepository.update).toHaveBeenCalledWith(
      metadataId,
      sampleUpdate,
      testUserId,
      experiment.id,
    );
  });

  it("should return NOT_FOUND if experiment does not exist", async () => {
    const nonExistentId = "00000000-0000-0000-0000-000000000000";

    const result = await useCase.execute(nonExistentId, metadataId, sampleUpdate, testUserId);

    expect(result.isSuccess()).toBe(false);
    assertFailure(result);
    expect(result.error.code).toBe("NOT_FOUND");
  });

  it("should return FORBIDDEN if user does not have archive access", async () => {
    const { experiment } = await testApp.createExperiment({
      name: "Forbidden Metadata Update Test",
      userId: testUserId,
    });

    const otherUserId = await testApp.createTestUser({});

    const result = await useCase.execute(experiment.id, metadataId, sampleUpdate, otherUserId);

    expect(result.isSuccess()).toBe(false);
    assertFailure(result);
    expect(result.error.code).toBe("FORBIDDEN");
    expect(result.error.message).toBe("You do not have write access to this experiment");
  });

  it("should propagate repository failure on update", async () => {
    const { experiment } = await testApp.createExperiment({
      name: "Metadata Update Failure Test",
      userId: testUserId,
    });

    vi.spyOn(metadataRepository, "update").mockResolvedValue(
      failure(AppError.internal("Databricks unavailable")),
    );

    const result = await useCase.execute(experiment.id, metadataId, sampleUpdate, testUserId);

    expect(result.isSuccess()).toBe(false);
    assertFailure(result);
    expect(result.error.code).toBe("INTERNAL_ERROR");
  });

  it("should allow members with archive access to update metadata", async () => {
    const { experiment } = await testApp.createExperiment({
      name: "Member Update Test",
      userId: testUserId,
    });

    const memberId = await testApp.createTestUser({});
    await testApp.addExperimentMember(experiment.id, memberId, "admin");

    const mockResult: ExperimentMetadataDto = {
      metadataId,
      experimentId: experiment.id,
      metadata: sampleUpdate.metadata,
      createdBy: memberId,
      createdAt: new Date("2025-01-01"),
      updatedAt: new Date("2025-01-02"),
    };

    vi.spyOn(metadataRepository, "update").mockResolvedValue(success(mockResult));

    const result = await useCase.execute(experiment.id, metadataId, sampleUpdate, memberId);

    expect(result.isSuccess()).toBe(true);
    expect(result.value).toEqual(mockResult);
  });
});
