import { TestHarness } from "@/test/test-harness";

import { assertSuccess } from "../../../../common/utils/fp-utils";
import { FlowStepRepository, FlowStepRepositoryError } from "./flow-step.repository";
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

  describe("Bulk Operations", () => {
    describe("createFlowWithSteps", () => {
      it("should create a complete flow with steps and connections", async () => {
        const createFlowWithStepsDto = {
          name: "Complete Test Flow",
          description: "A flow created with bulk operation",
          version: 1,
          isActive: true,
          steps: [
            {
              type: "INSTRUCTION" as const,
              title: "Welcome Step",
              description: "Welcome to the test flow",
              position: { x: 100, y: 100 },
              isStartNode: true,
              isEndNode: false,
              stepSpecification: {},
            },
            {
              type: "QUESTION" as const,
              title: "Question Step",
              description: "Please answer this question",
              position: { x: 200, y: 200 },
              isStartNode: false,
              isEndNode: false,
              stepSpecification: {
                required: true,
                answerType: "TEXT" as const,
                placeholder: "Enter your answer",
              },
            },
            {
              type: "MEASUREMENT" as const,
              title: "Measurement Step",
              description: "Take a measurement",
              position: { x: 300, y: 300 },
              isStartNode: false,
              isEndNode: true,
              stepSpecification: {
                protocolId: "test-protocol",
                autoStart: false,
                retryAttempts: 3,
              },
            },
          ],
          connections: [],
        };

        const result = await repository.createFlowWithSteps(createFlowWithStepsDto, testUserId);

        assertSuccess(result);
        expect(result.value.name).toBe("Complete Test Flow");
        expect(result.value.description).toBe("A flow created with bulk operation");
        expect(result.value.version).toBe(1);
        expect(result.value.isActive).toBe(true);
        expect(result.value.createdBy).toBe(testUserId);
        expect(result.value.steps).toHaveLength(3);
        expect(result.value.connections).toHaveLength(0);

        // Verify steps were created correctly
        const steps = result.value.steps;
        expect(steps[0]).toMatchObject({
          type: "INSTRUCTION",
          title: "Welcome Step",
          description: "Welcome to the test flow",
          position: { x: 100, y: 100 },
          isStartNode: true,
          isEndNode: false,
        });
        expect(steps[1]).toMatchObject({
          type: "QUESTION",
          title: "Question Step",
          description: "Please answer this question",
          position: { x: 200, y: 200 },
          isStartNode: false,
          isEndNode: false,
        });
        expect(steps[2]).toMatchObject({
          type: "MEASUREMENT",
          title: "Measurement Step",
          description: "Take a measurement",
          position: { x: 300, y: 300 },
          isStartNode: false,
          isEndNode: true,
        });

        // Verify step specifications
        expect(steps[0].stepSpecification).toEqual({});
        expect(steps[1].stepSpecification).toEqual({
          required: true,
          answerType: "TEXT",
          placeholder: "Enter your answer",
        });
        expect(steps[2].stepSpecification).toEqual({
          protocolId: "test-protocol",
          autoStart: false,
          retryAttempts: 3,
        });
      });

      it("should create flow with connections", async () => {
        const createFlowWithStepsDto = {
          name: "Flow with Connections",
          steps: [
            {
              type: "INSTRUCTION" as const,
              title: "Step 1",
              position: { x: 100, y: 100 },
              stepSpecification: {},
            },
            {
              type: "QUESTION" as const,
              title: "Step 2",
              position: { x: 200, y: 200 },
              stepSpecification: {
                required: true,
                answerType: "TEXT" as const,
              },
            },
          ],
          connections: [
            {
              sourceStepId: "temp-step-1", // These will be mapped to actual IDs
              targetStepId: "temp-step-2",
              type: "default",
              animated: false,
              priority: 0,
            },
          ],
        };

        const result = await repository.createFlowWithSteps(createFlowWithStepsDto, testUserId);

        assertSuccess(result);
        expect(result.value.steps).toHaveLength(2);
        expect(result.value.connections).toHaveLength(1);

        const connection = result.value.connections[0];
        expect(connection).toMatchObject({
          type: "default",
          animated: false,
          priority: 0,
        });
        expect(connection.sourceStepId).toBeDefined();
        expect(connection.targetStepId).toBeDefined();
      });

      it("should handle minimum required fields", async () => {
        const createFlowWithStepsDto = {
          name: "Minimal Flow",
          steps: [
            {
              type: "INSTRUCTION" as const,
              position: { x: 0, y: 0 },
            },
          ],
        };

        const result = await repository.createFlowWithSteps(createFlowWithStepsDto, testUserId);

        assertSuccess(result);
        expect(result.value.name).toBe("Minimal Flow");
        expect(result.value.description).toBeNull();
        expect(result.value.version).toBe(1);
        expect(result.value.isActive).toBe(true);
        expect(result.value.steps).toHaveLength(1);
        expect(result.value.connections).toHaveLength(0);
      });

      it("should handle transaction rollback on failure", async () => {
        const createFlowWithStepsDto = {
          name: "Flow That Will Fail",
          steps: [
            {
              type: "INVALID_TYPE" as any, // This should cause a failure
              position: { x: 100, y: 100 },
              stepSpecification: {},
            },
          ],
        };

        const result = await repository.createFlowWithSteps(createFlowWithStepsDto, testUserId);

        expect(result.isFailure()).toBe(true);

        // Verify no partial data was created
        const flowsResult = await flowRepository.findAll();
        assertSuccess(flowsResult);
        const createdFlow = flowsResult.value.find((f) => f.name === "Flow That Will Fail");
        expect(createdFlow).toBeUndefined();
      });
    });

    describe("updateFlowWithSteps", () => {
      let existingFlowId: string;
      let existingStepId1: string;
      let existingStepId2: string;
      let existingConnectionId: string;

      beforeEach(async () => {
        // Create a flow with existing steps first (without connections)
        const createResult = await repository.createFlowWithSteps(
          {
            name: "Existing Flow",
            description: "Flow for update testing",
            steps: [
              {
                type: "INSTRUCTION" as const,
                title: "Original Step 1",
                position: { x: 100, y: 100 },
                stepSpecification: {},
              },
              {
                type: "QUESTION" as const,
                title: "Original Step 2",
                position: { x: 200, y: 200 },
                stepSpecification: {
                  required: true,
                  answerType: "TEXT" as const,
                },
              },
            ],
          },
          testUserId,
        );

        assertSuccess(createResult);
        existingFlowId = createResult.value.id;
        existingStepId1 = createResult.value.steps[0].id;
        existingStepId2 = createResult.value.steps[1].id;

        // Now add a connection using the real step IDs
        const updateResult = await repository.updateFlowWithSteps(existingFlowId, {
          connections: {
            create: [
              {
                sourceStepId: existingStepId1,
                targetStepId: existingStepId2,
                type: "default",
                animated: false,
                priority: 0,
              },
            ],
          },
        });

        assertSuccess(updateResult);
        existingConnectionId = updateResult.value.connections[0].id;
      });

      it("should update flow metadata only", async () => {
        const updateFlowWithStepsDto = {
          flow: {
            name: "Updated Flow Name",
            description: "Updated flow description",
            isActive: false,
          },
        };

        const result = await repository.updateFlowWithSteps(existingFlowId, updateFlowWithStepsDto);

        assertSuccess(result);
        expect(result.value.name).toBe("Updated Flow Name");
        expect(result.value.description).toBe("Updated flow description");
        expect(result.value.isActive).toBe(false);
        expect(result.value.steps).toHaveLength(2); // Steps unchanged
        expect(result.value.connections).toHaveLength(1); // Connections unchanged
      });

      it("should create new steps", async () => {
        const updateFlowWithStepsDto = {
          steps: {
            create: [
              {
                type: "MEASUREMENT" as const,
                title: "New Measurement Step",
                position: { x: 300, y: 300 },
                stepSpecification: {
                  protocolId: "new-protocol",
                  autoStart: true,
                },
              },
              {
                type: "ANALYSIS" as const,
                title: "New Analysis Step",
                position: { x: 400, y: 400 },
                stepSpecification: {
                  macroId: "analysis-macro",
                  autoRun: false,
                },
              },
            ],
          },
        };

        const result = await repository.updateFlowWithSteps(existingFlowId, updateFlowWithStepsDto);

        assertSuccess(result);
        expect(result.value.steps).toHaveLength(4); // 2 original + 2 new

        const newSteps = result.value.steps.slice(2); // Last 2 steps should be new
        expect(newSteps[0]).toMatchObject({
          type: "MEASUREMENT",
          title: "New Measurement Step",
          position: { x: 300, y: 300 },
        });
        expect(newSteps[1]).toMatchObject({
          type: "ANALYSIS",
          title: "New Analysis Step",
          position: { x: 400, y: 400 },
        });
      });

      it("should update existing steps", async () => {
        const updateFlowWithStepsDto = {
          steps: {
            update: [
              {
                id: existingStepId1,
                title: "Updated Step 1 Title",
                description: "Updated description",
                position: { x: 150, y: 150 },
              },
              {
                id: existingStepId2,
                stepSpecification: {
                  required: false,
                  answerType: "NUMBER" as const,
                  placeholder: "Enter a number",
                },
              },
            ],
          },
        };

        const result = await repository.updateFlowWithSteps(existingFlowId, updateFlowWithStepsDto);

        assertSuccess(result);
        expect(result.value.steps).toHaveLength(2);

        const step1 = result.value.steps.find((s) => s.id === existingStepId1);
        const step2 = result.value.steps.find((s) => s.id === existingStepId2);

        expect(step1).toMatchObject({
          title: "Updated Step 1 Title",
          description: "Updated description",
          position: { x: 150, y: 150 },
        });

        expect(step2?.stepSpecification).toEqual({
          required: false,
          answerType: "NUMBER",
          placeholder: "Enter a number",
        });
      });

      it("should delete steps", async () => {
        const updateFlowWithStepsDto = {
          steps: {
            delete: [existingStepId2],
          },
        };

        const result = await repository.updateFlowWithSteps(existingFlowId, updateFlowWithStepsDto);

        assertSuccess(result);
        expect(result.value.steps).toHaveLength(1);
        expect(result.value.steps[0].id).toBe(existingStepId1);

        // Connection should also be deleted due to cascade
        expect(result.value.connections).toHaveLength(0);
      });

      it("should perform complex bulk operations", async () => {
        const updateFlowWithStepsDto = {
          flow: {
            name: "Complex Updated Flow",
          },
          steps: {
            create: [
              {
                type: "ANALYSIS" as const,
                title: "New Analysis",
                position: { x: 400, y: 400 },
                stepSpecification: {
                  macroId: "test-macro",
                },
              },
            ],
            update: [
              {
                id: existingStepId1,
                title: "Updated First Step",
              },
            ],
            delete: [existingStepId2],
          },
          connections: {
            create: [
              {
                sourceStepId: existingStepId1,
                targetStepId: "new-step-id", // Will be mapped to actual new step ID
                type: "default",
              },
            ],
            delete: [existingConnectionId],
          },
        };

        const result = await repository.updateFlowWithSteps(existingFlowId, updateFlowWithStepsDto);

        assertSuccess(result);
        expect(result.value.name).toBe("Complex Updated Flow");
        expect(result.value.steps).toHaveLength(2); // 1 updated + 1 new (1 deleted)

        const updatedStep = result.value.steps.find((s) => s.id === existingStepId1);
        expect(updatedStep?.title).toBe("Updated First Step");

        const newStep = result.value.steps.find((s) => s.title === "New Analysis");
        expect(newStep).toBeDefined();
        expect(newStep?.type).toBe("ANALYSIS");
      });

      it("should handle connection operations", async () => {
        const updateFlowWithStepsDto = {
          connections: {
            create: [
              {
                sourceStepId: existingStepId2,
                targetStepId: existingStepId1, // Reverse connection
                type: "default",
                label: "Reverse Flow",
                priority: 1,
              },
            ],
            update: [
              {
                id: existingConnectionId,
                label: "Updated Connection",
                animated: true,
                priority: 5,
              },
            ],
          },
        };

        const result = await repository.updateFlowWithSteps(existingFlowId, updateFlowWithStepsDto);

        assertSuccess(result);
        expect(result.value.connections).toHaveLength(2);

        const updatedConnection = result.value.connections.find(
          (c) => c.id === existingConnectionId,
        );
        expect(updatedConnection).toMatchObject({
          label: "Updated Connection",
          animated: true,
          priority: 5,
        });

        const newConnection = result.value.connections.find((c) => c.label === "Reverse Flow");
        expect(newConnection).toMatchObject({
          sourceStepId: existingStepId2,
          targetStepId: existingStepId1,
          label: "Reverse Flow",
          priority: 1,
        });
      });

      it("should handle empty updates gracefully", async () => {
        const updateFlowWithStepsDto = {};

        const result = await repository.updateFlowWithSteps(existingFlowId, updateFlowWithStepsDto);

        assertSuccess(result);
        expect(result.value.name).toBe("Existing Flow"); // Unchanged
        expect(result.value.steps).toHaveLength(2); // Unchanged
        expect(result.value.connections).toHaveLength(1); // Unchanged
      });

      it("should handle non-existent flow", async () => {
        const nonExistentFlowId = "123e4567-e89b-12d3-a456-426614174999";
        const updateFlowWithStepsDto = {
          flow: {
            name: "This should fail",
          },
        };

        const result = await repository.updateFlowWithSteps(
          nonExistentFlowId,
          updateFlowWithStepsDto,
        );

        expect(result.isFailure()).toBe(true);
      });

      it("should maintain transaction integrity on partial failures", async () => {
        const updateFlowWithStepsDto = {
          steps: {
            create: [
              {
                type: "INVALID_TYPE" as any, // This should cause failure
                position: { x: 100, y: 100 },
                stepSpecification: {},
              },
            ],
            update: [
              {
                id: existingStepId1,
                title: "This update should be rolled back",
              },
            ],
          },
        };

        const result = await repository.updateFlowWithSteps(existingFlowId, updateFlowWithStepsDto);

        expect(result.isFailure()).toBe(true);

        // Verify original data was not modified
        const originalResult = await repository.getFlowWithConnections(existingFlowId);
        assertSuccess(originalResult);
        const originalStep = originalResult.value.steps.find((s) => s.id === existingStepId1);
        expect(originalStep?.title).toBe("Original Step 1"); // Should remain unchanged
      });
    });

    describe("bulk operations error handling", () => {
      it("should handle database constraint violations in createFlowWithSteps", async () => {
        const createFlowWithStepsDto = {
          name: "", // Empty name should violate constraint
          steps: [],
        };

        const result = await repository.createFlowWithSteps(createFlowWithStepsDto, testUserId);

        expect(result.isFailure()).toBe(true);
      });

      it("should handle invalid step types in createFlowWithSteps", async () => {
        const createFlowWithStepsDto = {
          name: "Invalid Step Type Flow",
          steps: [
            {
              type: "INVALID" as any,
              position: { x: 100, y: 100 },
              stepSpecification: {},
            },
          ],
        };

        const result = await repository.createFlowWithSteps(createFlowWithStepsDto, testUserId);

        expect(result.isFailure()).toBe(true);
      });

      it("should handle invalid user ID in createFlowWithSteps", async () => {
        const createFlowWithStepsDto = {
          name: "Test Flow",
          steps: [],
        };

        const result = await repository.createFlowWithSteps(
          createFlowWithStepsDto,
          "invalid-user-id",
        );

        expect(result.isFailure()).toBe(true);
      });

      it("should handle invalid step ID in updateFlowWithSteps", async () => {
        const updateFlowWithStepsDto = {
          steps: {
            update: [
              {
                id: "invalid-step-id",
                title: "This should fail",
              },
            ],
          },
        };

        const result = await repository.updateFlowWithSteps(testFlowId, updateFlowWithStepsDto);

        expect(result.isFailure()).toBe(true);
      });

      it("should handle invalid connection ID in updateFlowWithSteps", async () => {
        const updateFlowWithStepsDto = {
          connections: {
            update: [
              {
                id: "invalid-connection-id",
                label: "This should fail",
              },
            ],
          },
        };

        const result = await repository.updateFlowWithSteps(testFlowId, updateFlowWithStepsDto);

        expect(result.isFailure()).toBe(true);
      });
    });

    describe("bulk operations performance", () => {
      it("should handle large number of steps efficiently", async () => {
        const steps = Array.from({ length: 50 }, (_, i) => ({
          type: "INSTRUCTION" as const,
          title: `Bulk Step ${i}`,
          position: { x: i * 10, y: 100 },
          stepSpecification: {},
        }));

        const createFlowWithStepsDto = {
          name: "Large Flow",
          steps,
        };

        const startTime = Date.now();
        const result = await repository.createFlowWithSteps(createFlowWithStepsDto, testUserId);
        const endTime = Date.now();

        assertSuccess(result);
        expect(result.value.steps).toHaveLength(50);
        expect(endTime - startTime).toBeLessThan(5000); // Should complete within 5 seconds
      });

      it("should handle large number of connections efficiently", async () => {
        // Create a flow with many steps first
        const steps = Array.from({ length: 20 }, (_, i) => ({
          type: "INSTRUCTION" as const,
          title: `Step ${i}`,
          position: { x: i * 50, y: 100 },
          stepSpecification: {},
        }));

        const createResult = await repository.createFlowWithSteps(
          {
            name: "Connection Test Flow",
            steps,
          },
          testUserId,
        );

        assertSuccess(createResult);
        const stepIds = createResult.value.steps.map((s) => s.id);

        // Create connections between consecutive steps
        const connections = stepIds.slice(0, -1).map((sourceId, i) => ({
          sourceStepId: sourceId,
          targetStepId: stepIds[i + 1],
          type: "default",
          priority: i,
        }));

        const updateFlowWithStepsDto = {
          connections: {
            create: connections,
          },
        };

        const startTime = Date.now();
        const result = await repository.updateFlowWithSteps(
          createResult.value.id,
          updateFlowWithStepsDto,
        );
        const endTime = Date.now();

        assertSuccess(result);
        expect(result.value.connections).toHaveLength(19); // 20 steps = 19 connections
        expect(endTime - startTime).toBeLessThan(3000); // Should complete within 3 seconds
      });
    });
  });
});
