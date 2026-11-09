import { experimentMetadataSheets } from "@repo/database";

import {
  assertSuccess,
  assertFailure,
  success,
  failure,
  AppError,
} from "../../../../common/utils/fp-utils";
import { TestHarness } from "../../../../test/test-harness";
import type {
  ExperimentMetadataDto,
  CreateExperimentMetadataDto,
  MetadataSheetRecord,
} from "../../../core/models/experiment-metadata.model";
import { ExperimentMetadataWarehouseRepository } from "../../../core/repositories/experiment-metadata-warehouse.repository";
import { ExperimentMetadataRepository } from "../../../core/repositories/experiment-metadata.repository";
import { CreateExperimentMetadataUseCase } from "./create-experiment-metadata";

describe("CreateExperimentMetadataUseCase", () => {
  const testApp = TestHarness.App;
  let testUserId: string;
  let useCase: CreateExperimentMetadataUseCase;
  let metadataWarehouseRepository: ExperimentMetadataWarehouseRepository;

  beforeAll(async () => {
    await testApp.setup();
  });

  beforeEach(async () => {
    await testApp.beforeEach();
    testUserId = await testApp.createTestUser({});
    useCase = testApp.module.get(CreateExperimentMetadataUseCase);
    metadataWarehouseRepository = testApp.module.get(ExperimentMetadataWarehouseRepository);
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

  it("should create experiment metadata successfully", async () => {
    const { experiment } = await testApp.createExperiment({
      name: "Metadata Create Test",
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

    vi.spyOn(metadataWarehouseRepository, "create").mockResolvedValue(success(mockResult));

    const result = await useCase.execute(experiment.id, sampleMetadata, testUserId);

    expect(result.isSuccess()).toBe(true);
    assertSuccess(result);
    expect(result.value).toEqual(mockResult);
    // eslint-disable-next-line @typescript-eslint/unbound-method
    expect(metadataWarehouseRepository.create).toHaveBeenCalledWith(
      experiment.id,
      expect.any(String),
      sampleMetadata,
      testUserId,
      expect.any(Date),
    );
  });

  it("should return NOT_FOUND if experiment does not exist", async () => {
    const nonExistentId = "00000000-0000-0000-0000-000000000000";

    const result = await useCase.execute(nonExistentId, sampleMetadata, testUserId);

    expect(result.isSuccess()).toBe(false);
    assertFailure(result);
    expect(result.error.code).toBe("NOT_FOUND");
  });

  it("should propagate repository failure on create", async () => {
    const { experiment } = await testApp.createExperiment({
      name: "Metadata Create Failure Test",
      userId: testUserId,
    });

    vi.spyOn(metadataWarehouseRepository, "create").mockResolvedValue(
      failure(AppError.internal("Databricks unavailable")),
    );

    const result = await useCase.execute(experiment.id, sampleMetadata, testUserId);

    expect(result.isSuccess()).toBe(false);
    assertFailure(result);
    expect(result.error.code).toBe("INTERNAL_ERROR");
  });

  it("should allow members with archive access to create metadata", async () => {
    const { experiment } = await testApp.createExperiment({
      name: "Member Create Test",
      userId: testUserId,
    });

    const memberId = await testApp.createTestUser({});
    await testApp.addExperimentAdmin(experiment.id, memberId);

    const mockResult: ExperimentMetadataDto = {
      metadataId: "metadata-uuid-member",
      experimentId: experiment.id,
      metadata: sampleMetadata.metadata,
      createdBy: memberId,
      createdAt: new Date("2025-01-01"),
      updatedAt: new Date("2025-01-01"),
    };

    vi.spyOn(metadataWarehouseRepository, "create").mockResolvedValue(success(mockResult));

    const result = await useCase.execute(experiment.id, sampleMetadata, memberId);

    expect(result.isSuccess()).toBe(true);
    assertSuccess(result);
    expect(result.value).toEqual(mockResult);
  });

  function postgres(): Promise<MetadataSheetRecord[]> {
    return testApp.database.select().from(experimentMetadataSheets);
  }

  describe("the copy in Postgres", () => {
    it("keeps the sheet with the id and time the lakehouse got", async () => {
      const { experiment } = await testApp.createExperiment({
        name: "Drought trial",
        userId: testUserId,
      });
      const create = vi
        .spyOn(metadataWarehouseRepository, "create")
        .mockImplementation((experimentId, metadataId, dto, userId, now) =>
          Promise.resolve(
            success({
              metadataId,
              experimentId,
              metadata: dto.metadata,
              createdBy: userId,
              createdAt: now,
              updatedAt: now,
            }),
          ),
        );

      assertSuccess(await useCase.execute(experiment.id, sampleMetadata, testUserId));

      const [, metadataId, , , now] = create.mock.calls[0];
      expect(await postgres()).toEqual([
        {
          id: metadataId,
          experimentId: experiment.id,
          metadata: sampleMetadata.metadata,
          createdBy: testUserId,
          createdAt: now,
          updatedAt: now,
        },
      ]);
    });

    it("stays empty when the lakehouse refuses the sheet", async () => {
      const { experiment } = await testApp.createExperiment({
        name: "Drought trial",
        userId: testUserId,
      });
      vi.spyOn(metadataWarehouseRepository, "create").mockResolvedValue(
        failure(AppError.internal("Warehouse down")),
      );

      assertFailure(await useCase.execute(experiment.id, sampleMetadata, testUserId));

      expect(await postgres()).toEqual([]);
    });
  });

  it("still creates the sheet when the copy in Postgres fails", async () => {
    const { experiment } = await testApp.createExperiment({
      name: "Drought trial",
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
    vi.spyOn(metadataWarehouseRepository, "create").mockResolvedValue(success(mockResult));
    vi.spyOn(testApp.module.get(ExperimentMetadataRepository), "insert").mockResolvedValue(
      failure(AppError.internal("Postgres did not answer the metadata sheets query")),
    );

    const result = await useCase.execute(experiment.id, sampleMetadata, testUserId);

    assertSuccess(result);
    expect(result.value).toEqual(mockResult);
  });
});
