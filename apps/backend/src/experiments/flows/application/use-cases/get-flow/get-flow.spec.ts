import { TestHarness } from "@/test/test-harness";

import {
  assertSuccess,
  assertFailure,
  success,
  failure,
} from "../../../../../common/utils/fp-utils";
import { FlowStepRepository } from "../../../core/repositories/flow-step.repository";
import { FlowRepository } from "../../../core/repositories/flow.repository";
import { GetFlowUseCase, GetFlowError } from "./get-flow";

describe("GetFlowUseCase", () => {
  const testApp = TestHarness.App;
  let testUserId: string;
  let testFlowId: string;
  let useCase: GetFlowUseCase;
  let flowRepository: FlowRepository;
  let flowStepRepository: FlowStepRepository;

  beforeAll(async () => {
    await testApp.setup();
  });

  beforeEach(async () => {
    await testApp.beforeEach();
    testUserId = await testApp.createTestUser({});
    useCase = testApp.module.get(GetFlowUseCase);
    flowRepository = testApp.module.get(FlowRepository);
    flowStepRepository = testApp.module.get(FlowStepRepository);

    // Create a test flow
    const flowResult = await flowRepository.create(
      { name: "Test Flow", description: "A test flow for validation" },
      testUserId,
    );
    assertSuccess(flowResult);
    testFlowId = flowResult.value[0].id;
  });

  afterEach(() => {
    testApp.afterEach();
  });

  afterAll(async () => {
    await testApp.teardown();
  });

  describe("execute", () => {
    it("should get flow with steps successfully", async () => {
      // Create test steps
      await flowStepRepository.create(testFlowId, {
        type: "INSTRUCTION",
        title: "Step 1",
        position: { x: 100, y: 100 },
        stepSpecification: {},
      });
      await flowStepRepository.create(testFlowId, {
        type: "QUESTION",
        title: "Step 2",
        position: { x: 200, y: 200 },
        stepSpecification: { required: true, answerType: "TEXT" },
      });

      const result = await useCase.execute(testFlowId);

      assertSuccess(result);
      expect(result.value).toMatchObject({
        id: testFlowId,
        name: "Test Flow",
        description: "A test flow for validation",
        createdBy: testUserId,
      });
      expect(result.value.steps).toHaveLength(2);
      expect(result.value.steps[0]).toMatchObject({
        type: "INSTRUCTION",
        title: "Step 1",
      });
      expect(result.value.steps[1]).toMatchObject({
        type: "QUESTION",
        title: "Step 2",
      });
    });

    it("should get flow without steps successfully", async () => {
      const result = await useCase.execute(testFlowId);

      assertSuccess(result);
      expect(result.value).toMatchObject({
        id: testFlowId,
        name: "Test Flow",
        description: "A test flow for validation",
        createdBy: testUserId,
      });
      expect(result.value.steps).toHaveLength(0);
    });

    it("should return error when flow does not exist", async () => {
      const nonExistentId = "123e4567-e89b-12d3-a456-426614174000";

      const result = await useCase.execute(nonExistentId);

      assertFailure(result);
      expect(result.error).toBeInstanceOf(GetFlowError);
      expect(result.error.message).toBe(`Flow with ID ${nonExistentId} not found`);
      expect(result.error.code).toBe("GET_FLOW_ERROR");
      expect(result.error.statusCode).toBe(404);
    });

    it("should handle flow repository returning null", async () => {
      jest.spyOn(flowRepository, "findOne").mockResolvedValueOnce(success(null));

      const result = await useCase.execute(testFlowId);

      assertFailure(result);
      expect(result.error).toBeInstanceOf(GetFlowError);
      expect(result.error.message).toBe(`Flow with ID ${testFlowId} not found`);
    });

    it("should handle flow repository failure", async () => {
      const repositoryError = new Error("Database connection failed");
      jest.spyOn(flowRepository, "findOne").mockResolvedValueOnce(failure(repositoryError));

      const result = await useCase.execute(testFlowId);

      assertFailure(result);
      expect(result.error).toBe(repositoryError);
    });

    it("should handle flow repository throwing an exception", async () => {
      const repositoryError = new Error("Unexpected database error");
      jest.spyOn(flowRepository, "findOne").mockRejectedValueOnce(repositoryError);

      await expect(useCase.execute(testFlowId)).rejects.toThrow(repositoryError);
    });

    it("should handle flow step repository failure", async () => {
      const repositoryError = new Error("Step repository failed");
      jest
        .spyOn(flowStepRepository, "findByFlowId")
        .mockResolvedValueOnce(failure(repositoryError));

      const result = await useCase.execute(testFlowId);

      assertFailure(result);
      expect(result.error).toBe(repositoryError);
    });

    it("should handle flow step repository throwing an exception", async () => {
      const repositoryError = new Error("Unexpected step repository error");
      jest.spyOn(flowStepRepository, "findByFlowId").mockRejectedValueOnce(repositoryError);

      await expect(useCase.execute(testFlowId)).rejects.toThrow(repositoryError);
    });

    it("should log flow retrieval start", async () => {
      const logSpy = jest.spyOn(useCase.logger, "log");

      await useCase.execute(testFlowId);

      expect(logSpy).toHaveBeenCalledWith(`Getting flow with ID ${testFlowId}`);
    });

    it("should log successful flow retrieval with step count", async () => {
      // Create test steps
      await flowStepRepository.create(testFlowId, {
        type: "INSTRUCTION",
        title: "Step 1",
        position: { x: 100, y: 100 },
        stepSpecification: {},
      });
      await flowStepRepository.create(testFlowId, {
        type: "QUESTION",
        title: "Step 2",
        position: { x: 200, y: 200 },
        stepSpecification: {},
      });

      const logSpy = jest.spyOn(useCase.logger, "log");

      const result = await useCase.execute(testFlowId);
      assertSuccess(result);

      expect(logSpy).toHaveBeenCalledWith(`Found flow "${result.value.name}" with 2 steps`);
    });

    it("should log warning when flow not found", async () => {
      const nonExistentId = "123e4567-e89b-12d3-a456-426614174000";
      const warnSpy = jest.spyOn(useCase.logger, "warn");

      const result = await useCase.execute(nonExistentId);
      assertFailure(result);

      expect(warnSpy).toHaveBeenCalledWith(`Flow with ID ${nonExistentId} not found`);
    });

    it("should handle chain method failure propagation", async () => {
      const chainError = new Error("Chain processing failed");

      // Mock repository to return success but simulate chain failure
      const mockResult = {
        chain: jest.fn().mockReturnValue(failure(chainError)),
      };
      jest.spyOn(flowRepository, "findOne").mockResolvedValueOnce(mockResult as any);

      const result = await useCase.execute(testFlowId);

      assertFailure(result);
      expect(result.error).toBe(chainError);
    });

    it("should handle invalid UUID format", async () => {
      const invalidId = "invalid-uuid-format";

      const result = await useCase.execute(invalidId);

      assertFailure(result);
    });

    it("should handle flow with many steps", async () => {
      // Create many steps to test performance
      const promises = Array.from({ length: 100 }, (_, i) =>
        flowStepRepository.create(testFlowId, {
          type: "INSTRUCTION",
          title: `Step ${i}`,
          position: { x: i * 10, y: 100 },
          stepSpecification: {},
        }),
      );
      await Promise.all(promises);

      const result = await useCase.execute(testFlowId);

      assertSuccess(result);
      expect(result.value.steps).toHaveLength(100);
    });

    it("should handle flow with complex step specifications", async () => {
      const complexSpec = {
        protocolId: "complex-protocol",
        settings: {
          temperature: 25,
          humidity: 60,
          duration: 300,
        },
        validations: [
          { field: "ph", min: 6.5, max: 7.5 },
          { field: "conductivity", min: 100, max: 500 },
        ],
        metadata: {
          calibrationDate: "2023-01-01",
          operator: "test-operator",
        },
      };

      await flowStepRepository.create(testFlowId, {
        type: "MEASUREMENT",
        title: "Complex Step",
        position: { x: 100, y: 100 },
        stepSpecification: complexSpec,
      });

      const result = await useCase.execute(testFlowId);

      assertSuccess(result);
      expect(result.value.steps).toHaveLength(1);
      expect(result.value.steps[0].stepSpecification).toEqual(complexSpec);
    });

    it("should handle concurrent flow retrieval", async () => {
      const [result1, result2, result3] = await Promise.all([
        useCase.execute(testFlowId),
        useCase.execute(testFlowId),
        useCase.execute(testFlowId),
      ]);

      assertSuccess(result1);
      assertSuccess(result2);
      assertSuccess(result3);

      // All results should be the same
      expect(result1.value.id).toBe(result2.value.id);
      expect(result2.value.id).toBe(result3.value.id);
    });

    it("should handle flow with special characters in name and description", async () => {
      // Create flow with special characters
      const specialFlow = await flowRepository.create(
        {
          name: "Flow with émojis 🚀 and spéciål chars",
          description: "Description with newlines\nand tabs\t and quotes'\"",
        },
        testUserId,
      );
      assertSuccess(specialFlow);
      const specialFlowId = specialFlow.value[0].id;

      const result = await useCase.execute(specialFlowId);

      assertSuccess(result);
      expect(result.value.name).toBe("Flow with émojis 🚀 and spéciål chars");
      expect(result.value.description).toBe("Description with newlines\nand tabs\t and quotes'\"");
    });

    it("should handle flow with null description", async () => {
      // Create flow with null description
      const nullDescFlow = await flowRepository.create(
        { name: "Flow with null description", description: null },
        testUserId,
      );
      assertSuccess(nullDescFlow);
      const nullDescFlowId = nullDescFlow.value[0].id;

      const result = await useCase.execute(nullDescFlowId);

      assertSuccess(result);
      expect(result.value.name).toBe("Flow with null description");
      expect(result.value.description).toBeNull();
    });

    it("should handle steps with media arrays", async () => {
      await flowStepRepository.create(testFlowId, {
        type: "INSTRUCTION",
        title: "Step with Media",
        position: { x: 100, y: 100 },
        media: [
          "https://example.com/image1.jpg",
          "https://example.com/video1.mp4",
          "https://example.com/audio1.mp3",
        ],
        stepSpecification: {},
      });

      const result = await useCase.execute(testFlowId);

      assertSuccess(result);
      expect(result.value.steps).toHaveLength(1);
      expect(result.value.steps[0].media).toEqual([
        "https://example.com/image1.jpg",
        "https://example.com/video1.mp4",
        "https://example.com/audio1.mp3",
      ]);
    });

    it("should handle steps with start and end node flags", async () => {
      await flowStepRepository.create(testFlowId, {
        type: "INSTRUCTION",
        title: "Start Step",
        position: { x: 100, y: 100 },
        isStartNode: true,
        isEndNode: false,
        stepSpecification: {},
      });

      await flowStepRepository.create(testFlowId, {
        type: "QUESTION",
        title: "End Step",
        position: { x: 200, y: 200 },
        isStartNode: false,
        isEndNode: true,
        stepSpecification: {},
      });

      const result = await useCase.execute(testFlowId);

      assertSuccess(result);
      expect(result.value.steps).toHaveLength(2);

      const startStep = result.value.steps.find((s) => s.title === "Start Step");
      const endStep = result.value.steps.find((s) => s.title === "End Step");

      expect(startStep?.isStartNode).toBe(true);
      expect(startStep?.isEndNode).toBe(false);
      expect(endStep?.isStartNode).toBe(false);
      expect(endStep?.isEndNode).toBe(true);
    });
  });

  describe("GetFlowError", () => {
    it("should create error with message and default properties", () => {
      const error = new GetFlowError("Test error message");

      expect(error.message).toBe("Test error message");
      expect(error.code).toBe("GET_FLOW_ERROR");
      expect(error.statusCode).toBe(404);
      expect(error.details).toEqual({});
    });

    it("should create error with message and cause", () => {
      const cause = new Error("Root cause");
      const error = new GetFlowError("Test error message", cause);

      expect(error.message).toBe("Test error message");
      expect(error.code).toBe("GET_FLOW_ERROR");
      expect(error.statusCode).toBe(404);
      expect(error.details).toEqual({ cause });
    });

    it("should create error with undefined cause", () => {
      const error = new GetFlowError("Test error message", undefined);

      expect(error.message).toBe("Test error message");
      expect(error.code).toBe("GET_FLOW_ERROR");
      expect(error.statusCode).toBe(404);
      expect(error.details).toEqual({ cause: undefined });
    });

    it("should create error with null cause", () => {
      const error = new GetFlowError("Test error message", null);

      expect(error.message).toBe("Test error message");
      expect(error.code).toBe("GET_FLOW_ERROR");
      expect(error.statusCode).toBe(404);
      expect(error.details).toEqual({ cause: null });
    });

    it("should create error with complex cause object", () => {
      const cause = {
        type: "DatabaseError",
        details: { table: "flows", operation: "select" },
      };
      const error = new GetFlowError("Database query failed", cause);

      expect(error.message).toBe("Database query failed");
      expect(error.code).toBe("GET_FLOW_ERROR");
      expect(error.statusCode).toBe(404);
      expect(error.details).toEqual({ cause });
    });
  });

  describe("edge cases and error scenarios", () => {
    it("should handle repository returning empty steps array", async () => {
      jest.spyOn(flowStepRepository, "findByFlowId").mockResolvedValueOnce(success([]));

      const result = await useCase.execute(testFlowId);

      assertSuccess(result);
      expect(result.value.steps).toHaveLength(0);
    });

    it("should handle repository returning null steps", async () => {
      jest.spyOn(flowStepRepository, "findByFlowId").mockResolvedValueOnce(success(null as any));

      const result = await useCase.execute(testFlowId);

      assertSuccess(result);
      expect(result.value.steps).toBeNull();
    });

    it("should handle repository returning undefined steps", async () => {
      jest
        .spyOn(flowStepRepository, "findByFlowId")
        .mockResolvedValueOnce(success(undefined as any));

      const result = await useCase.execute(testFlowId);

      assertSuccess(result);
      expect(result.value.steps).toBeUndefined();
    });

    it("should handle very long flow ID", async () => {
      const longId = "a".repeat(1000);

      const result = await useCase.execute(longId);

      assertFailure(result);
    });

    it("should handle empty string flow ID", async () => {
      const result = await useCase.execute("");

      assertFailure(result);
    });

    it("should handle flow with large version number", async () => {
      const maxVersionFlow = await flowRepository.create(
        { name: "Large Version Flow", version: 999999 },
        testUserId,
      );
      assertSuccess(maxVersionFlow);
      const maxVersionFlowId = maxVersionFlow.value[0].id;

      const result = await useCase.execute(maxVersionFlowId);

      assertSuccess(result);
      expect(result.value.version).toBe(999999);
    });

    it("should handle flow created by different user", async () => {
      const otherUserId = await testApp.createTestUser({});
      const otherUserFlow = await flowRepository.create({ name: "Other User Flow" }, otherUserId);
      assertSuccess(otherUserFlow);
      const otherUserFlowId = otherUserFlow.value[0].id;

      const result = await useCase.execute(otherUserFlowId);

      assertSuccess(result);
      expect(result.value.createdBy).toBe(otherUserId);
    });
  });

  describe("logging behavior", () => {
    it("should log flow retrieval attempt", async () => {
      const logSpy = jest.spyOn(useCase.logger, "log");

      await useCase.execute(testFlowId);

      // Verify log was called
      expect(logSpy).toHaveBeenCalledWith(`Getting flow with ID ${testFlowId}`);
    });

    it("should still log even when flow repository fails", async () => {
      const logSpy = jest.spyOn(useCase.logger, "log");
      jest.spyOn(flowRepository, "findOne").mockResolvedValueOnce(failure(new Error("Failed")));

      const result = await useCase.execute(testFlowId);

      assertFailure(result);
      expect(logSpy).toHaveBeenCalledWith(`Getting flow with ID ${testFlowId}`);
    });

    it("should log warning when flow not found", async () => {
      const warnSpy = jest.spyOn(useCase.logger, "warn");
      jest.spyOn(flowRepository, "findOne").mockResolvedValueOnce(success(null));

      const result = await useCase.execute(testFlowId);

      assertFailure(result);
      expect(warnSpy).toHaveBeenCalledWith(`Flow with ID ${testFlowId} not found`);
    });
  });
});
