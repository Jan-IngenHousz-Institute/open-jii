import { TestHarness } from "@/test/test-harness";

import {
  assertSuccess,
  assertFailure,
  success,
  failure,
} from "../../../../../common/utils/fp-utils";
import { FlowStepRepository } from "../../../core/repositories/flow-step.repository";
import { FlowRepository } from "../../../core/repositories/flow.repository";
import { CreateFlowStepUseCase, CreateFlowStepError } from "./create-flow-step";

describe("CreateFlowStepUseCase", () => {
  const testApp = TestHarness.App;
  let testUserId: string;
  let testFlowId: string;
  let useCase: CreateFlowStepUseCase;
  let flowRepository: FlowRepository;
  let _flowStepRepository: FlowStepRepository;

  beforeAll(async () => {
    await testApp.setup();
  });

  beforeEach(async () => {
    await testApp.beforeEach();
    testUserId = await testApp.createTestUser({});
    useCase = testApp.module.get(CreateFlowStepUseCase);
    flowRepository = testApp.module.get(FlowRepository);
    _flowStepRepository = testApp.module.get(FlowStepRepository);

    // Create a test flow
    const flowResult = await flowRepository.create({ name: "Test Flow" }, testUserId);
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
    it("should create an instruction step successfully", async () => {
      // Arrange
      const stepData = {
        type: "INSTRUCTION" as const,
        title: "Welcome Step",
        description: "This is a welcome instruction",
        position: { x: 100, y: 100 },
        stepSpecification: {},
      };

      // Act
      const result = await useCase.execute(testFlowId, stepData);

      // Assert
      assertSuccess(result);
      expect(result.value).toMatchObject({
        flowId: testFlowId,
        type: "INSTRUCTION",
        title: "Welcome Step",
        description: "This is a welcome instruction",
        position: { x: 100, y: 100 },
      });
      expect(result.value.stepSpecification).toEqual({});
    });

    it("should create a question step successfully", async () => {
      // Arrange
      const stepData = {
        type: "QUESTION" as const,
        title: "User Question",
        position: { x: 200, y: 200 },
        stepSpecification: {
          required: true,
          answerType: "TEXT" as const,
          placeholder: "Enter your answer",
        },
      };

      // Act
      const result = await useCase.execute(testFlowId, stepData);

      // Assert
      assertSuccess(result);
      expect(result.value).toMatchObject({
        flowId: testFlowId,
        type: "QUESTION",
        title: "User Question",
        position: { x: 200, y: 200 },
      });
      expect(result.value.stepSpecification).toEqual(stepData.stepSpecification);
    });

    it("should create a measurement step successfully", async () => {
      // Arrange
      const stepData = {
        type: "MEASUREMENT" as const,
        title: "Take Measurement",
        position: { x: 300, y: 300 },
        stepSpecification: {
          protocolId: "test-protocol-id",
          autoStart: false,
          retryAttempts: 3,
        },
      };

      // Act
      const result = await useCase.execute(testFlowId, stepData);

      // Assert
      assertSuccess(result);
      expect(result.value).toMatchObject({
        flowId: testFlowId,
        type: "MEASUREMENT",
        title: "Take Measurement",
        position: { x: 300, y: 300 },
      });
      expect(result.value.stepSpecification).toEqual(stepData.stepSpecification);
    });

    it("should create an analysis step successfully", async () => {
      // Arrange
      const stepData = {
        type: "ANALYSIS" as const,
        title: "Analyze Results",
        position: { x: 400, y: 400 },
        stepSpecification: {
          macroId: "test-macro-id",
          autoRun: true,
        },
      };

      // Act
      const result = await useCase.execute(testFlowId, stepData);

      // Assert
      assertSuccess(result);
      expect(result.value).toMatchObject({
        flowId: testFlowId,
        type: "ANALYSIS",
        title: "Analyze Results",
        position: { x: 400, y: 400 },
      });
      expect(result.value.stepSpecification).toEqual(stepData.stepSpecification);
    });

    it("should create step with default position when position not provided", async () => {
      // Arrange
      // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
      const stepData = {
        type: "MEASUREMENT" as const,
        title: "New Step",
        stepSpecification: {
          protocolId: "test-protocol",
          autoStart: false,
          retryAttempts: 3,
        },
      } as any; // Allow missing position for this test

      // Act
      const result = await useCase.execute(testFlowId, stepData);

      // Assert
      assertSuccess(result);
      expect(result.value.position).toEqual({ x: 250, y: 100 }); // Should use default position
    });

    it("should fail when flow does not exist", async () => {
      // Arrange
      const stepData = {
        type: "INSTRUCTION" as const,
        position: { x: 100, y: 100 },
        stepSpecification: {},
      };
      const nonExistentFlowId = "123e4567-e89b-12d3-a456-426614174000";

      // Act
      const result = await useCase.execute(nonExistentFlowId, stepData);

      // Assert
      assertFailure(result);
      expect(result.error.message).toBe(`Flow with ID ${nonExistentFlowId} not found`);
    });

    it("should succeed when no step configuration is provided", async () => {
      // Arrange
      const stepData = {
        type: "INSTRUCTION" as const,
        position: { x: 100, y: 100 },
      };

      // Act
      const result = await useCase.execute(testFlowId, stepData);

      // Assert
      assertSuccess(result);
      expect(result.value.type).toBe("INSTRUCTION");
    });

    it("should succeed with valid step specification", async () => {
      const stepData = {
        type: "INSTRUCTION" as const,
        position: { x: 100, y: 100 },
        stepSpecification: {},
      };

      const result = await useCase.execute(testFlowId, stepData);

      assertSuccess(result);
      expect(result.value.stepSpecification).toEqual({});
    });

    describe("CreateFlowStepError", () => {
      it("should create error with message and default properties", () => {
        const error = new CreateFlowStepError("Test error message");

        expect(error.message).toBe("Test error message");
        expect(error.code).toBe("CREATE_FLOW_STEP_ERROR");
        expect(error.statusCode).toBe(400);
        expect(error.details).toEqual({});
      });

      it("should create error with message and cause", () => {
        const cause = new Error("Root cause");
        const error = new CreateFlowStepError("Test error message", cause);

        expect(error.message).toBe("Test error message");
        expect(error.code).toBe("CREATE_FLOW_STEP_ERROR");
        expect(error.statusCode).toBe(400);
        expect(error.details).toEqual({ cause });
      });

      it("should create error with undefined cause", () => {
        const error = new CreateFlowStepError("Test error message", undefined);

        expect(error.message).toBe("Test error message");
        expect(error.code).toBe("CREATE_FLOW_STEP_ERROR");
        expect(error.statusCode).toBe(400);
        expect(error.details).toEqual({ cause: undefined });
      });

      it("should create error with null cause", () => {
        const error = new CreateFlowStepError("Test error message", null);

        expect(error.message).toBe("Test error message");
        expect(error.code).toBe("CREATE_FLOW_STEP_ERROR");
        expect(error.statusCode).toBe(400);
        expect(error.details).toEqual({ cause: null });
      });

      it("should create error with complex cause object", () => {
        const cause = {
          type: "DatabaseError",
          details: { table: "flow_steps", constraint: "unique_position" },
        };
        const error = new CreateFlowStepError("Database constraint violation", cause);

        expect(error.message).toBe("Database constraint violation");
        expect(error.code).toBe("CREATE_FLOW_STEP_ERROR");
        expect(error.statusCode).toBe(400);
        expect(error.details).toEqual({ cause });
      });
    });

    describe("edge cases and error scenarios", () => {
      // Note: Removed spy-based edge case tests
      // Real error handling is better tested through integration and repository tests

      it("should handle very long step titles", async () => {
        const stepData = {
          type: "INSTRUCTION" as const,
          title: "x".repeat(1000), // Very long title
          description: "Step with extremely long title",
          position: { x: 100, y: 100 },
          stepSpecification: {},
        };

        const result = await useCase.execute(testFlowId, stepData);

        // Should either succeed or fail gracefully depending on database constraints
        if (result.isSuccess()) {
          expect(result.value.title).toBe(stepData.title);
        } else {
          expect(result.error).toBeInstanceOf(Error);
        }
      });

      it("should handle special characters in step data", async () => {
        const stepData = {
          type: "INSTRUCTION" as const,
          title: "Test Step with émojis 🚀 and spéciål chars",
          description: "Description with newlines\nand tabs\t and quotes'\"",
          position: { x: 100, y: 100 },
          stepSpecification: {},
        };

        const result = await useCase.execute(testFlowId, stepData);

        assertSuccess(result);
        expect(result.value.title).toBe(stepData.title);
        expect(result.value.description).toBe(stepData.description);
      });

      it("should handle concurrent step creation", async () => {
        const stepData1 = {
          type: "INSTRUCTION" as const,
          title: "Concurrent Step 1",
          position: { x: 100, y: 100 },
          stepSpecification: {},
        };
        const stepData2 = {
          type: "QUESTION" as const,
          title: "Concurrent Step 2",
          position: { x: 200, y: 200 },
          stepSpecification: {},
        };

        const [result1, result2] = await Promise.all([
          useCase.execute(testFlowId, stepData1),
          useCase.execute(testFlowId, stepData2),
        ]);

        assertSuccess(result1);
        assertSuccess(result2);
        expect(result1.value.id).not.toBe(result2.value.id);
      });

      it("should handle invalid flow ID format", async () => {
        const stepData = {
          type: "INSTRUCTION" as const,
          title: "Test Step",
          position: { x: 100, y: 100 },
          stepSpecification: {},
        };

        const invalidFlowId = "invalid-uuid-format";

        const result = await useCase.execute(invalidFlowId, stepData);

        assertFailure(result);
      });

      it("should handle step with complex nested stepSpecification", async () => {
        const complexSpec = {
          protocolId: "complex-protocol",
          settings: {
            advanced: {
              calibration: {
                temperature: 25,
                humidity: 60,
                pressure: 1013.25,
              },
              filters: ["lowpass", "highpass"],
              algorithms: {
                preprocessing: "normalize",
                analysis: "fft",
              },
            },
          },
          validations: [
            { field: "ph", range: { min: 6.5, max: 7.5 } },
            { field: "conductivity", range: { min: 100, max: 500 } },
          ],
          metadata: {
            version: "2.1.0",
            author: "system",
            created: "2023-01-01T00:00:00.000Z",
          },
        };

        const stepData = {
          type: "MEASUREMENT" as const,
          title: "Complex Measurement Step",
          description: "Step with complex nested specification",
          position: { x: 100, y: 100 },
          stepSpecification: complexSpec,
        };

        const result = await useCase.execute(testFlowId, stepData);

        assertSuccess(result);
        expect(result.value.stepSpecification).toEqual(complexSpec);
      });

      it("should handle step with media array", async () => {
        const stepData = {
          type: "INSTRUCTION" as const,
          title: "Step with Media",
          description: "Step that includes media files",
          position: { x: 100, y: 100 },
          media: [
            "https://example.com/image1.jpg",
            "https://example.com/video1.mp4",
            "https://example.com/audio1.mp3",
          ],
          stepSpecification: {},
        };

        const result = await useCase.execute(testFlowId, stepData);

        assertSuccess(result);
        expect(result.value.media).toEqual(stepData.media);
      });

      it("should handle step with boundary position values", async () => {
        const stepData = {
          type: "INSTRUCTION" as const,
          title: "Boundary Position Step",
          position: { x: -1000, y: 10000 }, // Extreme position values
          stepSpecification: {},
        };

        const result = await useCase.execute(testFlowId, stepData);

        assertSuccess(result);
        expect(result.value.position).toEqual(stepData.position);
      });

      it("should handle step with start and end node flags", async () => {
        const stepData = {
          type: "INSTRUCTION" as const,
          title: "Node Flag Step",
          position: { x: 100, y: 100 },
          isStartNode: true,
          isEndNode: false,
          stepSpecification: {},
        };

        const result = await useCase.execute(testFlowId, stepData);

        assertSuccess(result);
        expect(result.value.isStartNode).toBe(true);
        expect(result.value.isEndNode).toBe(false);
      });
    });
  });
});
