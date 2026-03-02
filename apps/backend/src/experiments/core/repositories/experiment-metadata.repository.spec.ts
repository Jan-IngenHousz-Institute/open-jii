/* eslint-disable @typescript-eslint/unbound-method */
import { faker } from "@faker-js/faker";

import type { SchemaData } from "../../../common/modules/databricks/services/sql/sql.types";
import {
  AppError,
  assertFailure,
  assertSuccess,
  failure,
  success,
} from "../../../common/utils/fp-utils";
import { TestHarness } from "../../../test/test-harness";
import type { DatabricksPort } from "../ports/databricks.port";
import { DATABRICKS_PORT } from "../ports/databricks.port";
import { ExperimentMetadataRepository } from "./experiment-metadata.repository";

describe("ExperimentMetadataRepository", () => {
  const testApp = TestHarness.App;
  let repository: ExperimentMetadataRepository;
  let databricksPort: DatabricksPort;

  const mockExperimentId = faker.string.uuid();
  const mockUserId = faker.string.uuid();
  const mockMetadataId = faker.string.uuid();

  const mockMetadata = {
    columns: [
      { id: "col-1", name: "Species", type: "string" },
      { id: "col-2", name: "Count", type: "number" },
    ],
    rows: [
      { _id: "row-1", "col-1": "Oak", "col-2": 42 },
      { _id: "row-2", "col-1": "Pine", "col-2": 17 },
    ],
  };

  /** Helper to build a SchemaData response matching the metadata table shape */
  function buildMetadataSchemaData(
    overrides?: Partial<{
      metadataId: string;
      experimentId: string;
      metadata: Record<string, unknown>;
      createdBy: string;
      createdAt: string;
      updatedAt: string;
    }>,
  ): SchemaData {
    return {
      columns: [
        { name: "metadata_id", type_name: "STRING", type_text: "STRING", position: 0 },
        { name: "experiment_id", type_name: "STRING", type_text: "STRING", position: 1 },
        { name: "metadata", type_name: "STRING", type_text: "STRING", position: 2 },
        { name: "created_by", type_name: "STRING", type_text: "STRING", position: 3 },
        { name: "created_at", type_name: "STRING", type_text: "STRING", position: 4 },
        { name: "updated_at", type_name: "STRING", type_text: "STRING", position: 5 },
      ],
      rows: [
        [
          overrides?.metadataId ?? mockMetadataId,
          overrides?.experimentId ?? mockExperimentId,
          JSON.stringify(overrides?.metadata ?? mockMetadata),
          overrides?.createdBy ?? mockUserId,
          overrides?.createdAt ?? "2026-01-15T10:00:00.000Z",
          overrides?.updatedAt ?? "2026-01-15T10:00:00.000Z",
        ],
      ],
      totalRows: 1,
      truncated: false,
    };
  }

  const emptySchemaData: SchemaData = {
    columns: [],
    rows: [],
    totalRows: 0,
    truncated: false,
  };

  beforeAll(async () => {
    await testApp.setup();
  });

  beforeEach(async () => {
    await testApp.beforeEach();
    repository = testApp.module.get(ExperimentMetadataRepository);
    databricksPort = testApp.module.get(DATABRICKS_PORT);
    vi.restoreAllMocks();
  });

  afterEach(() => {
    testApp.afterEach();
  });

  afterAll(async () => {
    await testApp.teardown();
  });

  describe("findByExperimentId", () => {
    it("should return metadata when found", async () => {
      const schemaData = buildMetadataSchemaData();
      vi.spyOn(databricksPort, "executeSqlQuery").mockResolvedValue(success(schemaData));

      const result = await repository.findByExperimentId(mockExperimentId);

      assertSuccess(result);
      expect(result.value).not.toBeNull();
      expect(result.value!.metadataId).toBe(mockMetadataId);
      expect(result.value!.experimentId).toBe(mockExperimentId);
      expect(result.value!.metadata).toEqual(mockMetadata);
      expect(result.value!.createdBy).toBe(mockUserId);
      expect(result.value!.createdAt).toBeInstanceOf(Date);
      expect(result.value!.updatedAt).toBeInstanceOf(Date);
    });

    it("should return null when no metadata exists", async () => {
      const schemaData: SchemaData = {
        ...buildMetadataSchemaData(),
        rows: [],
        totalRows: 0,
      };
      vi.spyOn(databricksPort, "executeSqlQuery").mockResolvedValue(success(schemaData));

      const result = await repository.findByExperimentId(mockExperimentId);

      assertSuccess(result);
      expect(result.value).toBeNull();
    });

    it("should use escaped experiment ID in the SQL query", async () => {
      vi.spyOn(databricksPort, "executeSqlQuery").mockResolvedValue(
        success(buildMetadataSchemaData()),
      );

      await repository.findByExperimentId(mockExperimentId);

      expect(databricksPort.executeSqlQuery).toHaveBeenCalledWith(
        databricksPort.CENTRUM_SCHEMA_NAME,
        expect.stringContaining(mockExperimentId),
      );
    });

    it("should reject invalid experiment ID format", async () => {
      const result = await repository.findByExperimentId("not-a-uuid");

      expect(result.isFailure()).toBe(true);
    });

    it("should return failure when Databricks query fails", async () => {
      vi.spyOn(databricksPort, "executeSqlQuery").mockResolvedValue(
        failure(AppError.internal("Databricks connection failed")),
      );

      const result = await repository.findByExperimentId(mockExperimentId);

      expect(result.isFailure()).toBe(true);
    });
  });

  describe("upsert", () => {
    const upsertDto = { metadata: mockMetadata };

    it("should create metadata when none exists", async () => {
      // First call: SELECT returns empty, second call: INSERT succeeds
      vi.spyOn(databricksPort, "executeSqlQuery")
        .mockResolvedValueOnce(
          success({ ...emptySchemaData, columns: buildMetadataSchemaData().columns }),
        )
        .mockResolvedValueOnce(success(emptySchemaData));

      const result = await repository.upsert(mockExperimentId, upsertDto, mockUserId);

      assertSuccess(result);
      expect(result.value.experimentId).toBe(mockExperimentId);
      expect(result.value.metadata).toEqual(mockMetadata);
      expect(result.value.createdBy).toBe(mockUserId);
      expect(result.value.metadataId).toBeDefined();
      expect(result.value.createdAt).toBeInstanceOf(Date);
    });

    it("should update metadata when it already exists", async () => {
      const existingData = buildMetadataSchemaData();
      const newMetadata = { columns: [], rows: [{ _id: "r1", foo: "bar" }] };

      // First call: SELECT returns existing, second call: UPDATE succeeds
      vi.spyOn(databricksPort, "executeSqlQuery")
        .mockResolvedValueOnce(success(existingData))
        .mockResolvedValueOnce(success(emptySchemaData));

      const result = await repository.upsert(
        mockExperimentId,
        { metadata: newMetadata },
        mockUserId,
      );

      assertSuccess(result);
      expect(result.value.metadataId).toBe(mockMetadataId);
      expect(result.value.metadata).toEqual(newMetadata);
    });

    it("should use PARSE_JSON in INSERT query", async () => {
      vi.spyOn(databricksPort, "executeSqlQuery")
        .mockResolvedValueOnce(
          success({ ...emptySchemaData, columns: buildMetadataSchemaData().columns }),
        )
        .mockResolvedValueOnce(success(emptySchemaData));

      await repository.upsert(mockExperimentId, upsertDto, mockUserId);

      // Second call is the INSERT
      const insertCall = vi.mocked(databricksPort.executeSqlQuery).mock.calls[1];
      expect(insertCall[1]).toContain("PARSE_JSON");
      expect(insertCall[1]).toContain("INSERT INTO");
    });

    it("should use PARSE_JSON in UPDATE query", async () => {
      vi.spyOn(databricksPort, "executeSqlQuery")
        .mockResolvedValueOnce(success(buildMetadataSchemaData()))
        .mockResolvedValueOnce(success(emptySchemaData));

      await repository.upsert(mockExperimentId, upsertDto, mockUserId);

      // Second call is the UPDATE
      const updateCall = vi.mocked(databricksPort.executeSqlQuery).mock.calls[1];
      expect(updateCall[1]).toContain("PARSE_JSON");
      expect(updateCall[1]).toContain("UPDATE");
    });

    it("should reject invalid experiment ID", async () => {
      const result = await repository.upsert("bad-id", upsertDto, mockUserId);

      expect(result.isFailure()).toBe(true);
    });

    it("should return failure when INSERT fails", async () => {
      vi.spyOn(databricksPort, "executeSqlQuery")
        .mockResolvedValueOnce(
          success({ ...emptySchemaData, columns: buildMetadataSchemaData().columns }),
        )
        .mockResolvedValueOnce(failure(AppError.internal("Insert failed")));

      const result = await repository.upsert(mockExperimentId, upsertDto, mockUserId);

      expect(result.isFailure()).toBe(true);
    });

    it("should return failure when UPDATE fails", async () => {
      vi.spyOn(databricksPort, "executeSqlQuery")
        .mockResolvedValueOnce(success(buildMetadataSchemaData()))
        .mockResolvedValueOnce(failure(AppError.internal("Update failed")));

      const result = await repository.upsert(mockExperimentId, upsertDto, mockUserId);

      expect(result.isFailure()).toBe(true);
    });
  });

  describe("deleteByExperimentId", () => {
    it("should delete metadata by experiment_id", async () => {
      vi.spyOn(databricksPort, "executeSqlQuery").mockResolvedValue(success(emptySchemaData));

      const result = await repository.deleteByExperimentId(mockExperimentId);

      assertSuccess(result);
      expect(result.value).toBe(true);

      expect(databricksPort.executeSqlQuery).toHaveBeenCalledWith(
        databricksPort.CENTRUM_SCHEMA_NAME,
        expect.stringContaining("DELETE FROM"),
      );
    });

    it("should reject invalid experiment ID", async () => {
      const result = await repository.deleteByExperimentId("not-valid");

      expect(result.isFailure()).toBe(true);
    });

    it("should return failure when DELETE query fails", async () => {
      vi.spyOn(databricksPort, "executeSqlQuery").mockResolvedValue(
        failure(AppError.internal("Delete failed")),
      );

      const result = await repository.deleteByExperimentId(mockExperimentId);

      expect(result.isFailure()).toBe(true);
    });
  });
});
