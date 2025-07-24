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
      const flowData = {
        name: "Test Flow",
        description: "A test flow for validation",
        version: 1,
        isActive: true,
      };

      const result = await useCase.execute(flowData, testUserId);

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
      const flowData = {
        name: "Minimal Flow",
      };

      const result = await useCase.execute(flowData, testUserId);

      assertSuccess(result);
      expect(result.value).toMatchObject({
        name: flowData.name,
        version: 1,
        isActive: true,
        createdBy: testUserId,
      });
    });

    it("should handle repository returning empty array", async () => {
      const flowData = {
        name: "Test Flow",
        description: "A test flow",
      };

      // Mock the repository to return empty array
      jest.spyOn(flowRepository, "create").mockResolvedValueOnce(success([]));

      const result = await useCase.execute(flowData, testUserId);

      assertFailure(result);
      expect(result.error).toBeInstanceOf(CreateFlowError);
      expect(result.error.message).toBe("Failed to create flow");
      expect(result.error.code).toBe("CREATE_FLOW_ERROR");
      expect(result.error.statusCode).toBe(400);
    });

    it("should handle repository failure", async () => {
      const flowData = {
        name: "Test Flow",
        description: "A test flow",
      };

      const repositoryError = new Error("Database connection failed");
      jest.spyOn(flowRepository, "create").mockResolvedValueOnce(failure(repositoryError as any));

      const result = await useCase.execute(flowData, testUserId);

      assertFailure(result);
      expect(result.error).toBe(repositoryError);
    });

    it("should handle repository throwing an exception", async () => {
      const flowData = {
        name: "Test Flow",
        description: "A test flow",
      };

      const repositoryError = new Error("Unexpected database error");
      jest.spyOn(flowRepository, "create").mockRejectedValueOnce(repositoryError);

      await expect(useCase.execute(flowData, testUserId)).rejects.toThrow(repositoryError);
    });

    it("should log flow creation start and success", async () => {
      const flowData = {
        name: "Test Flow for Logging",
        description: "A test flow to verify logging",
      };

      const logSpy = jest.spyOn(useCase["logger"], "log");

      const result = await useCase.execute(flowData, testUserId);

      assertSuccess(result);
      expect(logSpy).toHaveBeenCalledWith(
        `Creating flow "${flowData.name}" for user ${testUserId}`,
      );
      expect(logSpy).toHaveBeenCalledWith(
        `Successfully created flow "${result.value.name}" with ID ${result.value.id}`,
      );
    });

    it("should log error when flow creation fails", async () => {
      const flowData = {
        name: "Test Flow for Error Logging",
        description: "A test flow to verify error logging",
      };

      const logSpy = jest.spyOn(useCase["logger"], "error");

      // Mock the repository to return empty array
      jest.spyOn(flowRepository, "create").mockResolvedValueOnce(success([]));

      const result = await useCase.execute(flowData, testUserId);

      assertFailure(result);
      expect(logSpy).toHaveBeenCalledWith(
        `Failed to create flow "${flowData.name}" for user ${testUserId}`,
      );
    });

    it("should create flow with all optional fields", async () => {
      const flowData = {
        name: "Complete Flow",
        description: "A complete flow with all fields",
        version: 2,
        isActive: false,
      };

      const result = await useCase.execute(flowData, testUserId);

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

  describe("edge cases and error scenarios", () => {
    it("should handle repository create method returning null", async () => {
      const flowData = {
        name: "Test Flow",
        description: "A test flow",
      };

      // Mock the repository to return null
      jest.spyOn(flowRepository, "create").mockResolvedValueOnce(success(null as any));

      const result = await useCase.execute(flowData, testUserId);

      assertFailure(result);
      expect(result.error).toBeInstanceOf(CreateFlowError);
    });

    it("should handle repository create method returning undefined", async () => {
      const flowData = {
        name: "Test Flow",
        description: "A test flow",
      };

      // Mock the repository to return undefined
      jest.spyOn(flowRepository, "create").mockResolvedValueOnce(success(undefined as any));

      const result = await useCase.execute(flowData, testUserId);

      assertFailure(result);
      expect(result.error).toBeInstanceOf(CreateFlowError);
    });

    it("should handle repository create method returning array with null elements", async () => {
      const flowData = {
        name: "Test Flow",
        description: "A test flow",
      };

      // Mock the repository to return array with null
      jest.spyOn(flowRepository, "create").mockResolvedValueOnce(success([null] as any));

      const result = await useCase.execute(flowData, testUserId);

      assertFailure(result);
      expect(result.error).toBeInstanceOf(CreateFlowError);
    });

    it("should handle chain method failure propagation", async () => {
      const flowData = {
        name: "Test Flow",
        description: "A test flow",
      };

      const chainError = new Error("Chain processing failed");

      // Mock repository to return success but simulate chain failure
      const mockResult = {
        chain: jest.fn().mockReturnValue(failure(chainError)),
      };
      jest.spyOn(flowRepository, "create").mockResolvedValueOnce(mockResult as any);

      const result = await useCase.execute(flowData, testUserId);

      assertFailure(result);
      expect(result.error).toBe(chainError);
    });

    it("should handle very long flow names", async () => {
      const flowData = {
        name: "x".repeat(1000), // Very long name
        description: "Flow with extremely long name",
      };

      const result = await useCase.execute(flowData, testUserId);

      // Should either succeed or fail gracefully depending on database constraints
      if (result.isSuccess()) {
        expect(result.value.name).toBe(flowData.name);
      } else {
        expect(result.error).toBeInstanceOf(Error);
      }
    });

    it("should handle special characters in flow data", async () => {
      const flowData = {
        name: "Test Flow with émojis 🚀 and spéciål chars",
        description: "Description with newlines\nand tabs\t and quotes'\"",
      };

      const result = await useCase.execute(flowData, testUserId);

      assertSuccess(result);
      expect(result.value.name).toBe(flowData.name);
      expect(result.value.description).toBe(flowData.description);
    });

    it("should handle concurrent flow creation", async () => {
      const flowData1 = { name: "Concurrent Flow 1" };
      const flowData2 = { name: "Concurrent Flow 2" };

      const [result1, result2] = await Promise.all([
        useCase.execute(flowData1, testUserId),
        useCase.execute(flowData2, testUserId),
      ]);

      assertSuccess(result1);
      assertSuccess(result2);
      expect(result1.value.id).not.toBe(result2.value.id);
    });
  });
});
