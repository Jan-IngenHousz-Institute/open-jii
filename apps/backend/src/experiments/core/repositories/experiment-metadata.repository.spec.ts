/* eslint-disable @typescript-eslint/unbound-method */
import { faker } from "@faker-js/faker";

import type { SchemaData } from "../../../common/modules/databricks/services/sql/sql.types";
import { AppError, assertSuccess, failure, success } from "../../../common/utils/fp-utils";
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
  });

  afterEach(() => {
    testApp.afterEach();
  });

  afterAll(async () => {
    await testApp.teardown();
  });

  describe("findAllByExperimentId", () => {
    it("should return metadata array when found", async () => {
      const schemaData = buildMetadataSchemaData();
      vi.spyOn(databricksPort, "executeSqlQuery").mockResolvedValue(success(schemaData));

      const result = await repository.findAllByExperimentId(mockExperimentId);

      assertSuccess(result);
      const metadataList = result.value;
      expect(metadataList).toHaveLength(1);
      expect(metadataList[0].metadataId).toBe(mockMetadataId);
      expect(metadataList[0].experimentId).toBe(mockExperimentId);
      expect(metadataList[0].metadata).toEqual(mockMetadata);
      expect(metadataList[0].createdBy).toBe(mockUserId);
      expect(metadataList[0].createdAt).toBeInstanceOf(Date);
      expect(metadataList[0].updatedAt).toBeInstanceOf(Date);
    });

    it("should return empty array when no metadata exists", async () => {
      const schemaData: SchemaData = {
        ...buildMetadataSchemaData(),
        rows: [],
        totalRows: 0,
      };
      vi.spyOn(databricksPort, "executeSqlQuery").mockResolvedValue(success(schemaData));

      const result = await repository.findAllByExperimentId(mockExperimentId);

      assertSuccess(result);
      expect(result.value).toEqual([]);
    });

    it("should use escaped experiment ID in the SQL query", async () => {
      vi.spyOn(databricksPort, "executeSqlQuery").mockResolvedValue(
        success(buildMetadataSchemaData()),
      );

      await repository.findAllByExperimentId(mockExperimentId);

      expect(databricksPort.executeSqlQuery).toHaveBeenCalledWith(
        databricksPort.CENTRUM_SCHEMA_NAME,
        expect.stringContaining(mockExperimentId),
      );
    });

    it("should reject invalid experiment ID format", async () => {
      const result = await repository.findAllByExperimentId("not-a-uuid");

      expect(result.isFailure()).toBe(true);
    });

    it("should return failure when Databricks query fails", async () => {
      vi.spyOn(databricksPort, "executeSqlQuery").mockResolvedValue(
        failure(AppError.internal("Databricks connection failed")),
      );

      const result = await repository.findAllByExperimentId(mockExperimentId);

      expect(result.isFailure()).toBe(true);
    });
  });

  describe("create", () => {
    const createDto = { metadata: mockMetadata };

    it("should create metadata and return the new record", async () => {
      vi.spyOn(databricksPort, "executeSqlQuery").mockResolvedValue(success(emptySchemaData));

      const result = await repository.create(mockExperimentId, createDto, mockUserId);

      assertSuccess(result);
      expect(result.value.experimentId).toBe(mockExperimentId);
      expect(result.value.metadata).toEqual(mockMetadata);
      expect(result.value.createdBy).toBe(mockUserId);
      expect(result.value.metadataId).toBeDefined();
      expect(result.value.createdAt).toBeInstanceOf(Date);
    });

    it("should use PARSE_JSON in INSERT query", async () => {
      vi.spyOn(databricksPort, "executeSqlQuery").mockResolvedValue(success(emptySchemaData));

      await repository.create(mockExperimentId, createDto, mockUserId);

      const insertCall = vi.mocked(databricksPort.executeSqlQuery).mock.calls[0];
      expect(insertCall[1]).toContain("PARSE_JSON");
      expect(insertCall[1]).toContain("INSERT INTO");
    });

    it("should reject invalid experiment ID", async () => {
      const result = await repository.create("bad-id", createDto, mockUserId);

      expect(result.isFailure()).toBe(true);
    });

    it("should return failure when INSERT fails", async () => {
      vi.spyOn(databricksPort, "executeSqlQuery").mockResolvedValue(
        failure(AppError.internal("Insert failed")),
      );

      const result = await repository.create(mockExperimentId, createDto, mockUserId);

      expect(result.isFailure()).toBe(true);
    });
  });

  describe("deleteByMetadataId", () => {
    it("should delete metadata by metadata_id scoped to experiment", async () => {
      vi.spyOn(databricksPort, "executeSqlQuery").mockResolvedValue(success(emptySchemaData));

      const result = await repository.deleteByMetadataId(mockMetadataId, mockExperimentId);

      assertSuccess(result);
      expect(result.value).toBe(true);

      const call = vi.mocked(databricksPort.executeSqlQuery).mock.calls[0];
      expect(call[1]).toContain("DELETE FROM");
      expect(call[1]).toContain(mockMetadataId);
      expect(call[1]).toContain(mockExperimentId);
    });

    it("should reject invalid metadata ID", async () => {
      const result = await repository.deleteByMetadataId("not-valid", mockExperimentId);

      expect(result.isFailure()).toBe(true);
    });

    it("should reject invalid experiment ID", async () => {
      const result = await repository.deleteByMetadataId(mockMetadataId, "not-valid");

      expect(result.isFailure()).toBe(true);
    });

    it("should return failure when DELETE query fails", async () => {
      vi.spyOn(databricksPort, "executeSqlQuery").mockResolvedValue(
        failure(AppError.internal("Delete failed")),
      );

      const result = await repository.deleteByMetadataId(mockMetadataId, mockExperimentId);

      expect(result.isFailure()).toBe(true);
    });
  });

  describe("update", () => {
    const updateDto = { metadata: { location: "Lab C", count: 99 } };

    it("should update metadata scoped to experiment and return the updated record", async () => {
      vi.spyOn(databricksPort, "executeSqlQuery").mockResolvedValueOnce(success(emptySchemaData));

      const result = await repository.update(
        mockMetadataId,
        updateDto,
        mockUserId,
        mockExperimentId,
      );

      assertSuccess(result);
      expect(result.value.metadataId).toBe(mockMetadataId);
      expect(result.value.experimentId).toBe(mockExperimentId);
      expect(result.value.metadata).toEqual(updateDto.metadata);

      const updateCall = vi.mocked(databricksPort.executeSqlQuery).mock.calls[0];
      expect(updateCall[1]).toContain(mockMetadataId);
      expect(updateCall[1]).toContain(mockExperimentId);
    });

    it("should use PARSE_JSON in UPDATE query", async () => {
      vi.spyOn(databricksPort, "executeSqlQuery").mockResolvedValueOnce(success(emptySchemaData));

      await repository.update(mockMetadataId, updateDto, mockUserId, mockExperimentId);

      const updateCall = vi.mocked(databricksPort.executeSqlQuery).mock.calls[0];
      expect(updateCall[1]).toContain("PARSE_JSON");
      expect(updateCall[1]).toContain("UPDATE");
    });

    it("should reject invalid metadata ID", async () => {
      const result = await repository.update("bad-id", updateDto, mockUserId, mockExperimentId);

      expect(result.isFailure()).toBe(true);
    });

    it("should reject invalid experiment ID", async () => {
      const result = await repository.update(mockMetadataId, updateDto, mockUserId, "bad-id");

      expect(result.isFailure()).toBe(true);
    });

    it("should return failure when UPDATE fails", async () => {
      vi.spyOn(databricksPort, "executeSqlQuery").mockResolvedValue(
        failure(AppError.internal("Update failed")),
      );

      const result = await repository.update(
        mockMetadataId,
        updateDto,
        mockUserId,
        mockExperimentId,
      );

      expect(result.isFailure()).toBe(true);
    });

    it("should reject metadata payload exceeding 5 MB size limit", async () => {
      const hugePayload = { data: "x".repeat(5_000_001) };
      const result = await repository.update(
        mockMetadataId,
        { metadata: hugePayload },
        mockUserId,
        mockExperimentId,
      );

      expect(result.isFailure()).toBe(true);
      if (result.isFailure()) {
        expect(result.error.message).toContain("5 MB");
      }
    });
  });

  describe("deleteAllByExperimentId", () => {
    it("should delete all metadata for a given experiment", async () => {
      vi.spyOn(databricksPort, "executeSqlQuery").mockResolvedValue(success(emptySchemaData));

      const result = await repository.deleteAllByExperimentId(mockExperimentId);

      assertSuccess(result);
      expect(result.value).toBe(true);

      const call = vi.mocked(databricksPort.executeSqlQuery).mock.calls[0];
      expect(call[1]).toContain("DELETE FROM");
      expect(call[1]).toContain(mockExperimentId);
    });

    it("should reject invalid experiment ID", async () => {
      const result = await repository.deleteAllByExperimentId("not-a-uuid");

      expect(result.isFailure()).toBe(true);
    });

    it("should return failure when DELETE query fails", async () => {
      vi.spyOn(databricksPort, "executeSqlQuery").mockResolvedValue(
        failure(AppError.internal("Delete all failed")),
      );

      const result = await repository.deleteAllByExperimentId(mockExperimentId);

      expect(result.isFailure()).toBe(true);
    });
  });

  describe("create – edge cases", () => {
    it("should reject metadata payload exceeding 5 MB on create", async () => {
      const hugeDto = { metadata: { data: "x".repeat(5_000_001) } };

      const result = await repository.create(mockExperimentId, hugeDto, mockUserId);

      expect(result.isFailure()).toBe(true);
      if (result.isFailure()) {
        expect(result.error.message).toContain("5 MB");
      }
    });

    it("should reject invalid user ID on create", async () => {
      const result = await repository.create(mockExperimentId, { metadata: {} }, "bad-user-id");

      expect(result.isFailure()).toBe(true);
    });
  });

  describe("mapRowToDto – edge cases", () => {
    it("should handle null metadata JSON gracefully", async () => {
      const schemaData: SchemaData = {
        columns: [
          { name: "metadata_id", type_name: "STRING", type_text: "STRING", position: 0 },
          { name: "experiment_id", type_name: "STRING", type_text: "STRING", position: 1 },
          { name: "metadata", type_name: "STRING", type_text: "STRING", position: 2 },
          { name: "created_by", type_name: "STRING", type_text: "STRING", position: 3 },
          { name: "created_at", type_name: "STRING", type_text: "STRING", position: 4 },
          { name: "updated_at", type_name: "STRING", type_text: "STRING", position: 5 },
        ],
        rows: [[mockMetadataId, mockExperimentId, null, mockUserId, null, null]],
        totalRows: 1,
        truncated: false,
      };

      vi.spyOn(databricksPort, "executeSqlQuery").mockResolvedValue(success(schemaData));

      const result = await repository.findAllByExperimentId(mockExperimentId);

      assertSuccess(result);
      expect(result.value[0].metadata).toEqual({});
      expect(result.value[0].createdAt).toEqual(new Date(0));
      expect(result.value[0].updatedAt).toEqual(new Date(0));
    });

    it("should handle invalid metadata JSON gracefully", async () => {
      const schemaData: SchemaData = {
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
            mockMetadataId,
            mockExperimentId,
            "NOT VALID JSON {{{",
            mockUserId,
            "2026-01-15T10:00:00.000Z",
            "2026-01-15T10:00:00.000Z",
          ],
        ],
        totalRows: 1,
        truncated: false,
      };

      vi.spyOn(databricksPort, "executeSqlQuery").mockResolvedValue(success(schemaData));

      const result = await repository.findAllByExperimentId(mockExperimentId);

      assertSuccess(result);
      // Invalid JSON should fallback to empty object
      expect(result.value[0].metadata).toEqual({});
    });

    it("should handle missing column values gracefully", async () => {
      const schemaData: SchemaData = {
        columns: [
          { name: "metadata_id", type_name: "STRING", type_text: "STRING", position: 0 },
          { name: "experiment_id", type_name: "STRING", type_text: "STRING", position: 1 },
          { name: "metadata", type_name: "STRING", type_text: "STRING", position: 2 },
          { name: "created_by", type_name: "STRING", type_text: "STRING", position: 3 },
          { name: "created_at", type_name: "STRING", type_text: "STRING", position: 4 },
          { name: "updated_at", type_name: "STRING", type_text: "STRING", position: 5 },
        ],
        rows: [[null, null, null, null, null, null]],
        totalRows: 1,
        truncated: false,
      };

      vi.spyOn(databricksPort, "executeSqlQuery").mockResolvedValue(success(schemaData));

      const result = await repository.findAllByExperimentId(mockExperimentId);

      assertSuccess(result);
      expect(result.value[0].metadataId).toBe("");
      expect(result.value[0].experimentId).toBe("");
      expect(result.value[0].createdBy).toBe("");
    });
  });
});
