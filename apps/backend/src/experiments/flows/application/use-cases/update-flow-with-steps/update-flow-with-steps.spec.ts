import { assertFailure, assertSuccess } from "../../../../../common/utils/fp-utils";
import { TestHarness } from "../../../../../test/test-harness";
import type { UpdateFlowWithStepsDto } from "../../../core/models/flow.model";
import { UpdateFlowWithStepsUseCase } from "./update-flow-with-steps";

describe("UpdateFlowWithStepsUseCase", () => {
  const testApp = TestHarness.App;
  let testUserId: string;
  let useCase: UpdateFlowWithStepsUseCase;

  beforeAll(async () => {
    await testApp.setup();
  });

  beforeEach(async () => {
    await testApp.beforeEach();
    testUserId = await testApp.createTestUser({});
    useCase = testApp.module.get(UpdateFlowWithStepsUseCase);
  });

  afterEach(() => {
    testApp.afterEach();
  });

  afterAll(async () => {
    await testApp.teardown();
  });

  it("should successfully update flow with bulk step operations", async () => {
    // Create initial flow and steps
    const flow = await testApp.createFlow({
      name: "Original Flow Name",
      description: "Original description",
      createdBy: testUserId,
    });

    const step1 = await testApp.createFlowStep({
      flowId: flow.id,
      type: "INSTRUCTION",
      title: "Original Step",
      position: { x: 100, y: 100 },
      isStartNode: true,
    });

    const step2 = await testApp.createFlowStep({
      flowId: flow.id,
      type: "INSTRUCTION",
      title: "Step to Delete",
      position: { x: 200, y: 200 },
    });

    const step3 = await testApp.createFlowStep({
      flowId: flow.id,
      type: "INSTRUCTION",
      title: "Target Step",
      position: { x: 300, y: 300 },
      isEndNode: true,
    });

    const connection = await testApp.createFlowStepConnection({
      flowId: flow.id,
      sourceStepId: step2.id,
      targetStepId: step3.id,
      type: "default",
    });

    // Define update data
    const updateFlowWithStepsDto: UpdateFlowWithStepsDto = {
      flow: {
        name: "Updated Flow Name",
        description: "Updated description",
      },
      steps: {
        create: [
          {
            type: "INSTRUCTION",
            title: "New Step",
            position: { x: 400, y: 400 },
            stepSpecification: {},
          },
        ],
        update: [
          {
            id: step1.id,
            title: "Updated Step Title",
            description: "Updated description",
          },
        ],
        delete: [step2.id],
      },
      connections: {
        create: [
          {
            sourceStepId: step1.id,
            targetStepId: step3.id,
            type: "default",
          },
        ],
        delete: [connection.id],
      },
    };

    // Execute the update
    const result = await useCase.execute(flow.id, updateFlowWithStepsDto);

    // Verify result is success
    expect(result.isSuccess()).toBe(true);
    assertSuccess(result);
    const updatedFlow = result.value;

    // Verify flow metadata was updated
    expect(updatedFlow.id).toBe(flow.id);
    expect(updatedFlow.name).toBe("Updated Flow Name");
    expect(updatedFlow.description).toBe("Updated description");

    // Verify steps operations
    expect(updatedFlow.steps).toHaveLength(3); // 1 updated + 1 new + 1 unchanged (step3)

    // Find the updated step
    const updatedStep = updatedFlow.steps.find((s) => s.id === step1.id);
    expect(updatedStep).toBeDefined();
    expect(updatedStep?.title).toBe("Updated Step Title");
    expect(updatedStep?.description).toBe("Updated description");

    // Verify new step was created
    const newStep = updatedFlow.steps.find((s) => s.title === "New Step");
    expect(newStep).toBeDefined();
    expect(newStep?.position).toEqual({ x: 400, y: 400 });

    // Verify step2 was deleted
    const deletedStep = updatedFlow.steps.find((s) => s.id === step2.id);
    expect(deletedStep).toBeUndefined();

    // Verify connections operations
    expect(updatedFlow.connections).toHaveLength(1); // 1 new connection (old one deleted)
    const newConnection = updatedFlow.connections[0];
    expect(newConnection.sourceStepId).toBe(step1.id);
    expect(newConnection.targetStepId).toBe(step3.id);
  });

  it("should return failure when flow does not exist", async () => {
    const nonExistentId = "00000000-0000-0000-0000-000000000000";
    const updateFlowWithStepsDto: UpdateFlowWithStepsDto = {
      flow: {
        name: "Updated Flow",
      },
    };

    const result = await useCase.execute(nonExistentId, updateFlowWithStepsDto);

    expect(result.isSuccess()).toBe(false);
    assertFailure(result);
    expect(result.error.code).toBe("NOT_FOUND");
  });

  it("should handle partial updates correctly", async () => {
    // Create a flow
    const flow = await testApp.createFlow({
      name: "Original Flow Name",
      description: "Original description",
      createdBy: testUserId,
    });

    // Only update flow metadata
    const updateFlowWithStepsDto: UpdateFlowWithStepsDto = {
      flow: {
        name: "New Flow Name",
        isActive: false,
      },
    };

    const result = await useCase.execute(flow.id, updateFlowWithStepsDto);

    expect(result.isSuccess()).toBe(true);
    assertSuccess(result);
    const updatedFlow = result.value;

    expect(updatedFlow.name).toBe("New Flow Name");
    expect(updatedFlow.isActive).toBe(false);
    expect(updatedFlow.description).toBe("Original description");
  });

  it("should handle step-only updates", async () => {
    // Create a flow with a step
    const flow = await testApp.createFlow({
      name: "Original Flow Name",
      createdBy: testUserId,
    });

    const step1 = await testApp.createFlowStep({
      flowId: flow.id,
      type: "INSTRUCTION",
      title: "Original Title",
      position: { x: 100, y: 100 },
      isStartNode: true,
    });

    // Only update steps
    const updateFlowWithStepsDto: UpdateFlowWithStepsDto = {
      steps: {
        create: [
          {
            type: "QUESTION",
            title: "New Question",
            position: { x: 400, y: 400 },
            stepSpecification: {
              required: true,
              answerType: "NUMBER",
            },
          },
        ],
        update: [
          {
            id: step1.id,
            position: { x: 150, y: 150 },
          },
        ],
      },
    };

    const result = await useCase.execute(flow.id, updateFlowWithStepsDto);

    expect(result.isSuccess()).toBe(true);
    assertSuccess(result);
    const updatedFlow = result.value;

    // Verify flow metadata unchanged
    expect(updatedFlow.name).toBe("Original Flow Name");

    // Verify steps operations
    expect(updatedFlow.steps).toHaveLength(2);

    const updatedStep = updatedFlow.steps.find((s) => s.id === step1.id);
    expect(updatedStep?.position).toEqual({ x: 150, y: 150 });

    const newStep = updatedFlow.steps.find((s) => s.type === "QUESTION");
    expect(newStep).toBeDefined();
    expect(newStep?.title).toBe("New Question");
  });

  it("should handle connection-only updates", async () => {
    // Create a flow with steps and a connection
    const flow = await testApp.createFlow({
      name: "Flow Name",
      createdBy: testUserId,
    });

    const step1 = await testApp.createFlowStep({
      flowId: flow.id,
      type: "INSTRUCTION",
      title: "Step 1",
      position: { x: 100, y: 100 },
    });

    const step2 = await testApp.createFlowStep({
      flowId: flow.id,
      type: "INSTRUCTION",
      title: "Step 2",
      position: { x: 200, y: 200 },
    });

    const step3 = await testApp.createFlowStep({
      flowId: flow.id,
      type: "INSTRUCTION",
      title: "Step 3",
      position: { x: 300, y: 300 },
    });

    const connection = await testApp.createFlowStepConnection({
      flowId: flow.id,
      sourceStepId: step1.id,
      targetStepId: step2.id,
      type: "default",
      label: "Original Label",
    });

    // Only update connections
    const updateFlowWithStepsDto: UpdateFlowWithStepsDto = {
      connections: {
        create: [
          {
            sourceStepId: step2.id,
            targetStepId: step3.id,
            type: "default",
            label: "New Connection",
          },
        ],
        update: [
          {
            id: connection.id,
            label: "Updated Connection Label",
            priority: 1,
          },
        ],
      },
    };

    const result = await useCase.execute(flow.id, updateFlowWithStepsDto);

    expect(result.isSuccess()).toBe(true);
    assertSuccess(result);
    const updatedFlow = result.value;

    expect(updatedFlow.connections).toHaveLength(2);

    const updatedConnection = updatedFlow.connections.find((c) => c.id === connection.id);
    expect(updatedConnection?.label).toBe("Updated Connection Label");
    expect(updatedConnection?.priority).toBe(1);

    const newConnection = updatedFlow.connections.find((c) => c.label === "New Connection");
    expect(newConnection).toBeDefined();
  });

  it("should handle empty update gracefully", async () => {
    // Create a flow
    const flow = await testApp.createFlow({
      name: "Unchanged Flow",
      createdBy: testUserId,
    });

    // Empty update
    const updateFlowWithStepsDto: UpdateFlowWithStepsDto = {};

    const result = await useCase.execute(flow.id, updateFlowWithStepsDto);

    expect(result.isSuccess()).toBe(true);
    assertSuccess(result);
    const updatedFlow = result.value;

    expect(updatedFlow.name).toBe("Unchanged Flow");
    expect(updatedFlow.steps).toHaveLength(0);
    expect(updatedFlow.connections).toHaveLength(0);
  });
});
