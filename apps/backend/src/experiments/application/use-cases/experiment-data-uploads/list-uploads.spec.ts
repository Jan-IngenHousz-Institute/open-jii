import { faker } from "@faker-js/faker";

import {
  assertFailure,
  assertSuccess,
  success,
  failure,
  AppError,
} from "../../../../common/utils/fp-utils";
import { TestHarness } from "../../../../test/test-harness";
import type { UploadMetadata } from "../../../core/models/experiment-data-uploads.model";
import { ExperimentDataUploadsRepository } from "../../../core/repositories/experiment-data-uploads.repository";
import { ExperimentRepository } from "../../../core/repositories/experiment.repository";
import { ListUploadsUseCase } from "./list-uploads";

describe("ListUploadsUseCase", () => {
  const testApp = TestHarness.App;
  let testUserId: string;
  let useCase: ListUploadsUseCase;
  let uploadsRepository: ExperimentDataUploadsRepository;

  beforeAll(async () => {
    await testApp.setup();
  });

  beforeEach(async () => {
    await testApp.beforeEach();
    testUserId = await testApp.createTestUser({});

    useCase = testApp.module.get(ListUploadsUseCase);
    uploadsRepository = testApp.module.get(ExperimentDataUploadsRepository);
  });

  afterEach(() => {
    testApp.afterEach();
  });

  afterAll(async () => {
    await testApp.teardown();
  });

  it("should successfully list uploads with active and completed", async () => {
    const { experiment } = await testApp.createExperiment({
      name: "Test_List_Uploads",
      userId: testUserId,
    });

    const mockUploads: UploadMetadata[] = [
      {
        uploadId: faker.string.uuid(),
        experimentId: experiment.id,
        uploadTableName: "greenhouse_temps",
        sourceKind: "csv",
        status: "running",
        fileCount: null,
        rowCount: null,
        createdBy: testUserId,
        createdAt: "2026-01-02T00:00:00Z",
        completedAt: null,
        errorMessage: null,
      },
      {
        uploadId: faker.string.uuid(),
        experimentId: experiment.id,
        uploadTableName: "greenhouse_temps",
        sourceKind: "csv",
        status: "completed",
        fileCount: 2,
        rowCount: 1000,
        createdBy: testUserId,
        createdAt: "2026-01-01T00:00:00Z",
        completedAt: "2026-01-01T00:05:00Z",
        errorMessage: null,
      },
    ];

    vi.spyOn(uploadsRepository, "listUploads").mockResolvedValue(success(mockUploads));

    const result = await useCase.execute(experiment.id, testUserId, {
      uploadTableName: "greenhouse_temps",
    });

    expect(result.isSuccess()).toBe(true);
    assertSuccess(result);
    expect(result.value.uploads).toHaveLength(2);
    expect(result.value.uploads[0].status).toBe("running");
    expect(result.value.uploads[1].status).toBe("completed");

    // eslint-disable-next-line @typescript-eslint/unbound-method
    expect(uploadsRepository.listUploads).toHaveBeenCalledWith({
      experimentId: experiment.id,
      uploadTableName: "greenhouse_temps",
    });
  });

  it("should return empty uploads list when no uploads exist", async () => {
    const { experiment } = await testApp.createExperiment({
      name: "Test_Empty_Uploads",
      userId: testUserId,
    });

    vi.spyOn(uploadsRepository, "listUploads").mockResolvedValue(success([]));

    const result = await useCase.execute(experiment.id, testUserId, {});

    expect(result.isSuccess()).toBe(true);
    assertSuccess(result);
    expect(result.value.uploads).toHaveLength(0);
  });

  it("should return not found when experiment does not exist", async () => {
    const nonExistentId = faker.string.uuid();

    const result = await useCase.execute(nonExistentId, testUserId, {});

    expect(result.isFailure()).toBe(true);
    assertFailure(result);
    expect(result.error.code).toBe("NOT_FOUND");
    expect(result.error.message).toContain("Experiment not found");
  });

  it("should return forbidden when user does not have access to private experiment", async () => {
    const anotherUserId = await testApp.createTestUser({
      email: "another@example.com",
    });

    const { experiment } = await testApp.createExperiment({
      name: "Private_Experiment",
      visibility: "private",
      userId: testUserId,
    });

    const result = await useCase.execute(experiment.id, anotherUserId, {});

    expect(result.isFailure()).toBe(true);
    assertFailure(result);
    expect(result.error.code).toBe("FORBIDDEN");
    expect(result.error.message).toContain("Access denied");
  });

  it("should allow access to public experiments without membership", async () => {
    const anotherUserId = await testApp.createTestUser({
      email: "public-user@example.com",
    });

    const { experiment } = await testApp.createExperiment({
      name: "Public_Experiment",
      visibility: "public",
      userId: testUserId,
    });

    vi.spyOn(uploadsRepository, "listUploads").mockResolvedValue(success([]));

    const result = await useCase.execute(experiment.id, anotherUserId, {});

    expect(result.isSuccess()).toBe(true);
    assertSuccess(result);
  });

  it("should return internal error when listUploads fails", async () => {
    const { experiment } = await testApp.createExperiment({
      name: "Test_Experiment",
      userId: testUserId,
    });

    vi.spyOn(uploadsRepository, "listUploads").mockResolvedValue(
      failure(AppError.internal("Failed to query uploads")),
    );

    const result = await useCase.execute(experiment.id, testUserId, {});

    expect(result.isFailure()).toBe(true);
    assertFailure(result);
    expect(result.error.code).toBe("INTERNAL_ERROR");
    // Underlying repository error is preserved (not flattened to a generic message).
    expect(result.error.message).toContain("Failed to query uploads");
  });

  it("should handle checkAccess failure", async () => {
    const { experiment } = await testApp.createExperiment({
      name: "Test_Experiment",
      userId: testUserId,
    });

    const experimentRepository = testApp.module.get(ExperimentRepository);
    vi.spyOn(experimentRepository, "checkAccess").mockResolvedValue(
      failure(AppError.internal("Database connection failed")),
    );

    const result = await useCase.execute(experiment.id, testUserId, {});

    expect(result.isFailure()).toBe(true);
    assertFailure(result);
    expect(result.error.code).toBe("INTERNAL_ERROR");
    // Underlying repository error is preserved (not flattened to a generic message).
    expect(result.error.message).toBe("Database connection failed");
  });
});
