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
    });
  });
});
