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
import type { CreateTransferRequestDto } from "../models/project-transfer-request.model";
import type { DatabricksPort } from "../ports/databricks.port";
import { DATABRICKS_PORT } from "../ports/databricks.port";
import { ProjectTransferRequestsRepository } from "./project-transfer-requests.repository";

/* eslint-disable @typescript-eslint/unbound-method */

describe("ProjectTransferRequestsRepository", () => {
  const testApp = TestHarness.App;
  let repository: ProjectTransferRequestsRepository;
  let databricksPort: DatabricksPort;

  const mockUserId = faker.string.uuid();
  const mockRequestId = faker.string.uuid();
  const mockProjectIdOld = "12345";
  const mockProjectUrlOld = "https://photosynq.org/projects/12345";
  const mockUserEmail = faker.internet.email();

  beforeAll(async () => {
    await testApp.setup();
  });

  beforeEach(async () => {
    await testApp.beforeEach();
    repository = testApp.module.get(ProjectTransferRequestsRepository);
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

  describe("createTransferRequest", () => {
    const createValidTransferRequest = (): CreateTransferRequestDto => ({
      userId: mockUserId,
      userEmail: mockUserEmail,
      sourcePlatform: "PhotosynQ",
      projectIdOld: mockProjectIdOld,
      projectUrlOld: mockProjectUrlOld,
      status: "pending",
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

    it("should successfully create transfer request", async () => {
      // Arrange
      const request = createValidTransferRequest();
      vi.spyOn(databricksPort, "executeSqlQuery").mockResolvedValue(success(mockSchemaData));

      // Act
      const result = await repository.createTransferRequest(request);

      // Assert
      expect(result.isSuccess()).toBe(true);
      assertSuccess(result);
      expect(result.value.userId).toBe(mockUserId);
      expect(result.value.userEmail).toBe(mockUserEmail);
      expect(result.value.projectIdOld).toBe(mockProjectIdOld);
      expect(result.value.projectUrlOld).toBe(mockProjectUrlOld);
      expect(result.value.status).toBe("pending");
      expect(result.value.requestId).toBeDefined();
      expect(result.value.requestedAt).toBeInstanceOf(Date);

      expect(databricksPort.executeSqlQuery).toHaveBeenCalledWith(
        "centrum",
        expect.stringContaining("INSERT INTO openjii_project_transfer_requests"),
      );
    });

    it("should return validation error for invalid user ID", async () => {
      // Arrange
      const invalidRequest: CreateTransferRequestDto = {
        ...createValidTransferRequest(),
        userId: "invalid-uuid", // Invalid UUID
      };

      // Act
      const result = await repository.createTransferRequest(invalidRequest);

      // Assert
      expect(result.isFailure()).toBe(true);
      assertFailure(result);
      expect(result.error).toBeInstanceOf(AppError);
      expect(result.error.message).toContain("Validation failed for transfer request");
    });

    it("should return validation error for invalid email", async () => {
      // Arrange
      const invalidRequest: CreateTransferRequestDto = {
        ...createValidTransferRequest(),
        userEmail: "not-an-email",
      };

      // Act
      const result = await repository.createTransferRequest(invalidRequest);

      // Assert
      expect(result.isFailure()).toBe(true);
      assertFailure(result);
      expect(result.error.message).toContain("Validation failed for transfer request");
    });

    it("should return validation error for invalid URL", async () => {
      // Arrange
      const invalidRequest: CreateTransferRequestDto = {
        ...createValidTransferRequest(),
        projectUrlOld: "not-a-url",
      };

      // Act
      const result = await repository.createTransferRequest(invalidRequest);

      // Assert
      expect(result.isFailure()).toBe(true);
      assertFailure(result);
      expect(result.error.message).toContain("Validation failed for transfer request");
    });

    it("should properly escape SQL injection characters", async () => {
      // Arrange
      const requestWithSpecialChars: CreateTransferRequestDto = {
        ...createValidTransferRequest(),
        projectIdOld: "test'project\"id",
      };
      vi.spyOn(databricksPort, "executeSqlQuery").mockResolvedValue(success(mockSchemaData));

      // Act
      const result = await repository.createTransferRequest(requestWithSpecialChars);

      // Assert
      expect(result.isSuccess()).toBe(true);

      const sqlCall = vi.mocked(databricksPort.executeSqlQuery).mock.calls[0];
      const sqlQuery = sqlCall[1];

      // Check that quotes are properly escaped
      expect(sqlQuery).toContain("test''project");
    });

    it("should handle databricks port failure", async () => {
      // Arrange
      const request = createValidTransferRequest();
      const databricksError = AppError.internal("Databricks connection failed");
      vi.spyOn(databricksPort, "executeSqlQuery").mockResolvedValue(failure(databricksError));

      // Act
      const result = await repository.createTransferRequest(request);

      // Assert
      expect(result.isFailure()).toBe(true);
      assertFailure(result);
      expect(result.error.message).toContain(
        "Failed to insert transfer request: Databricks connection failed",
      );
    });
  });

  describe("listTransferRequests", () => {
    const mockSchemaData: SchemaData = {
      columns: [
        { name: "request_id", type_name: "STRING", type_text: "STRING" },
        { name: "user_id", type_name: "STRING", type_text: "STRING" },
        { name: "user_email", type_name: "STRING", type_text: "STRING" },
        { name: "source_platform", type_name: "STRING", type_text: "STRING" },
        { name: "project_id_old", type_name: "STRING", type_text: "STRING" },
        { name: "project_url_old", type_name: "STRING", type_text: "STRING" },
        { name: "status", type_name: "STRING", type_text: "STRING" },
        { name: "requested_at", type_name: "TIMESTAMP", type_text: "TIMESTAMP" },
      ],
      rows: [
        [
          mockRequestId,
          mockUserId,
          mockUserEmail,
          "PhotosynQ",
          mockProjectIdOld,
          mockProjectUrlOld,
          "pending",
          "2024-01-15T10:30:00.000Z",
        ],
        [
          faker.string.uuid(),
          mockUserId,
          mockUserEmail,
          "PhotosynQ",
          "67890",
          "https://photosynq.org/projects/67890",
          "completed",
          "2024-01-14T09:20:00.000Z",
        ],
      ],
      totalRows: 2,
      truncated: false,
    };

    it("should list transfer requests for a specific user", async () => {
      // Arrange
      vi.spyOn(databricksPort, "executeSqlQuery").mockResolvedValue(success(mockSchemaData));

      // Act
      const result = await repository.listTransferRequests(mockUserId);

      // Assert
      expect(result.isSuccess()).toBe(true);
      assertSuccess(result);
      expect(result.value).toHaveLength(2);
      expect(result.value[0].userId).toBe(mockUserId);
      expect(result.value[0].userEmail).toBe(mockUserEmail);
      expect(result.value[0].projectIdOld).toBe(mockProjectIdOld);
      expect(result.value[0].status).toBe("pending");
      expect(result.value[0].requestedAt).toBeInstanceOf(Date);

      expect(databricksPort.executeSqlQuery).toHaveBeenCalledWith(
        "centrum",
        expect.stringContaining(`WHERE user_id = '${mockUserId}'`),
      );
    });

    it("should list all transfer requests when no user ID provided", async () => {
      // Arrange
      vi.spyOn(databricksPort, "executeSqlQuery").mockResolvedValue(success(mockSchemaData));

      // Act
      const result = await repository.listTransferRequests();

      // Assert
      expect(result.isSuccess()).toBe(true);
      assertSuccess(result);
      expect(result.value).toHaveLength(2);

      const sqlCall = vi.mocked(databricksPort.executeSqlQuery).mock.calls[0];
      const sqlQuery = sqlCall[1];

      expect(sqlQuery).not.toContain("WHERE user_id");
    });

    it("should return empty array when no transfer requests exist", async () => {
      // Arrange
      const emptySchemaData: SchemaData = {
        ...mockSchemaData,
        rows: [],
        totalRows: 0,
      };
      vi.spyOn(databricksPort, "executeSqlQuery").mockResolvedValue(success(emptySchemaData));

      // Act
      const result = await repository.listTransferRequests(mockUserId);

      // Assert
      expect(result.isSuccess()).toBe(true);
      assertSuccess(result);
      expect(result.value).toHaveLength(0);
    });

    it("should handle databricks port failure", async () => {
      // Arrange
      const databricksError = AppError.internal("Databricks connection failed");
      vi.spyOn(databricksPort, "executeSqlQuery").mockResolvedValue(failure(databricksError));

      // Act
      const result = await repository.listTransferRequests(mockUserId);

      // Assert
      expect(result.isFailure()).toBe(true);
      assertFailure(result);
      expect(result.error.message).toContain(
        "Failed to list transfer requests: Databricks connection failed",
      );
    });
  });

  describe("findExistingRequest", () => {
    const mockSchemaData: SchemaData = {
      columns: [
        { name: "request_id", type_name: "STRING", type_text: "STRING" },
        { name: "user_id", type_name: "STRING", type_text: "STRING" },
        { name: "user_email", type_name: "STRING", type_text: "STRING" },
        { name: "source_platform", type_name: "STRING", type_text: "STRING" },
        { name: "project_id_old", type_name: "STRING", type_text: "STRING" },
        { name: "project_url_old", type_name: "STRING", type_text: "STRING" },
        { name: "status", type_name: "STRING", type_text: "STRING" },
        { name: "requested_at", type_name: "TIMESTAMP", type_text: "TIMESTAMP" },
      ],
      rows: [
        [
          mockRequestId,
          mockUserId,
          mockUserEmail,
          "PhotosynQ",
          mockProjectIdOld,
          mockProjectUrlOld,
          "pending",
          "2024-01-15T10:30:00.000Z",
        ],
      ],
      totalRows: 1,
      truncated: false,
    };

    it("should find existing transfer request", async () => {
      // Arrange
      vi.spyOn(databricksPort, "executeSqlQuery").mockResolvedValue(success(mockSchemaData));

      // Act
      const result = await repository.findExistingRequest(mockUserId, mockProjectIdOld);

      // Assert
      expect(result.isSuccess()).toBe(true);
      assertSuccess(result);
      expect(result.value).not.toBeNull();
      expect(result.value?.userId).toBe(mockUserId);
      expect(result.value?.projectIdOld).toBe(mockProjectIdOld);
      expect(result.value?.status).toBe("pending");

      expect(databricksPort.executeSqlQuery).toHaveBeenCalledWith(
        "centrum",
        expect.stringContaining("WHERE user_id = "),
      );
      expect(databricksPort.executeSqlQuery).toHaveBeenCalledWith(
        "centrum",
        expect.stringContaining("LIMIT 1"),
      );
    });

    it("should return null when no existing request found", async () => {
      // Arrange
      const emptySchemaData: SchemaData = {
        ...mockSchemaData,
        rows: [],
        totalRows: 0,
      };
      vi.spyOn(databricksPort, "executeSqlQuery").mockResolvedValue(success(emptySchemaData));

      // Act
      const result = await repository.findExistingRequest(mockUserId, mockProjectIdOld);

      // Assert
      expect(result.isSuccess()).toBe(true);
      assertSuccess(result);
      expect(result.value).toBeNull();
    });

    it("should return validation error for invalid user ID", async () => {
      // Act
      const result = await repository.findExistingRequest("invalid-uuid", mockProjectIdOld);

      // Assert
      expect(result.isFailure()).toBe(true);
      assertFailure(result);
      expect(result.error.message).toContain("Invalid user ID");
    });

    it("should return validation error for invalid project ID", async () => {
      // Act
      const result = await repository.findExistingRequest(mockUserId, "");

      // Assert
      expect(result.isFailure()).toBe(true);
      assertFailure(result);
      expect(result.error.message).toContain("Invalid project ID");
    });

    it("should handle databricks port failure", async () => {
      // Arrange
      const databricksError = AppError.internal("Databricks connection failed");
      vi.spyOn(databricksPort, "executeSqlQuery").mockResolvedValue(failure(databricksError));

      // Act
      const result = await repository.findExistingRequest(mockUserId, mockProjectIdOld);

      // Assert
      expect(result.isFailure()).toBe(true);
      assertFailure(result);
      expect(result.error.message).toContain(
        "Failed to check for existing transfer request: Databricks connection failed",
      );
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

    it("should protect against SQL injection in project ID", async () => {
      // Arrange
      const maliciousRequest: CreateTransferRequestDto = {
        userId: mockUserId,
        userEmail: mockUserEmail,
        sourcePlatform: "PhotosynQ",
        projectIdOld: "'; DROP TABLE openjii_project_transfer_requests; --",
        projectUrlOld: mockProjectUrlOld,
        status: "pending",
      };

      vi.spyOn(databricksPort, "executeSqlQuery").mockResolvedValue(success(mockSchemaData));

      // Act
      const result = await repository.createTransferRequest(maliciousRequest);

      // Assert
      expect(result.isSuccess()).toBe(true);

      const sqlCall = vi.mocked(databricksPort.executeSqlQuery).mock.calls[0];
      const sqlQuery = sqlCall[1];

      // SQL injection attempt should be properly escaped (single quotes escaped as double quotes)
      expect(sqlQuery).toContain("''; DROP TABLE openjii_project_transfer_requests; --'");
    });

    it("should validate project ID format to prevent injection", async () => {
      // Arrange
      const invalidRequest: CreateTransferRequestDto = {
        userId: mockUserId,
        userEmail: mockUserEmail,
        sourcePlatform: "PhotosynQ",
        projectIdOld: "x".repeat(256), // Exceeds max length
        projectUrlOld: mockProjectUrlOld,
        status: "pending",
      };

      // Act
      const result = await repository.createTransferRequest(invalidRequest);

      // Assert
      expect(result.isFailure()).toBe(true);
      assertFailure(result);
      expect(result.error.message).toContain("Validation failed for transfer request");
    });

    it("should handle special characters in all string fields", async () => {
      // Arrange
      const requestWithSpecialChars: CreateTransferRequestDto = {
        userId: mockUserId,
        userEmail: mockUserEmail,
        sourcePlatform: "Test\nPlatform\r\n",
        projectIdOld: mockProjectIdOld,
        projectUrlOld: "https://example.com/projects/test'value",
        status: "pending",
      };
      vi.spyOn(databricksPort, "executeSqlQuery").mockResolvedValue(success(mockSchemaData));

      // Act
      const result = await repository.createTransferRequest(requestWithSpecialChars);

      // Assert
      expect(result.isSuccess()).toBe(true);

      const sqlCall = vi.mocked(databricksPort.executeSqlQuery).mock.calls[0];
      const sqlQuery = sqlCall[1];

      // Check that special characters are properly escaped
      expect(sqlQuery).toContain("\\n");
      expect(sqlQuery).toContain("\\r");
      expect(sqlQuery).toContain("''value");
    });
  });
});
