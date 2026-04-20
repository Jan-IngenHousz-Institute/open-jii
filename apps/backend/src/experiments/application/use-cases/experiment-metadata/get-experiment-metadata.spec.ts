import { assertFailure, success, failure, AppError } from "../../../../common/utils/fp-utils";
import { TestHarness } from "../../../../test/test-harness";
import type { ExperimentMetadataDto } from "../../../core/models/experiment-metadata.model";
import { ExperimentMetadataRepository } from "../../../core/repositories/experiment-metadata.repository";
import { GetExperimentMetadataUseCase } from "./get-experiment-metadata";

describe("GetExperimentMetadataUseCase", () => {
  const testApp = TestHarness.App;
  let testUserId: string;
  let useCase: GetExperimentMetadataUseCase;
  let metadataRepository: ExperimentMetadataRepository;

  beforeAll(async () => {
    await testApp.setup();
  });

  beforeEach(async () => {
    await testApp.beforeEach();
    testUserId = await testApp.createTestUser({});
    useCase = testApp.module.get(GetExperimentMetadataUseCase);
    metadataRepository = testApp.module.get(ExperimentMetadataRepository);
  });

  afterEach(() => {
    testApp.afterEach();
  });

  afterAll(async () => {
    await testApp.teardown();
  });

  it("should return experiment metadata successfully", async () => {
    const { experiment } = await testApp.createExperiment({
      name: "Metadata Fetch Test",
      userId: testUserId,
    });

    const mockMetadata: ExperimentMetadataDto = {
      metadataId: "metadata-uuid-1",
      experimentId: experiment.id,
      metadata: { location: "GH 8.3", sampleCount: 42 },
      createdBy: testUserId,
      createdAt: new Date("2025-01-01"),
      updatedAt: new Date("2025-01-02"),
    };

    vi.spyOn(metadataRepository, "findAllByExperimentId").mockResolvedValue(
      success([mockMetadata]),
    );

    const result = await useCase.execute(experiment.id, testUserId);

    expect(result.isSuccess()).toBe(true);
    expect(result.value).toEqual([mockMetadata]);
    // eslint-disable-next-line @typescript-eslint/unbound-method
    expect(metadataRepository.findAllByExperimentId).toHaveBeenCalledWith(experiment.id);
  });

  it("should return empty array when no metadata exists", async () => {
    const { experiment } = await testApp.createExperiment({
      name: "No Metadata Test",
      userId: testUserId,
    });

    vi.spyOn(metadataRepository, "findAllByExperimentId").mockResolvedValue(success([]));

    const result = await useCase.execute(experiment.id, testUserId);

    expect(result.isSuccess()).toBe(true);
    expect(result.value).toEqual([]);
  });

  it("should return NOT_FOUND if experiment does not exist", async () => {
    const nonExistentId = "00000000-0000-0000-0000-000000000000";

    const result = await useCase.execute(nonExistentId, testUserId);

    expect(result.isSuccess()).toBe(false);
    assertFailure(result);
    expect(result.error.code).toBe("NOT_FOUND");
  });

  it("should return FORBIDDEN if user has no access and experiment is private", async () => {
    const { experiment } = await testApp.createExperiment({
      name: "Private Metadata Test",
      userId: testUserId,
      visibility: "private",
    });

    const otherUserId = await testApp.createTestUser({});

    const result = await useCase.execute(experiment.id, otherUserId);

    expect(result.isSuccess()).toBe(false);
    assertFailure(result);
    expect(result.error.code).toBe("FORBIDDEN");
    expect(result.error.message).toBe("You do not have access to this experiment");
  });

  it("should allow access to public experiment metadata for non-members", async () => {
    const { experiment } = await testApp.createExperiment({
      name: "Public Metadata Test",
      userId: testUserId,
      visibility: "public",
    });

    const mockMetadata: ExperimentMetadataDto = {
      metadataId: "metadata-uuid-public",
      experimentId: experiment.id,
      metadata: { publicField: "value" },
      createdBy: testUserId,
      createdAt: new Date("2025-01-01"),
      updatedAt: new Date("2025-01-02"),
    };

    vi.spyOn(metadataRepository, "findAllByExperimentId").mockResolvedValue(
      success([mockMetadata]),
    );

    const otherUserId = await testApp.createTestUser({});
    const result = await useCase.execute(experiment.id, otherUserId);

    expect(result.isSuccess()).toBe(true);
    expect(result.value).toEqual([mockMetadata]);
  });

  it("should propagate repository failure", async () => {
    const { experiment } = await testApp.createExperiment({
      name: "Metadata Fetch Failure Test",
      userId: testUserId,
    });

    vi.spyOn(metadataRepository, "findAllByExperimentId").mockResolvedValue(
      failure(AppError.internal("Databricks unavailable")),
    );

    const result = await useCase.execute(experiment.id, testUserId);

    expect(result.isSuccess()).toBe(false);
    assertFailure(result);
    expect(result.error.code).toBe("INTERNAL_ERROR");
  });
});
