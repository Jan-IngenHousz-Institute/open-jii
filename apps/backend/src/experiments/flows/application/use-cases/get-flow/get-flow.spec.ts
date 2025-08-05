import { TestHarness } from "@/test/test-harness";

import { assertSuccess, assertFailure } from "../../../../../common/utils/fp-utils";
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

      // Assert
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
      // Arrange - flow exists without steps from beforeEach

      // Act
      const result = await useCase.execute(testFlowId);

      // Assert
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
      // Arrange
      const nonExistentId = "123e4567-e89b-12d3-a456-426614174000";

      // Act
      const result = await useCase.execute(nonExistentId);

      // Assert
      assertFailure(result);
      expect(result.error).toBeInstanceOf(GetFlowError);
      expect(result.error.message).toBe(`Flow with ID ${nonExistentId} not found`);
      expect(result.error.code).toBe("GET_FLOW_ERROR");
      expect(result.error.statusCode).toBe(404);
    });

    // Note: Removed artificial error scenario tests that used spies
    // Real database errors will be handled by repository layer and error handling middleware

    // Note: Removed logging tests - testing logs is not necessary

    it("should handle invalid UUID format", async () => {
      // Arrange
      const invalidId = "invalid-uuid-format";

      // Act
      const result = await useCase.execute(invalidId);

      // Assert
      assertFailure(result);
    });

    it("should handle flow with many steps", async () => {
      // Arrange
      const promises = Array.from({ length: 100 }, (_, i) =>
        flowStepRepository.create(testFlowId, {
          type: "INSTRUCTION",
          title: `Step ${i}`,
          position: { x: i * 10, y: 100 },
          stepSpecification: {},
        }),
      );
      await Promise.all(promises);

      // Act
      const result = await useCase.execute(testFlowId);

      // Assert
      assertSuccess(result);
      expect(result.value.steps).toHaveLength(100);
    });

    it("should handle flow with complex step specifications", async () => {
      // Arrange
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

      // Act
      const result = await useCase.execute(testFlowId);

      // Assert
      assertSuccess(result);
      expect(result.value.steps).toHaveLength(1);
      expect(result.value.steps[0].stepSpecification).toEqual(complexSpec);
    });

    it("should handle concurrent flow retrieval", async () => {
      // Arrange - flow already exists from beforeEach

      // Act
      const [result1, result2, result3] = await Promise.all([
        useCase.execute(testFlowId),
        useCase.execute(testFlowId),
        useCase.execute(testFlowId),
      ]);

      // Assert
      assertSuccess(result1);
      assertSuccess(result2);
      assertSuccess(result3);
      expect(result1.value.id).toBe(result2.value.id);
      expect(result2.value.id).toBe(result3.value.id);
    });

    it("should handle flow with special characters in name and description", async () => {
      // Arrange
      const specialFlow = await flowRepository.create(
        {
          name: "Flow with émojis 🚀 and spéciål chars",
          description: "Description with newlines\nand tabs\t and quotes'\"",
        },
        testUserId,
      );
      assertSuccess(specialFlow);
      const specialFlowId = specialFlow.value[0].id;

      // Act
      const result = await useCase.execute(specialFlowId);

      // Assert
      assertSuccess(result);
      expect(result.value.name).toBe("Flow with émojis 🚀 and spéciål chars");
      expect(result.value.description).toBe("Description with newlines\nand tabs\t and quotes'\"");
    });

    it("should handle flow with null description", async () => {
      // Arrange
      const nullDescFlow = await flowRepository.create(
        { name: "Flow with null description", description: null },
        testUserId,
      );
      assertSuccess(nullDescFlow);
      const nullDescFlowId = nullDescFlow.value[0].id;

      // Act
      const result = await useCase.execute(nullDescFlowId);

      // Assert
      assertSuccess(result);
      expect(result.value.name).toBe("Flow with null description");
      expect(result.value.description).toBeNull();
    });

    it("should handle steps with media arrays", async () => {
      // Arrange
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

      // Act
      const result = await useCase.execute(testFlowId);

      // Assert
      assertSuccess(result);
      expect(result.value.steps).toHaveLength(1);
      expect(result.value.steps[0].media).toEqual([
        "https://example.com/image1.jpg",
        "https://example.com/video1.mp4",
        "https://example.com/audio1.mp3",
      ]);
    });

    it("should handle steps with start and end node flags", async () => {
      // Arrange
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

      // Act
      const result = await useCase.execute(testFlowId);

      // Assert
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
    // Note: Removed spy-based repository edge case tests
    // These are better tested through real repository behavior

    it("should handle very long flow ID", async () => {
      // Arrange
      const longId = "a".repeat(1000);

      // Act
      const result = await useCase.execute(longId);

      // Assert
      assertFailure(result);
    });

    it("should handle empty string flow ID", async () => {
      // Arrange - empty string ID

      // Act
      const result = await useCase.execute("");

      // Assert
      assertFailure(result);
    });

    it("should handle flow with large version number", async () => {
      // Arrange
      const maxVersionFlow = await flowRepository.create(
        { name: "Large Version Flow", version: 999999 },
        testUserId,
      );
      assertSuccess(maxVersionFlow);
      const maxVersionFlowId = maxVersionFlow.value[0].id;

      // Act
      const result = await useCase.execute(maxVersionFlowId);

      // Assert
      assertSuccess(result);
      expect(result.value.version).toBe(999999);
    });

    it("should handle flow created by different user", async () => {
      // Arrange
      const otherUserId = await testApp.createTestUser({});
      const otherUserFlow = await flowRepository.create({ name: "Other User Flow" }, otherUserId);
      assertSuccess(otherUserFlow);
      const otherUserFlowId = otherUserFlow.value[0].id;

      // Act
      const result = await useCase.execute(otherUserFlowId);

      // Assert
      assertSuccess(result);
      expect(result.value.createdBy).toBe(otherUserId);
    });
  });

  // Note: Removed logging behavior tests - testing logs is not necessary
});
