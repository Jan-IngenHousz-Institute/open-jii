import { faker } from "@faker-js/faker";
import { expect } from "vitest";

import type { SchemaData } from "../../../common/modules/databricks/services/sql/sql.types";
import {
  AppError,
  assertFailure,
  assertSuccess,
  failure,
  success,
} from "../../../common/utils/fp-utils";
import { TestHarness } from "../../../test/test-harness";
import type {
  CreateAnnotationDto,
  UpdateAnnotationDto,
} from "../models/experiment-data-annotation.model";
import type { DatabricksPort } from "../ports/databricks.port";
import { DATABRICKS_PORT } from "../ports/databricks.port";
import { ExperimentDataAnnotationsRepository } from "./experiment-data-annotations.repository";

/* eslint-disable @typescript-eslint/unbound-method */

describe("ExperimentDataAnnotationsRepository", () => {
  const testApp = TestHarness.App;
  let repository: ExperimentDataAnnotationsRepository;
  let databricksPort: DatabricksPort;

  const mockExperimentName = "test_experiment";
  const mockExperimentId = faker.string.uuid();
  const mockUserId = faker.string.uuid();
  const mockAnnotationId = faker.string.uuid();
  const mockRowId = faker.string.uuid();
  const mockTableName = "experiment_data_table";

  beforeAll(async () => {
    await testApp.setup();
  });

  beforeEach(async () => {
    await testApp.beforeEach();
    repository = testApp.module.get(ExperimentDataAnnotationsRepository);
    databricksPort = testApp.module.get(DATABRICKS_PORT);

    // Reset any mocks before each test
    vi.restoreAllMocks();
  });

  afterEach(() => {
    testApp.afterEach();
  });

  afterAll(async () => {
    await testApp.teardown();
  });

  describe("storeAnnotations", () => {
    const createValidAnnotation = (): CreateAnnotationDto => ({
      userId: mockUserId,
      tableName: mockTableName,
      rowId: mockRowId,
      type: "comment",
      contentText: "This is a test comment",
      flagType: null,
    });
    const mockSchemaData: SchemaData = {
      columns: [
        { name: "num_affected_rows", type_name: "LONG", type_text: "BIGINT" },
        { name: "num_inserted_rows", type_name: "LONG", type_text: "BIGINT" },
      ],
      rows: [["1", "1"]],
      totalRows: 1,
      truncated: false,
    };

    it("should successfully store single annotation", async () => {
      // Arrange
      const annotations = [createValidAnnotation()];
      vi.spyOn(databricksPort, "executeExperimentSqlQuery").mockResolvedValue(
        success(mockSchemaData),
      );

      // Act
      const result = await repository.storeAnnotations(
        mockExperimentName,
        mockExperimentId,
        annotations,
      );

      // Assert
      expect(result.isSuccess()).toBe(true);
      assertSuccess(result);
      expect(result.value).toEqual({ rowsAffected: 1 });

      expect(databricksPort.executeExperimentSqlQuery).toHaveBeenCalledWith(
        mockExperimentName,
        mockExperimentId,
        expect.stringContaining("INSERT INTO annotations"),
      );
    });

    it("should successfully store multiple annotations with bulk insert", async () => {
      // Arrange
      const annotations = [
        createValidAnnotation(),
        {
          ...createValidAnnotation(),
          type: "flag" as const,
          contentText: null,
          flagType: "outlier",
          flagReason: "Data point seems anomalous",
        },
      ];
      vi.spyOn(databricksPort, "executeExperimentSqlQuery").mockResolvedValue(
        success(mockSchemaData),
      );

      // Act
      const result = await repository.storeAnnotations(
        mockExperimentName,
        mockExperimentId,
        annotations,
      );

      // Assert
      expect(result.isSuccess()).toBe(true);
      assertSuccess(result);

      const sqlCall = vi.mocked(databricksPort.executeExperimentSqlQuery).mock.calls[0];
      const sqlQuery = sqlCall[2];

      // Should contain both VALUES clauses
      expect(sqlQuery).toMatch(/VALUES.*?,.*?\)/s);
      expect(databricksPort.executeExperimentSqlQuery).toHaveBeenCalledTimes(1);
    });

    it("should return success with empty result when no annotations provided", async () => {
      // Act
      const result = await repository.storeAnnotations(mockExperimentName, mockExperimentId, []);

      // Assert
      expect(result.isSuccess()).toBe(true);
      assertSuccess(result);
      expect(result.value).toEqual({ rowsAffected: 0 });
      // Method is not called for empty arrays
    });

    it("should return validation error for invalid annotation data", async () => {
      // Arrange
      const invalidAnnotations = [
        {
          ...createValidAnnotation(),
          userId: "invalid-uuid", // Invalid UUID
        },
      ];

      // Act
      const result = await repository.storeAnnotations(
        mockExperimentName,
        mockExperimentId,
        invalidAnnotations,
      );

      // Assert
      expect(result.isFailure()).toBe(true);
      assertFailure(result);
      expect(result.error).toBeInstanceOf(AppError);
      expect(result.error.message).toContain("Validation failed for annotation");
    });

    it("should properly escape SQL injection characters", async () => {
      // Arrange
      const annotationWithSpecialChars = {
        ...createValidAnnotation(),
        contentText: "Test with 'quotes' and \n newlines \\backslashes",
      };
      vi.spyOn(databricksPort, "executeExperimentSqlQuery").mockResolvedValue(
        success(mockSchemaData),
      );

      // Act
      const result = await repository.storeAnnotations(mockExperimentName, mockExperimentId, [
        annotationWithSpecialChars,
      ]);

      // Assert
      expect(result.isSuccess()).toBe(true);

      const sqlCall = vi.mocked(databricksPort.executeExperimentSqlQuery).mock.calls[0];
      const sqlQuery = sqlCall[2];

      // Check that quotes are properly escaped
      expect(sqlQuery).toContain("''quotes''");
      expect(sqlQuery).toContain("\\n");
      expect(sqlQuery).toContain("\\\\");
    });

    it("should handle databricks port failure", async () => {
      // Arrange
      const annotations = [createValidAnnotation()];
      const databricksError = AppError.internal("Databricks connection failed");
      vi.spyOn(databricksPort, "executeExperimentSqlQuery").mockResolvedValue(
        failure(databricksError),
      );

      // Act
      const result = await repository.storeAnnotations(
        mockExperimentName,
        mockExperimentId,
        annotations,
      );

      // Assert
      expect(result.isFailure()).toBe(true);
      assertFailure(result);
      expect(result.error.message).toBe(
        "Failed to insert annotations: Databricks connection failed",
      );
    });
  });

  describe("updateAnnotation", () => {
    const validUpdateData: UpdateAnnotationDto = {
      contentText: "Updated comment text",
      flagType: "needs_review",
    };
    const mockSchemaData: SchemaData = {
      columns: [
        { name: "num_affected_rows", type_name: "LONG", type_text: "BIGINT" },
        { name: "num_updated_rows", type_name: "LONG", type_text: "BIGINT" },
      ],
      rows: [["1", "1"]],
      totalRows: 1,
      truncated: false,
    };

    it("should successfully update annotation", async () => {
      // Arrange
      vi.spyOn(databricksPort, "executeExperimentSqlQuery").mockResolvedValue(
        success(mockSchemaData),
      );

      // Act
      const result = await repository.updateAnnotation(
        mockExperimentName,
        mockExperimentId,
        mockAnnotationId,
        validUpdateData,
      );

      // Assert
      expect(result.isSuccess()).toBe(true);
      assertSuccess(result);

      expect(databricksPort.executeExperimentSqlQuery).toHaveBeenCalledWith(
        mockExperimentName,
        mockExperimentId,
        expect.stringContaining("UPDATE annotations"),
      );

      const sqlCall = vi.mocked(databricksPort.executeExperimentSqlQuery).mock.calls[0];
      const sqlQuery = sqlCall[2];

      expect(sqlQuery).toContain(`WHERE id = '${mockAnnotationId}'`);
      expect(sqlQuery).toContain("content_text =");
      expect(sqlQuery).toContain("flag_type =");
      expect(sqlQuery).toContain("updated_at =");
    });

    it("should update only provided fields", async () => {
      // Arrange
      const partialUpdateData: UpdateAnnotationDto = {
        contentText: "Only updating content",
      };
      vi.spyOn(databricksPort, "executeExperimentSqlQuery").mockResolvedValue(
        success(mockSchemaData),
      );

      // Act
      const result = await repository.updateAnnotation(
        mockExperimentName,
        mockExperimentId,
        mockAnnotationId,
        partialUpdateData,
      );

      // Assert
      expect(result.isSuccess()).toBe(true);

      const sqlCall = vi.mocked(databricksPort.executeExperimentSqlQuery).mock.calls[0];
      const sqlQuery = sqlCall[2];

      expect(sqlQuery).toContain("content_text =");
      expect(sqlQuery).not.toContain("flag_type =");
      expect(sqlQuery).not.toContain("flag_reason =");
      expect(sqlQuery).toContain("updated_at =");
    });

    it("should return validation error for invalid annotation ID", async () => {
      // Act
      const result = await repository.updateAnnotation(
        mockExperimentName,
        mockExperimentId,
        "invalid-uuid",
        validUpdateData,
      );

      // Assert
      expect(result.isFailure()).toBe(true);
      assertFailure(result);
      expect(result.error.message).toContain("Invalid annotation ID");
      // Method is not called on validation error
    });

    it("should return validation error for invalid update data", async () => {
      // Arrange
      const invalidUpdateData = {
        contentText: "x".repeat(10001), // Exceeds max length
      };

      // Act
      const result = await repository.updateAnnotation(
        mockExperimentName,
        mockExperimentId,
        mockAnnotationId,
        invalidUpdateData,
      );

      // Assert
      expect(result.isFailure()).toBe(true);
      assertFailure(result);
      expect(result.error.message).toContain("Invalid update data");
    });
  });

  describe("deleteAnnotation", () => {
    const mockSchemaData: SchemaData = {
      columns: [
        { name: "num_affected_rows", type_name: "LONG", type_text: "BIGINT" },
        { name: "num_deleted_rows", type_name: "LONG", type_text: "BIGINT" },
      ],
      rows: [["1", "1"]],
      totalRows: 1,
      truncated: false,
    };

    it("should successfully delete annotation", async () => {
      // Arrange
      vi.spyOn(databricksPort, "executeExperimentSqlQuery").mockResolvedValue(
        success(mockSchemaData),
      );

      // Act
      const result = await repository.deleteAnnotation(
        mockExperimentName,
        mockExperimentId,
        mockAnnotationId,
      );

      // Assert
      expect(result.isSuccess()).toBe(true);
      assertSuccess(result);

      expect(databricksPort.executeExperimentSqlQuery).toHaveBeenCalledWith(
        mockExperimentName,
        mockExperimentId,
        expect.stringContaining("DELETE FROM annotations"),
      );

      const sqlCall = vi.mocked(databricksPort.executeExperimentSqlQuery).mock.calls[0];
      const sqlQuery = sqlCall[2];

      expect(sqlQuery).toContain(`WHERE id = '${mockAnnotationId}'`);
      expect(sqlQuery).not.toContain("user_id =");
    });

    it("should return validation error for invalid annotation ID", async () => {
      // Act
      const result = await repository.deleteAnnotation(
        mockExperimentName,
        mockExperimentId,
        "invalid-uuid",
      );

      // Assert
      expect(result.isFailure()).toBe(true);
      assertFailure(result);
      expect(result.error.message).toContain("Invalid annotation ID");
      // Method is not called on validation error
    });
  });

  describe("deleteAnnotationsBulk", () => {
    const mockSchemaData: SchemaData = {
      columns: [
        { name: "num_affected_rows", type_name: "LONG", type_text: "BIGINT" },
        { name: "num_deleted_rows", type_name: "LONG", type_text: "BIGINT" },
      ],
      rows: [["1", "1"]],
      totalRows: 1,
      truncated: false,
    };

    it("should successfully delete multiple annotations", async () => {
      // Arrange
      vi.spyOn(databricksPort, "executeExperimentSqlQuery").mockResolvedValue(
        success(mockSchemaData),
      );
      const rowIds = ["test1", "test2"];

      // Act
      const result = await repository.deleteAnnotationsBulk(
        mockExperimentName,
        mockExperimentId,
        mockTableName,
        rowIds,
        "comment",
      );

      // Assert
      expect(result.isSuccess()).toBe(true);
      assertSuccess(result);

      expect(databricksPort.executeExperimentSqlQuery).toHaveBeenCalledWith(
        mockExperimentName,
        mockExperimentId,
        expect.stringContaining("DELETE FROM annotations"),
      );

      const sqlCall = vi.mocked(databricksPort.executeExperimentSqlQuery).mock.calls[0];
      const sqlQuery = sqlCall[2];

      expect(sqlQuery).toContain(`table_name='${mockTableName}'`);
      expect(sqlQuery).toContain("id IN (");
      rowIds.forEach((id) => {
        expect(sqlQuery).toContain(`'${id}'`);
      });
      expect(sqlQuery).toContain(`type='comment`);
      expect(sqlQuery).not.toContain("user_id =");
    });

    it("should return success with empty result when no annotation IDs provided", async () => {
      // Act
      const result = await repository.storeAnnotations(mockExperimentName, mockExperimentId, []);

      // Assert
      expect(result.isSuccess()).toBe(true);
      assertSuccess(result);
      expect(result.value).toEqual({ rowsAffected: 0 });
      // Method is not called for empty arrays
    });
  });

  describe("SQL injection protection", () => {
    const mockSchemaData: SchemaData = {
      columns: [
        { name: "num_affected_rows", type_name: "LONG", type_text: "BIGINT" },
        { name: "num_inserted_rows", type_name: "LONG", type_text: "BIGINT" },
      ],
      rows: [["1", "1"]],
      totalRows: 1,
      truncated: false,
    };

    it("should protect against SQL injection in annotation content", async () => {
      // Arrange
      const maliciousAnnotation: CreateAnnotationDto = {
        userId: mockUserId,
        tableName: mockTableName,
        rowId: mockRowId,
        type: "comment",
        contentText: "'; DROP TABLE annotations; --",
        flagType: null,
      };

      vi.spyOn(databricksPort, "executeExperimentSqlQuery").mockResolvedValue(
        success(mockSchemaData),
      );

      // Act
      const result = await repository.storeAnnotations(mockExperimentName, mockExperimentId, [
        maliciousAnnotation,
      ]);

      // Assert
      expect(result.isSuccess()).toBe(true);

      const sqlCall = vi.mocked(databricksPort.executeExperimentSqlQuery).mock.calls[0];
      const sqlQuery = sqlCall[2];

      // SQL injection attempt should be properly escaped (single quotes escaped as double quotes)
      expect(sqlQuery).toContain("''; DROP TABLE annotations; --'");
      // The malicious string should not appear unescaped in the final query
    });

    it("should validate table names and types to prevent injection", async () => {
      // Arrange
      const invalidAnnotation: CreateAnnotationDto = {
        userId: mockUserId,
        tableName: "invalid; DROP TABLE", // Invalid table name
        rowId: mockRowId,
        type: "comment",
        contentText: "test",
        flagType: null,
      };

      // Act
      const result = await repository.storeAnnotations(mockExperimentName, mockExperimentId, [
        invalidAnnotation,
      ]);

      // Assert
      expect(result.isFailure()).toBe(true);
      assertFailure(result);
      expect(result.error.message).toContain("Validation failed for annotation");
    });
  });
});
