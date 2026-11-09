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
  MetadataSheetRecord,
  UpdateExperimentMetadataDto,
} from "../../../core/models/experiment-metadata.model";
import { ExperimentMetadataWarehouseRepository } from "../../../core/repositories/experiment-metadata-warehouse.repository";
import { ExperimentMetadataRepository } from "../../../core/repositories/experiment-metadata.repository";
import { UpdateExperimentMetadataUseCase } from "./update-experiment-metadata";

describe("UpdateExperimentMetadataUseCase", () => {
  const testApp = TestHarness.App;
  let testUserId: string;
  let useCase: UpdateExperimentMetadataUseCase;
  let metadataWarehouseRepository: ExperimentMetadataWarehouseRepository;

  beforeAll(async () => {
    await testApp.setup();
  });

  beforeEach(async () => {
    await testApp.beforeEach();
    testUserId = await testApp.createTestUser({});
    useCase = testApp.module.get(UpdateExperimentMetadataUseCase);
    metadataWarehouseRepository = testApp.module.get(ExperimentMetadataWarehouseRepository);
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

    vi.spyOn(metadataWarehouseRepository, "update").mockResolvedValue(success(mockResult));

    const result = await useCase.execute(experiment.id, metadataId, sampleUpdate, testUserId);

    expect(result.isSuccess()).toBe(true);
    assertSuccess(result);
    expect(result.value).toEqual(mockResult);
    // eslint-disable-next-line @typescript-eslint/unbound-method
    expect(metadataWarehouseRepository.update).toHaveBeenCalledWith(
      metadataId,
      sampleUpdate,
      testUserId,
      experiment.id,
      expect.any(Date),
    );
  });

  it("should return NOT_FOUND if experiment does not exist", async () => {
    const nonExistentId = "00000000-0000-0000-0000-000000000000";

    const result = await useCase.execute(nonExistentId, metadataId, sampleUpdate, testUserId);

    expect(result.isSuccess()).toBe(false);
    assertFailure(result);
    expect(result.error.code).toBe("NOT_FOUND");
  });

  it("should propagate repository failure on update", async () => {
    const { experiment } = await testApp.createExperiment({
      name: "Metadata Update Failure Test",
      userId: testUserId,
    });

    vi.spyOn(metadataWarehouseRepository, "update").mockResolvedValue(
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
    await testApp.addExperimentAdmin(experiment.id, memberId);

    const mockResult: ExperimentMetadataDto = {
      metadataId,
      experimentId: experiment.id,
      metadata: sampleUpdate.metadata,
      createdBy: memberId,
      createdAt: new Date("2025-01-01"),
      updatedAt: new Date("2025-01-02"),
    };

    vi.spyOn(metadataWarehouseRepository, "update").mockResolvedValue(success(mockResult));

    const result = await useCase.execute(experiment.id, metadataId, sampleUpdate, memberId);

    expect(result.isSuccess()).toBe(true);
    assertSuccess(result);
    expect(result.value).toEqual(mockResult);
  });

  /** A sheet already in Postgres, as an earlier write left it. */
  async function inPostgres(experimentId: string): Promise<MetadataSheetRecord> {
    const created = new Date("2026-09-01T08:00:00.000Z");
    const record: MetadataSheetRecord = {
      id: "0d2c4b6a-8e1f-4a3b-9c5d-7e9f1a3b5c7d",
      experimentId,
      metadata: { name: "Plots", columns: [], rows: [] },
      createdBy: testUserId,
      createdAt: created,
      updatedAt: created,
    };
    assertSuccess(await testApp.module.get(ExperimentMetadataRepository).insert(record));
    return record;
  }

  function postgres(): Promise<MetadataSheetRecord[]> {
    return testApp.database.select().from(experimentMetadataSheets);
  }

  describe("the copy in Postgres", () => {
    it("takes the new sheet with the time the lakehouse got", async () => {
      const { experiment } = await testApp.createExperiment({
        name: "Drought trial",
        userId: testUserId,
      });
      const record = await inPostgres(experiment.id);
      const update = vi
        .spyOn(metadataWarehouseRepository, "update")
        .mockResolvedValue(success({ ...record, metadataId: record.id }));

      assertSuccess(await useCase.execute(experiment.id, record.id, sampleUpdate, testUserId));

      const [, , , , now] = update.mock.calls[0];
      expect(await postgres()).toEqual([
        { ...record, metadata: sampleUpdate.metadata, updatedAt: now },
      ]);
    });

    it("keeps the old sheet when the lakehouse refuses the update", async () => {
      const { experiment } = await testApp.createExperiment({
        name: "Drought trial",
        userId: testUserId,
      });
      const record = await inPostgres(experiment.id);
      vi.spyOn(metadataWarehouseRepository, "update").mockResolvedValue(
        failure(AppError.internal("Warehouse down")),
      );

      assertFailure(await useCase.execute(experiment.id, record.id, sampleUpdate, testUserId));

      expect(await postgres()).toEqual([record]);
    });
  });

  it("still updates the sheet when the copy in Postgres fails", async () => {
    const { experiment } = await testApp.createExperiment({
      name: "Drought trial",
      userId: testUserId,
    });
    const record = await inPostgres(experiment.id);
    vi.spyOn(metadataWarehouseRepository, "update").mockResolvedValue(
      success({ ...record, metadataId: record.id }),
    );
    vi.spyOn(testApp.module.get(ExperimentMetadataRepository), "update").mockResolvedValue(
      failure(AppError.internal("Postgres did not answer the metadata sheets query")),
    );

    assertSuccess(await useCase.execute(experiment.id, record.id, sampleUpdate, testUserId));
  });
});
