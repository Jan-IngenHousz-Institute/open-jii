import { assertFailure, success, failure, AppError } from "../../../../common/utils/fp-utils";
import { TestHarness } from "../../../../test/test-harness";
import type {
  ExperimentMetadataDto,
  CreateExperimentMetadataDto,
} from "../../../core/models/experiment-metadata.model";
import { ExperimentMetadataRepository } from "../../../core/repositories/experiment-metadata.repository";
import { UpsertExperimentMetadataUseCase } from "./upsert-experiment-metadata";

describe("UpsertExperimentMetadataUseCase", () => {
  const testApp = TestHarness.App;
  let testUserId: string;
  let useCase: UpsertExperimentMetadataUseCase;
  let metadataRepository: ExperimentMetadataRepository;

  beforeAll(async () => {
    await testApp.setup();
  });

  beforeEach(async () => {
    await testApp.beforeEach();
    testUserId = await testApp.createTestUser({});
    useCase = testApp.module.get(UpsertExperimentMetadataUseCase);
    metadataRepository = testApp.module.get(ExperimentMetadataRepository);
    vi.restoreAllMocks();
  });

  afterEach(() => {
    testApp.afterEach();
  });

  afterAll(async () => {
    await testApp.teardown();
  });

  const sampleMetadata: CreateExperimentMetadataDto = {
    metadata: { location: "GH 8.3", sampleCount: 10 },
  };

  it("should upsert experiment metadata successfully", async () => {
    const { experiment } = await testApp.createExperiment({
      name: "Metadata Upsert Test",
      userId: testUserId,
    });

    const mockResult: ExperimentMetadataDto = {
      metadataId: "metadata-uuid-1",
      experimentId: experiment.id,
      metadata: sampleMetadata.metadata,
      createdBy: testUserId,
      createdAt: new Date("2025-01-01"),
      updatedAt: new Date("2025-01-01"),
    };

    vi.spyOn(metadataRepository, "upsert").mockResolvedValue(success(mockResult));

    const result = await useCase.execute(experiment.id, sampleMetadata, testUserId);

    expect(result.isSuccess()).toBe(true);
    expect(result.value).toEqual(mockResult);
    expect(metadataRepository.upsert).toHaveBeenCalledWith(
      experiment.id,
      sampleMetadata,
      testUserId,
    );
  });

  it("should return NOT_FOUND if experiment does not exist", async () => {
    const nonExistentId = "00000000-0000-0000-0000-000000000000";

    const result = await useCase.execute(nonExistentId, sampleMetadata, testUserId);

    expect(result.isSuccess()).toBe(false);
    assertFailure(result);
    expect(result.error.code).toBe("NOT_FOUND");
  });

  it("should return FORBIDDEN if user does not have archive access", async () => {
    const { experiment } = await testApp.createExperiment({
      name: "Forbidden Metadata Upsert Test",
      userId: testUserId,
    });

    const otherUserId = await testApp.createTestUser({});

    const result = await useCase.execute(experiment.id, sampleMetadata, otherUserId);

    expect(result.isSuccess()).toBe(false);
    assertFailure(result);
    expect(result.error.code).toBe("FORBIDDEN");
    expect(result.error.message).toBe("You do not have write access to this experiment");
  });

  it("should propagate repository failure on upsert", async () => {
    const { experiment } = await testApp.createExperiment({
      name: "Metadata Upsert Failure Test",
      userId: testUserId,
    });

    vi.spyOn(metadataRepository, "upsert").mockResolvedValue(
      failure(AppError.internal("Databricks unavailable")),
    );

    const result = await useCase.execute(experiment.id, sampleMetadata, testUserId);

    expect(result.isSuccess()).toBe(false);
    assertFailure(result);
    expect(result.error.code).toBe("INTERNAL_ERROR");
  });

  it("should allow members with archive access to upsert metadata", async () => {
    const { experiment } = await testApp.createExperiment({
      name: "Member Upsert Test",
      userId: testUserId,
    });

    const memberId = await testApp.createTestUser({});
    await testApp.addExperimentMember(experiment.id, memberId, "admin");

    const mockResult: ExperimentMetadataDto = {
      metadataId: "metadata-uuid-member",
      experimentId: experiment.id,
      metadata: sampleMetadata.metadata,
      createdBy: memberId,
      createdAt: new Date("2025-01-01"),
      updatedAt: new Date("2025-01-01"),
    };

    vi.spyOn(metadataRepository, "upsert").mockResolvedValue(success(mockResult));

    const result = await useCase.execute(experiment.id, sampleMetadata, memberId);

    expect(result.isSuccess()).toBe(true);
    expect(result.value).toEqual(mockResult);
  });
});
