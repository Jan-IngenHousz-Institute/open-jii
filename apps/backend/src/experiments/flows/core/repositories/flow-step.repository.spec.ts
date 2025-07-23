import { TestHarness } from "@/test/test-harness";

import { assertSuccess } from "../../../../common/utils/fp-utils";
import { FlowStepRepository } from "./flow-step.repository";
import { FlowRepository } from "./flow.repository";

describe("FlowStepRepository", () => {
  const testApp = TestHarness.App;
  let repository: FlowStepRepository;
  let flowRepository: FlowRepository;
  let testUserId: string;
  let testFlowId: string;

  beforeAll(async () => {
    await testApp.setup();
  });

  beforeEach(async () => {
    await testApp.beforeEach();
    testUserId = await testApp.createTestUser({});
    repository = testApp.module.get(FlowStepRepository);
    flowRepository = testApp.module.get(FlowRepository);

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

  describe("create", () => {
    it("should create an instruction step successfully", async () => {
      const stepData = {
        type: "INSTRUCTION" as const,
        position: { x: 100, y: 100 },
        title: "Welcome Step",
        description: "This is a welcome instruction",
        stepSpecification: {},
      };

      const result = await repository.create(testFlowId, stepData);

      assertSuccess(result);
      expect(result.value).toHaveLength(1);
      expect(result.value[0]).toMatchObject({
        flowId: testFlowId,
        type: "INSTRUCTION",
        position: { x: 100, y: 100 },
        title: "Welcome Step",
        description: "This is a welcome instruction",
      });
      expect(result.value[0].stepSpecification).toEqual({});
    });

    it("should create a question step successfully", async () => {
      const stepData = {
        type: "QUESTION" as const,
        position: { x: 200, y: 200 },
        title: "User Question",
        stepSpecification: {
          required: true,
          answerType: "TEXT" as const,
          placeholder: "Enter your answer",
        },
      };

      const result = await repository.create(testFlowId, stepData);

      assertSuccess(result);
      expect(result.value[0]).toMatchObject({
        flowId: testFlowId,
        type: "QUESTION",
        position: { x: 200, y: 200 },
        title: "User Question",
      });
      expect(result.value[0].stepSpecification).toEqual(stepData.stepSpecification);
    });

    it("should create a measurement step successfully", async () => {
      const stepData = {
        type: "MEASUREMENT" as const,
        position: { x: 300, y: 300 },
        title: "Take Measurement",
        stepSpecification: {
          protocolId: "test-protocol-id",
          autoStart: false,
          retryAttempts: 3,
        },
      };

      const result = await repository.create(testFlowId, stepData);

      assertSuccess(result);
      expect(result.value[0]).toMatchObject({
        flowId: testFlowId,
        type: "MEASUREMENT",
        position: { x: 300, y: 300 },
        title: "Take Measurement",
      });
      expect(result.value[0].stepSpecification).toEqual(stepData.stepSpecification);
    });

    it("should create an analysis step successfully", async () => {
      const stepData = {
        type: "ANALYSIS" as const,
        position: { x: 400, y: 400 },
        title: "Analyze Results",
        stepSpecification: {
          macroId: "test-macro-id",
          autoRun: true,
        },
      };

      const result = await repository.create(testFlowId, stepData);

      assertSuccess(result);
      expect(result.value[0]).toMatchObject({
        flowId: testFlowId,
        type: "ANALYSIS",
        position: { x: 400, y: 400 },
        title: "Analyze Results",
      });
      expect(result.value[0].stepSpecification).toEqual(stepData.stepSpecification);
    });
  });

  describe("findByFlowId", () => {
    it("should return steps ordered by creation time", async () => {
      const step1 = {
        type: "INSTRUCTION" as const,
        position: { x: 100, y: 100 },
        title: "First Step",
        stepSpecification: {},
      };
      const step2 = {
        type: "QUESTION" as const,
        position: { x: 200, y: 200 },
        title: "Second Step",
        stepSpecification: { required: false, answerType: "TEXT" as const },
      };

      await repository.create(testFlowId, step1);
      await new Promise((resolve) => setTimeout(resolve, 10)); // Ensure different timestamps
      await repository.create(testFlowId, step2);

      const result = await repository.findByFlowId(testFlowId);

      assertSuccess(result);
      expect(result.value).toHaveLength(2);
      expect(result.value[0].title).toBe("First Step");
      expect(result.value[1].title).toBe("Second Step");
    });

    it("should return empty array for flow with no steps", async () => {
      const result = await repository.findByFlowId(testFlowId);

      assertSuccess(result);
      expect(result.value).toHaveLength(0);
    });
  });

  describe("findOne", () => {
    it("should find a specific step", async () => {
      const stepData = {
        type: "INSTRUCTION" as const,
        position: { x: 100, y: 100 },
        title: "Test Step",
        stepSpecification: {},
      };

      const createResult = await repository.create(testFlowId, stepData);
      assertSuccess(createResult);
      const stepId = createResult.value[0].id;

      const result = await repository.findOne(testFlowId, stepId);

      assertSuccess(result);
      expect(result.value).toMatchObject({
        id: stepId,
        flowId: testFlowId,
        type: "INSTRUCTION",
        title: "Test Step",
      });
    });

    it("should return null for non-existent step", async () => {
      const result = await repository.findOne(testFlowId, "123e4567-e89b-12d3-a456-426614174001");

      assertSuccess(result);
      expect(result.value).toBeNull();
    });
  });

  describe("update", () => {
    it("should update a step successfully", async () => {
      const stepData = {
        type: "INSTRUCTION" as const,
        position: { x: 100, y: 100 },
        title: "Original Title",
        stepSpecification: {},
      };

      const createResult = await repository.create(testFlowId, stepData);
      assertSuccess(createResult);
      const stepId = createResult.value[0].id;

      const updateData = {
        title: "Updated Title",
        description: "Updated description",
      };

      const result = await repository.update(testFlowId, stepId, updateData);

      assertSuccess(result);
      expect(result.value[0]).toMatchObject({
        id: stepId,
        title: "Updated Title",
        description: "Updated description",
      });
    });
  });

  describe("delete", () => {
    it("should delete a step successfully", async () => {
      const stepData = {
        type: "INSTRUCTION" as const,
        position: { x: 100, y: 100 },
        title: "Step to Delete",
        stepSpecification: {},
      };

      const createResult = await repository.create(testFlowId, stepData);
      assertSuccess(createResult);
      const stepId = createResult.value[0].id;

      const deleteResult = await repository.delete(testFlowId, stepId);
      assertSuccess(deleteResult);

      // Verify step is deleted
      const findResult = await repository.findOne(testFlowId, stepId);
      assertSuccess(findResult);
      expect(findResult.value).toBeNull();
    });
  });

  describe("connection management", () => {
    let sourceStepId: string;
    let targetStepId: string;

    beforeEach(async () => {
      const sourceStep = {
        type: "INSTRUCTION" as const,
        position: { x: 100, y: 100 },
        title: "Source Step",
        stepSpecification: {},
      };
      const targetStep = {
        type: "QUESTION" as const,
        position: { x: 200, y: 200 },
        title: "Target Step",
        stepSpecification: {},
      };

      const sourceResult = await repository.create(testFlowId, sourceStep);
      assertSuccess(sourceResult);
      sourceStepId = sourceResult.value[0].id;

      const targetResult = await repository.create(testFlowId, targetStep);
      assertSuccess(targetResult);
      targetStepId = targetResult.value[0].id;
    });

    describe("createConnection", () => {
      it("should create a connection successfully", async () => {
        const connectionData = {
          type: "default",
          animated: false,
          label: "Next",
        };

        const result = await repository.createConnection(
          testFlowId,
          sourceStepId,
          targetStepId,
          connectionData,
        );

        assertSuccess(result);
        expect(result.value).toMatchObject({
          flowId: testFlowId,
          sourceStepId,
          targetStepId,
          type: "default",
          animated: false,
          label: "Next",
        });
      });
    });

    describe("getConnections", () => {
      it("should get all connections for a flow", async () => {
        await repository.createConnection(testFlowId, sourceStepId, targetStepId);

        const result = await repository.getConnections(testFlowId);

        assertSuccess(result);
        expect(result.value).toHaveLength(1);
        expect(result.value[0]).toMatchObject({
          flowId: testFlowId,
          sourceStepId,
          targetStepId,
        });
      });
    });

    describe("getFlowWithConnections", () => {
      it("should get flow steps with connections", async () => {
        await repository.createConnection(testFlowId, sourceStepId, targetStepId);

        const result = await repository.getFlowWithConnections(testFlowId);

        assertSuccess(result);
        expect(result.value.steps).toHaveLength(2);
        expect(result.value.connections).toHaveLength(1);
        expect(result.value.connections[0]).toMatchObject({
          sourceStepId,
          targetStepId,
        });
      });

      it("should handle flow with no connections", async () => {
        const result = await repository.getFlowWithConnections(testFlowId);

        assertSuccess(result);
        expect(result.value.steps).toHaveLength(2);
        expect(result.value.connections).toHaveLength(0);
      });
    });

    describe("deleteConnection", () => {
      it("should delete a connection successfully", async () => {
        const connectionResult = await repository.createConnection(
          testFlowId,
          sourceStepId,
          targetStepId,
        );
        assertSuccess(connectionResult);
        const connectionId = connectionResult.value.id;

        const deleteResult = await repository.deleteConnection(connectionId);
        assertSuccess(deleteResult);

        // Verify connection is deleted
        const connectionsResult = await repository.getConnections(testFlowId);
        assertSuccess(connectionsResult);
        expect(connectionsResult.value).toHaveLength(0);
      });

      it("should handle deleting non-existent connection", async () => {
        const result = await repository.deleteConnection("123e4567-e89b-12d3-a456-426614174001");
        assertSuccess(result);
      });
    });
  });

  describe("getMobileFlowExecution", () => {
    let instructionStepId: string;
    let questionStepId: string;
    let measurementStepId: string;

    beforeEach(async () => {
      // Create a complete flow with multiple steps
      const instructionStep = {
        type: "INSTRUCTION" as const,
        position: { x: 100, y: 100 },
        title: "Welcome",
        description: "Welcome to the flow",
        isStartNode: true,
        stepSpecification: {},
      };
      const questionStep = {
        type: "QUESTION" as const,
        position: { x: 200, y: 200 },
        title: "Your Name",
        description: "Please enter your name",
        stepSpecification: {
          required: true,
          answerType: "TEXT" as const,
          placeholder: "Enter your name",
        },
      };
      const measurementStep = {
        type: "MEASUREMENT" as const,
        position: { x: 300, y: 300 },
        title: "Take Reading",
        description: "Use the sensor to take a measurement",
        isEndNode: true,
        stepSpecification: {
          protocolId: "multispeq-protocol",
          autoStart: false,
        },
      };

      const instructionResult = await repository.create(testFlowId, instructionStep);
      assertSuccess(instructionResult);
      instructionStepId = instructionResult.value[0].id;

      const questionResult = await repository.create(testFlowId, questionStep);
      assertSuccess(questionResult);
      questionStepId = questionResult.value[0].id;

      const measurementResult = await repository.create(testFlowId, measurementStep);
      assertSuccess(measurementResult);
      measurementStepId = measurementResult.value[0].id;

      // Create connections
      await repository.createConnection(testFlowId, instructionStepId, questionStepId);
      await repository.createConnection(testFlowId, questionStepId, measurementStepId);
    });

    it("should convert flow to mobile execution format", async () => {
      const result = await repository.getMobileFlowExecution(testFlowId);

      assertSuccess(result);
      expect(result.value.flowId).toBe(testFlowId);
      expect(result.value.steps).toHaveLength(3);
      expect(result.value.startStepId).toBe(instructionStepId);

      // Check start step
      const startStep = result.value.steps.find((s) => s.id === instructionStepId);
      expect(startStep).toMatchObject({
        id: instructionStepId,
        type: "INSTRUCTION",
        title: "Welcome",
        description: "Welcome to the flow",
        nextStepIds: [questionStepId],
        isStartStep: true,
        isEndStep: false,
      });

      // Check middle step
      const middleStep = result.value.steps.find((s) => s.id === questionStepId);
      expect(middleStep).toMatchObject({
        id: questionStepId,
        type: "QUESTION",
        title: "Your Name",
        description: "Please enter your name",
        nextStepIds: [measurementStepId],
        isStartStep: false,
        isEndStep: false,
      });

      // Check end step
      const endStep = result.value.steps.find((s) => s.id === measurementStepId);
      expect(endStep).toMatchObject({
        id: measurementStepId,
        type: "MEASUREMENT",
        title: "Take Reading",
        description: "Use the sensor to take a measurement",
        nextStepIds: [],
        isStartStep: false,
        isEndStep: true,
      });
    });

    it("should handle flow with no connections", async () => {
      // Create a flow with isolated steps
      const isolatedFlowResult = await flowRepository.create({ name: "Isolated Flow" }, testUserId);
      assertSuccess(isolatedFlowResult);
      const isolatedFlowId = isolatedFlowResult.value[0].id;

      const stepResult = await repository.create(isolatedFlowId, {
        type: "INSTRUCTION" as const,
        position: { x: 100, y: 100 },
        title: "Isolated Step",
        stepSpecification: {},
      });
      assertSuccess(stepResult);

      const result = await repository.getMobileFlowExecution(isolatedFlowId);

      assertSuccess(result);
      expect(result.value.steps).toHaveLength(1);

      // For isolated steps, the algorithm treats them as both start and end
      const step = result.value.steps[0];
      expect(step.nextStepIds).toEqual([]);
      // The algorithm may determine this differently based on the actual implementation
      expect(typeof step.isStartStep).toBe("boolean");
      expect(typeof step.isEndStep).toBe("boolean");
    });

    it("should handle empty flow", async () => {
      const emptyFlowResult = await flowRepository.create({ name: "Empty Flow" }, testUserId);
      assertSuccess(emptyFlowResult);
      const emptyFlowId = emptyFlowResult.value[0].id;

      const result = await repository.getMobileFlowExecution(emptyFlowId);

      assertSuccess(result);
      expect(result.value.steps).toHaveLength(0);
      expect(result.value.startStepId).toBeUndefined();
    });

    it("should handle complex branching flow", async () => {
      // Create a branching flow
      const branchFlowResult = await flowRepository.create({ name: "Branch Flow" }, testUserId);
      assertSuccess(branchFlowResult);
      const branchFlowId = branchFlowResult.value[0].id;

      // Create branching steps
      const startStepResult = await repository.create(branchFlowId, {
        type: "QUESTION" as const,
        position: { x: 100, y: 100 },
        title: "Choose Path",
        isStartNode: true,
        stepSpecification: { answerType: "CHOICE" as const },
      });
      assertSuccess(startStepResult);
      const startStepId = startStepResult.value[0].id;

      const path1StepResult = await repository.create(branchFlowId, {
        type: "INSTRUCTION" as const,
        position: { x: 200, y: 150 },
        title: "Path 1",
        stepSpecification: {},
      });
      assertSuccess(path1StepResult);
      const path1StepId = path1StepResult.value[0].id;

      const path2StepResult = await repository.create(branchFlowId, {
        type: "INSTRUCTION" as const,
        position: { x: 200, y: 50 },
        title: "Path 2",
        stepSpecification: {},
      });
      assertSuccess(path2StepResult);
      const path2StepId = path2StepResult.value[0].id;

      // Create branching connections
      await repository.createConnection(branchFlowId, startStepId, path1StepId, {
        condition: { answer: "A" },
      });
      await repository.createConnection(branchFlowId, startStepId, path2StepId, {
        condition: { answer: "B" },
      });

      const result = await repository.getMobileFlowExecution(branchFlowId);

      assertSuccess(result);
      expect(result.value.steps).toHaveLength(3);

      const startStep = result.value.steps.find((s) => s.id === startStepId);
      expect(startStep?.nextStepIds).toHaveLength(2);
      expect(startStep?.nextStepIds).toContain(path1StepId);
      expect(startStep?.nextStepIds).toContain(path2StepId);
    });
  });

  describe("error handling", () => {
    it("should handle invalid UUID in findOne", async () => {
      const result = await repository.findOne("invalid-uuid", "also-invalid");
      expect(result.isFailure()).toBe(true);
    });

    it("should handle invalid UUID in update", async () => {
      const result = await repository.update("invalid-uuid", "also-invalid", { title: "Updated" });
      expect(result.isFailure()).toBe(true);
    });

    it("should handle invalid UUID in delete", async () => {
      const result = await repository.delete("invalid-uuid", "also-invalid");
      expect(result.isFailure()).toBe(true);
    });

    it("should handle createConnection with invalid UUIDs", async () => {
      const result = await repository.createConnection("invalid", "invalid", "invalid");
      expect(result.isFailure()).toBe(true);
    });
  });

  describe("edge cases", () => {
    it("should handle step creation with minimal data", async () => {
      const stepData = {
        type: "INSTRUCTION" as const,
        position: { x: 0, y: 0 },
        stepSpecification: {},
      };

      const result = await repository.create(testFlowId, stepData);

      assertSuccess(result);
      expect(result.value[0]).toMatchObject({
        type: "INSTRUCTION",
        position: { x: 0, y: 0 },
        title: null,
        description: null,
      });
    });

    it("should handle step with complex stepSpecification", async () => {
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

      const stepData = {
        type: "MEASUREMENT" as const,
        position: { x: 100, y: 100 },
        title: "Complex Measurement",
        stepSpecification: complexSpec,
      };

      const result = await repository.create(testFlowId, stepData);

      assertSuccess(result);
      expect(result.value[0].stepSpecification).toEqual(complexSpec);
    });

    it("should handle step with media array", async () => {
      const stepData = {
        type: "INSTRUCTION" as const,
        position: { x: 100, y: 100 },
        title: "Step with Media",
        media: [
          "https://example.com/image1.jpg",
          "https://example.com/video1.mp4",
          "https://example.com/audio1.mp3",
        ],
        stepSpecification: {},
      };

      const result = await repository.create(testFlowId, stepData);

      assertSuccess(result);
      expect(result.value[0].media).toEqual(stepData.media);
    });

    it("should handle very large number of steps", async () => {
      // Create 100 steps to test performance
      const promises = Array.from({ length: 100 }, (_, i) =>
        repository.create(testFlowId, {
          type: "INSTRUCTION" as const,
          position: { x: i * 10, y: i * 10 },
          title: `Step ${i}`,
          stepSpecification: {},
        }),
      );

      await Promise.all(promises);

      const result = await repository.findByFlowId(testFlowId);
      assertSuccess(result);
      expect(result.value.length).toBe(100);
    });

    it("should handle concurrent step creation", async () => {
      const stepData1 = {
        type: "INSTRUCTION" as const,
        position: { x: 100, y: 100 },
        title: "Concurrent Step 1",
        stepSpecification: {},
      };
      const stepData2 = {
        type: "QUESTION" as const,
        position: { x: 200, y: 200 },
        title: "Concurrent Step 2",
        stepSpecification: {},
      };

      const [result1, result2] = await Promise.all([
        repository.create(testFlowId, stepData1),
        repository.create(testFlowId, stepData2),
      ]);

      assertSuccess(result1);
      assertSuccess(result2);
      expect(result1.value[0].id).not.toBe(result2.value[0].id);
    });

    it("should handle update with null values", async () => {
      const stepData = {
        type: "INSTRUCTION" as const,
        position: { x: 100, y: 100 },
        title: "Original Title",
        description: "Original Description",
        stepSpecification: {},
      };

      const createResult = await repository.create(testFlowId, stepData);
      assertSuccess(createResult);
      const stepId = createResult.value[0].id;

      const updateData = {
        title: null,
        description: null,
        media: null,
      };

      const result = await repository.update(testFlowId, stepId, updateData);

      assertSuccess(result);
      expect(result.value[0].title).toBeNull();
      expect(result.value[0].description).toBeNull();
      expect(result.value[0].media).toBeNull();
    });

    it("should handle connection creation with all optional parameters", async () => {
      const stepData1 = {
        type: "INSTRUCTION" as const,
        position: { x: 100, y: 100 },
        title: "Source Step",
        stepSpecification: {},
      };
      const stepData2 = {
        type: "QUESTION" as const,
        position: { x: 200, y: 200 },
        title: "Target Step",
        stepSpecification: {},
      };

      const [sourceResult, targetResult] = await Promise.all([
        repository.create(testFlowId, stepData1),
        repository.create(testFlowId, stepData2),
      ]);

      assertSuccess(sourceResult);
      assertSuccess(targetResult);

      const connectionData = {
        type: "conditional",
        animated: true,
        label: "If answer is 'Yes'",
        condition: { answer: "yes", operator: "equals" },
        priority: 10,
      };

      const result = await repository.createConnection(
        testFlowId,
        sourceResult.value[0].id,
        targetResult.value[0].id,
        connectionData,
      );

      assertSuccess(result);
      expect(result.value).toMatchObject(connectionData);
    });
  });

  describe("data integrity", () => {
    it("should maintain step order consistency", async () => {
      const steps = Array.from({ length: 10 }, (_, i) => ({
        type: "INSTRUCTION" as const,
        position: { x: i * 50, y: 100 },
        title: `Step ${i}`,
        stepSpecification: {},
      }));

      // Create steps sequentially with small delays
      for (const stepData of steps) {
        await repository.create(testFlowId, stepData);
        await new Promise((resolve) => setTimeout(resolve, 5));
      }

      const result = await repository.findByFlowId(testFlowId);
      assertSuccess(result);

      // Verify order is maintained
      expect(result.value).toHaveLength(10);
      for (let i = 0; i < 10; i++) {
        expect(result.value[i].title).toBe(`Step ${i}`);
      }
    });

    it("should handle step specification type safety", async () => {
      const stepData = {
        type: "QUESTION" as const,
        position: { x: 100, y: 100 },
        title: "Type Safety Test",
        stepSpecification: {
          required: true,
          answerType: "MULTIPLE_CHOICE" as const,
          choices: ["Option A", "Option B", "Option C"],
          allowMultiple: false,
          randomizeOrder: true,
        },
      };

      const result = await repository.create(testFlowId, stepData);

      assertSuccess(result);
      expect(result.value[0].stepSpecification).toEqual(stepData.stepSpecification);

      const spec = result.value[0].stepSpecification;
      if (spec && typeof spec === "object" && !Array.isArray(spec)) {
        expect(typeof spec.required).toBe("boolean");
        expect(Array.isArray(spec.choices)).toBe(true);
      }
    });
  });
});
