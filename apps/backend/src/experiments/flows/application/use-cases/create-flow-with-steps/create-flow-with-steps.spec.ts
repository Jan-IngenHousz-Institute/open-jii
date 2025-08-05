import { assertFailure, assertSuccess } from "../../../../../common/utils/fp-utils";
import { TestHarness } from "../../../../../test/test-harness";
import type { CreateFlowWithStepsDto } from "../../../core/models/flow.model";
import { CreateFlowWithStepsUseCase } from "./create-flow-with-steps";

describe("CreateFlowWithStepsUseCase", () => {
  const testApp = TestHarness.App;
  let testUserId: string;
  let useCase: CreateFlowWithStepsUseCase;

  beforeAll(async () => {
    await testApp.setup();
  });

  beforeEach(async () => {
    await testApp.beforeEach();
    testUserId = await testApp.createTestUser({});
    useCase = testApp.module.get(CreateFlowWithStepsUseCase);
  });

  afterEach(() => {
    testApp.afterEach();
  });

  afterAll(async () => {
    await testApp.teardown();
  });

  describe("execute", () => {
    it("should successfully create flow with steps and connections", async () => {
      // Arrange
      const createFlowWithStepsDto: CreateFlowWithStepsDto = {
        name: "Test Flow",
        description: "A test flow with steps",
        version: 1,
        isActive: true,
        steps: [
          {
            type: "INSTRUCTION",
            title: "Step 1",
            description: "First step",
            position: { x: 100, y: 100 },
            isStartNode: true,
            isEndNode: false,
            stepSpecification: {},
          },
          {
            type: "QUESTION",
            title: "Step 2",
            description: "Second step",
            position: { x: 200, y: 200 },
            isStartNode: false,
            isEndNode: true,
            stepSpecification: {
              required: true,
              answerType: "TEXT",
            },
          },
        ],
        connections: [
          {
            sourceStepId: "temp-step-1", // Will be mapped to actual step IDs
            targetStepId: "temp-step-2",
            type: "default",
            animated: false,
            priority: 0,
          },
        ],
      };

      // Act
      const result = await useCase.execute(createFlowWithStepsDto, testUserId);

      // Assert
      expect(result.isSuccess()).toBe(true);
      assertSuccess(result);
      const flow = result.value;

      expect(flow.name).toBe("Test Flow");
      expect(flow.description).toBe("A test flow with steps");
      expect(flow.version).toBe(1);
      expect(flow.isActive).toBe(true);
      expect(flow.createdBy).toBe(testUserId);
      expect(flow.steps).toHaveLength(2);
      expect(flow.connections).toHaveLength(1);

      // Verify steps were created correctly
      const step1 = flow.steps.find((s) => s.title === "Step 1");
      const step2 = flow.steps.find((s) => s.title === "Step 2");

      expect(step1).toMatchObject({
        type: "INSTRUCTION",
        title: "Step 1",
        description: "First step",
        position: { x: 100, y: 100 },
        isStartNode: true,
        isEndNode: false,
      });

      expect(step2).toMatchObject({
        type: "QUESTION",
        title: "Step 2",
        description: "Second step",
        position: { x: 200, y: 200 },
        isStartNode: false,
        isEndNode: true,
      });

      // Verify connection was created
      const connection = flow.connections[0];
      expect(connection.sourceStepId).toBe(step1?.id);
      expect(connection.targetStepId).toBe(step2?.id);
      expect(connection.type).toBe("default");
    });

    it("should return failure when user does not exist", async () => {
      // Arrange
      const createFlowWithStepsDto: CreateFlowWithStepsDto = {
        name: "Test Flow",
        description: "A test flow",
        steps: [],
      };

      const invalidUserId = "00000000-0000-0000-0000-000000000000";

      // Act
      const result = await useCase.execute(createFlowWithStepsDto, invalidUserId);

      // Assert
      expect(result.isFailure()).toBe(true);
      assertFailure(result);
    });

    it("should handle flow creation without connections", async () => {
      // Arrange
      const createFlowWithStepsDto: CreateFlowWithStepsDto = {
        name: "Simple Flow",
        description: "A flow without connections",
        steps: [
          {
            type: "INSTRUCTION",
            title: "Only Step",
            position: { x: 100, y: 100 },
            isStartNode: true,
            isEndNode: true,
            stepSpecification: {},
          },
        ],
      };

      // Act
      const result = await useCase.execute(createFlowWithStepsDto, testUserId);

      // Assert
      expect(result.isSuccess()).toBe(true);
      assertSuccess(result);
      const flow = result.value;

      expect(flow.name).toBe("Simple Flow");
      expect(flow.description).toBe("A flow without connections");
      expect(flow.steps).toHaveLength(1);
      expect(flow.connections).toHaveLength(0);

      const step = flow.steps[0];
      expect(step).toMatchObject({
        type: "INSTRUCTION",
        title: "Only Step",
        position: { x: 100, y: 100 },
        isStartNode: true,
        isEndNode: true,
      });
    });

    it("should handle different step types correctly", async () => {
      // Arrange
      const createFlowWithStepsDto: CreateFlowWithStepsDto = {
        name: "Multi-Step Flow",
        steps: [
          {
            type: "INSTRUCTION",
            title: "Instruction Step",
            position: { x: 0, y: 0 },
            stepSpecification: {},
          },
          {
            type: "QUESTION",
            title: "Question Step",
            position: { x: 100, y: 0 },
            stepSpecification: {
              required: true,
              answerType: "TEXT",
            },
          },
          {
            type: "MEASUREMENT",
            title: "Measurement Step",
            position: { x: 200, y: 0 },
            stepSpecification: {
              protocolId: "proto-123",
              autoStart: true,
            },
          },
          {
            type: "ANALYSIS",
            title: "Analysis Step",
            position: { x: 300, y: 0 },
            stepSpecification: {
              macroId: "macro-456",
              autoRun: false,
            },
          },
        ],
      };

      // Act
      const result = await useCase.execute(createFlowWithStepsDto, testUserId);

      // Assert
      expect(result.isSuccess()).toBe(true);
      assertSuccess(result);
      const flow = result.value;

      expect(flow.name).toBe("Multi-Step Flow");
      expect(flow.steps).toHaveLength(4);
      expect(flow.connections).toHaveLength(0);

      const instructionStep = flow.steps.find((s) => s.type === "INSTRUCTION");
      const questionStep = flow.steps.find((s) => s.type === "QUESTION");
      const measurementStep = flow.steps.find((s) => s.type === "MEASUREMENT");
      const analysisStep = flow.steps.find((s) => s.type === "ANALYSIS");

      expect(instructionStep?.title).toBe("Instruction Step");
      expect(questionStep?.title).toBe("Question Step");
      expect(measurementStep?.title).toBe("Measurement Step");
      expect(analysisStep?.title).toBe("Analysis Step");

      // Verify step specifications
      expect(questionStep?.stepSpecification).toEqual({
        required: true,
        answerType: "TEXT",
      });
      expect(measurementStep?.stepSpecification).toEqual({
        protocolId: "proto-123",
        autoStart: true,
      });
      expect(analysisStep?.stepSpecification).toEqual({
        macroId: "macro-456",
        autoRun: false,
      });
    });

    it("should handle minimal flow creation", async () => {
      // Arrange
      const createFlowWithStepsDto: CreateFlowWithStepsDto = {
        name: "Minimal Flow",
        steps: [
          {
            type: "INSTRUCTION",
            position: { x: 0, y: 0 },
          },
        ],
      };

      // Act
      const result = await useCase.execute(createFlowWithStepsDto, testUserId);

      // Assert
      expect(result.isSuccess()).toBe(true);
      assertSuccess(result);
      const flow = result.value;

      expect(flow.name).toBe("Minimal Flow");
      expect(flow.description).toBeNull();
      expect(flow.version).toBe(1);
      expect(flow.isActive).toBe(true);
      expect(flow.steps).toHaveLength(1);

      const step = flow.steps[0];
      expect(step.type).toBe("INSTRUCTION");
      expect(step.title).toBeNull();
      expect(step.position).toEqual({ x: 0, y: 0 });
    });

    it("should handle flow with complex connections", async () => {
      // Arrange
      const createFlowWithStepsDto: CreateFlowWithStepsDto = {
        name: "Flow with Complex Connections",
        steps: [
          {
            type: "INSTRUCTION",
            title: "Start",
            position: { x: 100, y: 100 },
            stepSpecification: {},
          },
          {
            type: "QUESTION",
            title: "Question",
            position: { x: 200, y: 200 },
            stepSpecification: {
              required: true,
              answerType: "TEXT",
            },
          },
          {
            type: "MEASUREMENT",
            title: "Measurement",
            position: { x: 300, y: 300 },
            stepSpecification: {},
          },
        ],
        connections: [
          {
            sourceStepId: "temp-step-1",
            targetStepId: "temp-step-2",
            type: "default",
            label: "Next",
            priority: 1,
          },
          {
            sourceStepId: "temp-step-2",
            targetStepId: "temp-step-3",
            type: "conditional",
            label: "If answered",
            animated: true,
            priority: 2,
          },
        ],
      };

      // Act
      const result = await useCase.execute(createFlowWithStepsDto, testUserId);

      // Assert
      expect(result.isSuccess()).toBe(true);
      assertSuccess(result);
      const flow = result.value;

      expect(flow.steps).toHaveLength(3);
      expect(flow.connections).toHaveLength(2);

      const connection1 = flow.connections.find((c) => c.label === "Next");
      const connection2 = flow.connections.find((c) => c.label === "If answered");

      expect(connection1).toMatchObject({
        type: "default",
        label: "Next",
        priority: 1,
        animated: false,
      });

      expect(connection2).toMatchObject({
        type: "conditional",
        label: "If answered",
        animated: true,
        priority: 2,
      });
    });
  });
});
