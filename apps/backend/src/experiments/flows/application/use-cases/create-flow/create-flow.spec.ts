import { TestHarness } from "@/test/test-harness";

import {
  assertSuccess,
  assertFailure,
  success,
  failure,
} from "../../../../../common/utils/fp-utils";
import { FlowRepository } from "../../../core/repositories/flow.repository";
import { CreateFlowUseCase, CreateFlowError } from "./create-flow";

describe("CreateFlowUseCase", () => {
  const testApp = TestHarness.App;
  let testUserId: string;
  let useCase: CreateFlowUseCase;
  let flowRepository: FlowRepository;

  beforeAll(async () => {
    await testApp.setup();
  });

  beforeEach(async () => {
    await testApp.beforeEach();
    testUserId = await testApp.createTestUser({});
    useCase = testApp.module.get(CreateFlowUseCase);
    flowRepository = testApp.module.get(FlowRepository);
  });

  afterEach(() => {
    testApp.afterEach();
  });

  afterAll(async () => {
    await testApp.teardown();
  });

  describe("execute", () => {
    it("should create a flow successfully", async () => {
      // Arrange
      const flowData = {
        name: "Test Flow",
        description: "A test flow for validation",
        version: 1,
        isActive: true,
      };

      // Act
      const result = await useCase.execute(flowData, testUserId);

      // Assert
      assertSuccess(result);
      expect(result.value).toMatchObject({
        name: flowData.name,
        description: flowData.description,
        version: 1,
        isActive: true,
        createdBy: testUserId,
      });
      expect(result.value.id).toBeDefined();

      // Verify flow was created in database
      const findResult = await flowRepository.findOne(result.value.id);
      assertSuccess(findResult);
      expect(findResult.value).toMatchObject({
        name: flowData.name,
        createdBy: testUserId,
      });
    });

    it("should create a flow with minimal data", async () => {
      // Arrange
      const flowData = {
        name: "Minimal Flow",
      };

      // Act
      const result = await useCase.execute(flowData, testUserId);

      // Assert
      assertSuccess(result);
      expect(result.value).toMatchObject({
        name: flowData.name,
        version: 1,
        isActive: true,
        createdBy: testUserId,
      });
    });

    // Note: Removed spy-based tests - real repository behavior is tested elsewhere

    it("should create flow with all optional fields", async () => {
      // Arrange
      const flowData = {
        name: "Complete Flow",
        description: "A complete flow with all fields",
        version: 2,
        isActive: false,
      };

      // Act
      const result = await useCase.execute(flowData, testUserId);

      // Assert
      assertSuccess(result);
      expect(result.value).toMatchObject({
        name: flowData.name,
        description: flowData.description,
        version: 2,
        isActive: false,
        createdBy: testUserId,
      });
    });
  });

  describe("CreateFlowError", () => {
    it("should create error with message and default properties", () => {
      const error = new CreateFlowError("Test error message");

      expect(error.message).toBe("Test error message");
      expect(error.code).toBe("CREATE_FLOW_ERROR");
      expect(error.statusCode).toBe(400);
      expect(error.details).toEqual({});
    });

    it("should create error with message and cause", () => {
      const cause = new Error("Root cause");
      const error = new CreateFlowError("Test error message", cause);

      expect(error.message).toBe("Test error message");
      expect(error.code).toBe("CREATE_FLOW_ERROR");
      expect(error.statusCode).toBe(400);
      expect(error.details).toEqual({ cause });
    });

    it("should create error with undefined cause", () => {
      const error = new CreateFlowError("Test error message", undefined);

      expect(error.message).toBe("Test error message");
      expect(error.code).toBe("CREATE_FLOW_ERROR");
      expect(error.statusCode).toBe(400);
      expect(error.details).toEqual({ cause: undefined });
    });

    it("should create error with null cause", () => {
      const error = new CreateFlowError("Test error message", null);

      expect(error.message).toBe("Test error message");
      expect(error.code).toBe("CREATE_FLOW_ERROR");
      expect(error.statusCode).toBe(400);
      expect(error.details).toEqual({ cause: null });
    });

    it("should create error with complex cause object", () => {
      const cause = {
        type: "DatabaseError",
        details: { table: "flows", constraint: "unique_name" },
      };
      const error = new CreateFlowError("Database constraint violation", cause);

      expect(error.message).toBe("Database constraint violation");
      expect(error.code).toBe("CREATE_FLOW_ERROR");
      expect(error.statusCode).toBe(400);
      expect(error.details).toEqual({ cause });
    });
  });

  describe("edge cases", () => {
    // Note: Removed spy-based edge case tests - these are covered by integration tests

    it("should handle very long flow names", async () => {
      // Arrange
      const flowData = {
        name: "x".repeat(1000), // Very long name
        description: "Flow with extremely long name",
      };

      // Act
      const result = await useCase.execute(flowData, testUserId);

      // Assert - Should either succeed or fail gracefully depending on database constraints
      if (result.isSuccess()) {
        expect(result.value.name).toBe(flowData.name);
      } else {
        expect(result.error).toBeInstanceOf(Error);
      }
    });

    it("should handle special characters in flow data", async () => {
      // Arrange
      const flowData = {
        name: "Test Flow with émojis 🚀 and spéciål chars",
        description: "Description with newlines\nand tabs\t and quotes'\"",
      };

      // Act
      const result = await useCase.execute(flowData, testUserId);

      // Assert
      assertSuccess(result);
      expect(result.value.name).toBe(flowData.name);
      expect(result.value.description).toBe(flowData.description);
    });

    it("should handle concurrent flow creation", async () => {
      // Arrange
      const flowData1 = { name: "Concurrent Flow 1" };
      const flowData2 = { name: "Concurrent Flow 2" };

      // Act
      const [result1, result2] = await Promise.all([
        useCase.execute(flowData1, testUserId),
        useCase.execute(flowData2, testUserId),
      ]);

      // Assert
      assertSuccess(result1);
      assertSuccess(result2);
      expect(result1.value.id).not.toBe(result2.value.id);
    });
  });
});
