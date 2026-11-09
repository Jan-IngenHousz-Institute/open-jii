import { experimentMetadataSheets } from "@repo/database";

import {
  assertFailure,
  assertSuccess,
  success,
  failure,
  AppError,
} from "../../../../common/utils/fp-utils";
import { TestHarness } from "../../../../test/test-harness";
import type { MetadataSheetRecord } from "../../../core/models/experiment-metadata.model";
import { ExperimentMetadataWarehouseRepository } from "../../../core/repositories/experiment-metadata-warehouse.repository";
import { ExperimentMetadataRepository } from "../../../core/repositories/experiment-metadata.repository";
import { DeleteExperimentMetadataUseCase } from "./delete-experiment-metadata";

describe("DeleteExperimentMetadataUseCase", () => {
  const testApp = TestHarness.App;
  let testUserId: string;
  let useCase: DeleteExperimentMetadataUseCase;
  let metadataWarehouseRepository: ExperimentMetadataWarehouseRepository;

  beforeAll(async () => {
    await testApp.setup();
  });

  beforeEach(async () => {
    await testApp.beforeEach();
    testUserId = await testApp.createTestUser({});
    useCase = testApp.module.get(DeleteExperimentMetadataUseCase);
    metadataWarehouseRepository = testApp.module.get(ExperimentMetadataWarehouseRepository);
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

    const metadataId = "metadata-uuid-1";
    vi.spyOn(metadataWarehouseRepository, "deleteByMetadataId").mockResolvedValue(success(true));

    const result = await useCase.execute(experiment.id, metadataId, testUserId);

    expect(result.isSuccess()).toBe(true);
    // eslint-disable-next-line @typescript-eslint/unbound-method
    expect(metadataWarehouseRepository.deleteByMetadataId).toHaveBeenCalledWith(
      metadataId,
      experiment.id,
    );
  });

  it("should return NOT_FOUND if experiment does not exist", async () => {
    const nonExistentId = "00000000-0000-0000-0000-000000000000";
    const metadataId = "metadata-uuid-1";

    const result = await useCase.execute(nonExistentId, metadataId, testUserId);

    expect(result.isSuccess()).toBe(false);
    assertFailure(result);
    expect(result.error.code).toBe("NOT_FOUND");
  });

  it("should return failure if metadata repository delete fails", async () => {
    const { experiment } = await testApp.createExperiment({
      name: "Metadata Delete Failure Test",
      userId: testUserId,
    });

    const metadataId = "metadata-uuid-1";
    vi.spyOn(metadataWarehouseRepository, "deleteByMetadataId").mockResolvedValue(
      failure(AppError.internal("Databricks connection failed")),
    );

    const result = await useCase.execute(experiment.id, metadataId, testUserId);

    expect(result.isSuccess()).toBe(false);
    assertFailure(result);
    expect(result.error.code).toBe("INTERNAL_ERROR");
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
    it("goes when the lakehouse's sheet goes", async () => {
      const { experiment } = await testApp.createExperiment({
        name: "Drought trial",
        userId: testUserId,
      });
      const record = await inPostgres(experiment.id);
      vi.spyOn(metadataWarehouseRepository, "deleteByMetadataId").mockResolvedValue(success(true));

      assertSuccess(await useCase.execute(experiment.id, record.id, testUserId));

      expect(await postgres()).toEqual([]);
    });

    it("stays when the lakehouse refuses the delete", async () => {
      const { experiment } = await testApp.createExperiment({
        name: "Drought trial",
        userId: testUserId,
      });
      const record = await inPostgres(experiment.id);
      vi.spyOn(metadataWarehouseRepository, "deleteByMetadataId").mockResolvedValue(
        failure(AppError.internal("Warehouse down")),
      );

      assertFailure(await useCase.execute(experiment.id, record.id, testUserId));

      expect(await postgres()).toEqual([record]);
    });
  });

  it("still deletes the sheet when the copy in Postgres fails", async () => {
    const { experiment } = await testApp.createExperiment({
      name: "Drought trial",
      userId: testUserId,
    });
    const record = await inPostgres(experiment.id);
    vi.spyOn(metadataWarehouseRepository, "deleteByMetadataId").mockResolvedValue(success(true));
    vi.spyOn(testApp.module.get(ExperimentMetadataRepository), "delete").mockResolvedValue(
      failure(AppError.internal("Postgres did not answer the metadata sheets query")),
    );

    assertSuccess(await useCase.execute(experiment.id, record.id, testUserId));
  });
});
