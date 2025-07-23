import { TestHarness } from "@/test/test-harness";

import { assertSuccess, assertFailure } from "../../../../../common/utils/fp-utils";
import { FlowStepRepository } from "../../../core/repositories/flow-step.repository";
import { FlowRepository } from "../../../core/repositories/flow.repository";
import { CreateFlowStepUseCase } from "./create-flow-step";

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
      const stepData = {
        type: "INSTRUCTION" as const,
        title: "Welcome Step",
        description: "This is a welcome instruction",
        position: { x: 100, y: 100 },
        stepSpecification: {},
      };

      const result = await useCase.execute(testFlowId, stepData);

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

      const result = await useCase.execute(testFlowId, stepData);

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

      const result = await useCase.execute(testFlowId, stepData);

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
      const stepData = {
        type: "ANALYSIS" as const,
        title: "Analyze Results",
        position: { x: 400, y: 400 },
        stepSpecification: {
          macroId: "test-macro-id",
          autoRun: true,
        },
      };

      const result = await useCase.execute(testFlowId, stepData);

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

      // eslint-disable-next-line @typescript-eslint/no-unsafe-argument
      const result = await useCase.execute(testFlowId, stepData);

      assertSuccess(result);
      expect(result.value.position).toEqual({ x: 250, y: 100 }); // Should use default position
    });

    it("should fail when flow does not exist", async () => {
      const stepData = {
        type: "INSTRUCTION" as const,
        position: { x: 100, y: 100 },
        stepSpecification: {},
      };
      // Use a valid but non-existent UUID
      const nonExistentFlowId = "123e4567-e89b-12d3-a456-426614174000";

      const result = await useCase.execute(nonExistentFlowId, stepData);

      assertFailure(result);
      expect(result.error.message).toBe(`Flow with ID ${nonExistentFlowId} not found`);
    });

    it("should succeed when no step configuration is provided", async () => {
      const stepData = {
        type: "INSTRUCTION" as const,
        position: { x: 100, y: 100 },
      };

      const result = await useCase.execute(testFlowId, stepData);

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

  });
});
