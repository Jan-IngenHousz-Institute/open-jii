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

  const mockColumns = [
    { id: "col-1", name: "Species", type: "string" as const },
    { id: "col-2", name: "Count", type: "number" as const },
  ];

  const mockRows = [
    { _id: "row-1", "col-1": "Oak", "col-2": 42 },
    { _id: "row-2", "col-1": "Pine", "col-2": 17 },
  ];

  /** Helper to build a SchemaData response matching the metadata table shape */
  function buildMetadataSchemaData(overrides?: Partial<{
    id: string;
    experimentId: string;
    columns: unknown[];
    rows: unknown[];
    identifierColumnId: string | null;
    experimentQuestionId: string | null;
    createdBy: string;
    createdAt: string;
    updatedAt: string;
  }>): SchemaData {
    return {
      columns: [
        { name: "id", type_name: "STRING", type_text: "STRING", position: 0 },
        { name: "experiment_id", type_name: "STRING", type_text: "STRING", position: 1 },
        { name: "columns", type_name: "STRING", type_text: "STRING", position: 2 },
        { name: "rows", type_name: "STRING", type_text: "STRING", position: 3 },
        { name: "identifier_column_id", type_name: "STRING", type_text: "STRING", position: 4 },
        { name: "experiment_question_id", type_name: "STRING", type_text: "STRING", position: 5 },
        { name: "created_by", type_name: "STRING", type_text: "STRING", position: 6 },
        { name: "created_at", type_name: "STRING", type_text: "STRING", position: 7 },
        { name: "updated_at", type_name: "STRING", type_text: "STRING", position: 8 },
      ],
      rows: [
        [
          overrides?.id ?? mockMetadataId,
          overrides?.experimentId ?? mockExperimentId,
          JSON.stringify(overrides?.columns ?? mockColumns),
          JSON.stringify(overrides?.rows ?? mockRows),
          overrides?.identifierColumnId ?? "col-1",
          overrides?.experimentQuestionId ?? null,
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

      expect(result.isSuccess()).toBe(true);
      assertSuccess(result);
      expect(result.value).not.toBeNull();
      expect(result.value!.id).toBe(mockMetadataId);
      expect(result.value!.experimentId).toBe(mockExperimentId);
      expect(result.value!.columns).toEqual(mockColumns);
      expect(result.value!.rows).toEqual(mockRows);
      expect(result.value!.identifierColumnId).toBe("col-1");
      expect(result.value!.experimentQuestionId).toBeNull();
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

      expect(result.isSuccess()).toBe(true);
      assertSuccess(result);
      expect(result.value).toBeNull();
    });

    it("should use parameterized query with experiment_id parameter", async () => {
      vi.spyOn(databricksPort, "executeSqlQuery").mockResolvedValue(
        success(buildMetadataSchemaData()),
      );

      await repository.findByExperimentId(mockExperimentId);

      expect(databricksPort.executeSqlQuery).toHaveBeenCalledWith(
        databricksPort.CENTRUM_SCHEMA_NAME,
        expect.stringContaining(":experiment_id"),
        [{ name: "experiment_id", value: mockExperimentId }],
      );
    });

    it("should not contain string-interpolated values in the SQL query", async () => {
      const maliciousId = "'; DROP TABLE experiment_metadata; --";
      vi.spyOn(databricksPort, "executeSqlQuery").mockResolvedValue(
        success(buildMetadataSchemaData()),
      );

      await repository.findByExperimentId(maliciousId);

      const sqlCall = vi.mocked(databricksPort.executeSqlQuery).mock.calls[0];
      const sqlQuery = sqlCall[1];

      // The malicious string should NOT appear in the SQL query itself
      expect(sqlQuery).not.toContain(maliciousId);
      // It should only appear in the parameters
      expect(sqlCall[2]).toEqual([{ name: "experiment_id", value: maliciousId }]);
    });

    it("should return failure when Databricks query fails", async () => {
      vi.spyOn(databricksPort, "executeSqlQuery").mockResolvedValue(
        failure(AppError.internal("Databricks connection failed")),
      );

      const result = await repository.findByExperimentId(mockExperimentId);

      expect(result.isFailure()).toBe(true);
    });
  });

  describe("create", () => {
    const createDto = {
      columns: mockColumns,
      rows: mockRows,
      identifierColumnId: "col-1",
      experimentQuestionId: null,
    };

    it("should create metadata and return the created record", async () => {
      vi.spyOn(databricksPort, "executeSqlQuery").mockResolvedValue(success(emptySchemaData));

      const result = await repository.create(mockExperimentId, createDto, mockUserId);

      expect(result.isSuccess()).toBe(true);
      assertSuccess(result);
      expect(result.value.experimentId).toBe(mockExperimentId);
      expect(result.value.columns).toEqual(mockColumns);
      expect(result.value.rows).toEqual(mockRows);
      expect(result.value.identifierColumnId).toBe("col-1");
      expect(result.value.experimentQuestionId).toBeNull();
      expect(result.value.createdBy).toBe(mockUserId);
      expect(result.value.id).toBeDefined();
      expect(result.value.createdAt).toBeInstanceOf(Date);
      expect(result.value.updatedAt).toBeInstanceOf(Date);
    });

    it("should use parameterized INSERT query", async () => {
      vi.spyOn(databricksPort, "executeSqlQuery").mockResolvedValue(success(emptySchemaData));

      await repository.create(mockExperimentId, createDto, mockUserId);

      expect(databricksPort.executeSqlQuery).toHaveBeenCalledWith(
        databricksPort.CENTRUM_SCHEMA_NAME,
        expect.stringContaining("INSERT INTO"),
        expect.arrayContaining([
          expect.objectContaining({ name: "experiment_id", value: mockExperimentId }),
          expect.objectContaining({ name: "columns", value: JSON.stringify(mockColumns) }),
          expect.objectContaining({ name: "rows", value: JSON.stringify(mockRows) }),
          expect.objectContaining({ name: "identifier_column_id", value: "col-1" }),
          expect.objectContaining({ name: "created_by", value: mockUserId }),
        ]),
      );
    });

    it("should pass null for optional fields when not provided", async () => {
      const dtoWithoutOptionals = {
        columns: mockColumns,
        rows: mockRows,
      };

      vi.spyOn(databricksPort, "executeSqlQuery").mockResolvedValue(success(emptySchemaData));

      await repository.create(mockExperimentId, dtoWithoutOptionals, mockUserId);

      expect(databricksPort.executeSqlQuery).toHaveBeenCalledWith(
        databricksPort.CENTRUM_SCHEMA_NAME,
        expect.any(String),
        expect.arrayContaining([
          expect.objectContaining({ name: "identifier_column_id", value: null }),
          expect.objectContaining({ name: "experiment_question_id", value: null }),
        ]),
      );
    });

    it("should return failure when Databricks INSERT fails", async () => {
      vi.spyOn(databricksPort, "executeSqlQuery").mockResolvedValue(
        failure(AppError.internal("Insert failed")),
      );

      const result = await repository.create(mockExperimentId, createDto, mockUserId);

      expect(result.isFailure()).toBe(true);
    });
  });

  describe("update", () => {
    it("should fetch existing record, merge changes, and update", async () => {
      const existingData = buildMetadataSchemaData();
      const updatedColumns = [{ id: "col-3", name: "Height", type: "number" as const }];

      // First call: SELECT existing, second call: UPDATE
      vi.spyOn(databricksPort, "executeSqlQuery")
        .mockResolvedValueOnce(success(existingData))
        .mockResolvedValueOnce(success(emptySchemaData));

      const result = await repository.update(mockMetadataId, { columns: updatedColumns });

      expect(result.isSuccess()).toBe(true);
      assertSuccess(result);
      expect(result.value).not.toBeNull();
      expect(result.value!.columns).toEqual(updatedColumns);
      // Rows should remain unchanged from existing
      expect(result.value!.rows).toEqual(mockRows);
      expect(result.value!.updatedAt).toBeInstanceOf(Date);
    });

    it("should return null when metadata record does not exist", async () => {
      const emptyResult: SchemaData = {
        ...buildMetadataSchemaData(),
        rows: [],
        totalRows: 0,
      };
      vi.spyOn(databricksPort, "executeSqlQuery").mockResolvedValue(success(emptyResult));

      const result = await repository.update(mockMetadataId, { columns: mockColumns });

      expect(result.isSuccess()).toBe(true);
      assertSuccess(result);
      expect(result.value).toBeNull();
    });

    it("should use parameterized queries for both SELECT and UPDATE", async () => {
      vi.spyOn(databricksPort, "executeSqlQuery")
        .mockResolvedValueOnce(success(buildMetadataSchemaData()))
        .mockResolvedValueOnce(success(emptySchemaData));

      await repository.update(mockMetadataId, { columns: mockColumns });

      // SELECT call
      expect(databricksPort.executeSqlQuery).toHaveBeenNthCalledWith(
        1,
        databricksPort.CENTRUM_SCHEMA_NAME,
        expect.stringContaining("WHERE id = :id"),
        [{ name: "id", value: mockMetadataId }],
      );

      // UPDATE call
      expect(databricksPort.executeSqlQuery).toHaveBeenNthCalledWith(
        2,
        databricksPort.CENTRUM_SCHEMA_NAME,
        expect.stringContaining("UPDATE"),
        expect.arrayContaining([
          expect.objectContaining({ name: "id", value: mockMetadataId }),
          expect.objectContaining({ name: "columns" }),
          expect.objectContaining({ name: "updated_at" }),
        ]),
      );
    });

    it("should preserve existing identifierColumnId when not provided in update", async () => {
      const existingData = buildMetadataSchemaData({ identifierColumnId: "col-1" });

      vi.spyOn(databricksPort, "executeSqlQuery")
        .mockResolvedValueOnce(success(existingData))
        .mockResolvedValueOnce(success(emptySchemaData));

      const result = await repository.update(mockMetadataId, { rows: mockRows });

      assertSuccess(result);
      expect(result.value!.identifierColumnId).toBe("col-1");
    });

    it("should return failure when SELECT query fails", async () => {
      vi.spyOn(databricksPort, "executeSqlQuery").mockResolvedValue(
        failure(AppError.internal("Query failed")),
      );

      const result = await repository.update(mockMetadataId, { columns: mockColumns });

      expect(result.isFailure()).toBe(true);
    });

    it("should return failure when UPDATE query fails", async () => {
      vi.spyOn(databricksPort, "executeSqlQuery")
        .mockResolvedValueOnce(success(buildMetadataSchemaData()))
        .mockResolvedValueOnce(failure(AppError.internal("Update failed")));

      const result = await repository.update(mockMetadataId, { columns: mockColumns });

      expect(result.isFailure()).toBe(true);
    });
  });

  describe("delete", () => {
    it("should delete metadata by id using parameterized query", async () => {
      vi.spyOn(databricksPort, "executeSqlQuery").mockResolvedValue(success(emptySchemaData));

      const result = await repository.delete(mockMetadataId);

      expect(result.isSuccess()).toBe(true);
      assertSuccess(result);
      expect(result.value).toBe(true);

      expect(databricksPort.executeSqlQuery).toHaveBeenCalledWith(
        databricksPort.CENTRUM_SCHEMA_NAME,
        expect.stringContaining("DELETE FROM"),
        [{ name: "id", value: mockMetadataId }],
      );
    });

    it("should return failure when DELETE query fails", async () => {
      vi.spyOn(databricksPort, "executeSqlQuery").mockResolvedValue(
        failure(AppError.internal("Delete failed")),
      );

      const result = await repository.delete(mockMetadataId);

      expect(result.isFailure()).toBe(true);
    });
  });

  describe("deleteByExperimentId", () => {
    it("should delete metadata by experiment_id using parameterized query", async () => {
      vi.spyOn(databricksPort, "executeSqlQuery").mockResolvedValue(success(emptySchemaData));

      const result = await repository.deleteByExperimentId(mockExperimentId);

      expect(result.isSuccess()).toBe(true);
      assertSuccess(result);
      expect(result.value).toBe(true);

      expect(databricksPort.executeSqlQuery).toHaveBeenCalledWith(
        databricksPort.CENTRUM_SCHEMA_NAME,
        expect.stringContaining("WHERE experiment_id = :experiment_id"),
        [{ name: "experiment_id", value: mockExperimentId }],
      );
    });

    it("should not contain string-interpolated experiment ID in the SQL", async () => {
      const maliciousId = "'; DROP TABLE experiment_metadata; --";
      vi.spyOn(databricksPort, "executeSqlQuery").mockResolvedValue(success(emptySchemaData));

      await repository.deleteByExperimentId(maliciousId);

      const sqlCall = vi.mocked(databricksPort.executeSqlQuery).mock.calls[0];
      const sqlQuery = sqlCall[1];

      expect(sqlQuery).not.toContain(maliciousId);
      expect(sqlCall[2]).toEqual([{ name: "experiment_id", value: maliciousId }]);
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
