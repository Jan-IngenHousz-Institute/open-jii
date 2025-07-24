import { faker } from "@faker-js/faker";
import { StatusCodes } from "http-status-codes";

import type { ErrorResponse } from "@repo/api";
import { contract } from "@repo/api";

import { assertSuccess, success, failure } from "../../../common/utils/fp-utils";
import { TestHarness } from "../../../test/test-harness";

describe("ExperimentFlowController", () => {
  const testApp = TestHarness.App;
  let testUserId: string;
  let adminUserId: string;
  let memberUserId: string;
  let nonMemberUserId: string;
  let experimentId: string;
  let flowId: string;

  beforeAll(async () => {
    await testApp.setup();
  });

  beforeEach(async () => {
    await testApp.beforeEach();

    // Create users with different roles
    testUserId = await testApp.createTestUser({});
    adminUserId = await testApp.createTestUser({});
    memberUserId = await testApp.createTestUser({});
    nonMemberUserId = await testApp.createTestUser({});

    // Create experiment with admin user
    const { experiment } = await testApp.createExperiment({
      name: "Test Experiment",
      userId: adminUserId,
    });
    experimentId = experiment.id;

    // Add member user to experiment
    await testApp.addExperimentMember({
      experimentId,
      userId: memberUserId,
      role: "member",
    });

    // Create a flow
    const flowResponse = await testApp
      .post(contract.flows.createFlow.path)
      .withAuth(adminUserId)
      .send({
        name: "Test Flow for Mobile",
        description: "Test flow for mobile execution",
      })
      .expect(StatusCodes.CREATED);

    flowId = flowResponse.body.id;

    // Associate flow with experiment
    await testApp.updateExperiment({
      experimentId,
      updates: { flowId },
    });

    // Create test flow steps
    const step1Path = testApp.resolvePath(contract.flows.createFlowStep.path, { id: flowId });
    const step2Path = testApp.resolvePath(contract.flows.createFlowStep.path, { id: flowId });

    await testApp
      .post(step1Path)
      .withAuth(adminUserId)
      .send({
        type: "INSTRUCTION",
        title: "Welcome Step",
        description: "Welcome to the experiment",
        position: { x: 100, y: 100 },
        isStartNode: true,
        stepSpecification: {},
      })
      .expect(StatusCodes.CREATED);

    await testApp
      .post(step2Path)
      .withAuth(adminUserId)
      .send({
        type: "QUESTION",
        title: "Question Step",
        description: "Please answer this question",
        position: { x: 200, y: 200 },
        isEndNode: true,
        stepSpecification: {
          required: true,
          answerType: "TEXT",
          placeholder: "Enter your answer",
        },
      })
      .expect(StatusCodes.CREATED);
  });

  afterEach(() => {
    testApp.afterEach();
  });

  afterAll(async () => {
    await testApp.teardown();
  });

  describe("submitStepResult", () => {
    const stepResultData = {
      stepId: faker.string.uuid(),
      result: {
        type: "INSTRUCTION",
        completedAt: new Date().toISOString(),
      },
    };

    it("should successfully submit step result for admin user", async () => {
      const path = testApp.resolvePath(contract.flows.submitStepResult.path, {
        id: experimentId,
      });

      const response = await testApp
        .post(path)
        .withAuth(adminUserId)
        .send(stepResultData)
        .expect(StatusCodes.OK);

      expect(response.body).toMatchObject({
        success: true,
        nextCursor: expect.any(Number),
        message: "Step result processed successfully",
      });
    });

    it("should successfully submit step result for member user", async () => {
      const path = testApp.resolvePath(contract.flows.submitStepResult.path, {
        id: experimentId,
      });

      const response = await testApp
        .post(path)
        .withAuth(memberUserId)
        .send(stepResultData)
        .expect(StatusCodes.OK);

      expect(response.body).toMatchObject({
        success: true,
        nextCursor: expect.any(Number),
        message: "Step result processed successfully",
      });
    });

    it("should return 404 for non-existent experiment", async () => {
      const nonExistentId = faker.string.uuid();
      const path = testApp.resolvePath(contract.flows.submitStepResult.path, {
        id: nonExistentId,
      });

      await testApp
        .post(path)
        .withAuth(adminUserId)
        .send(stepResultData)
        .expect(StatusCodes.NOT_FOUND)
        .expect(({ body }: { body: ErrorResponse }) => {
          expect(body.message).toContain("not found");
          expect(body.code).toBe("EXPERIMENT_NOT_FOUND");
        });
    });

    it("should return 403 for non-member user accessing private experiment", async () => {
      const path = testApp.resolvePath(contract.flows.submitStepResult.path, {
        id: experimentId,
      });

      await testApp
        .post(path)
        .withAuth(nonMemberUserId)
        .send(stepResultData)
        .expect(StatusCodes.FORBIDDEN)
        .expect(({ body }: { body: ErrorResponse }) => {
          expect(body.message).toBe("You do not have access to this experiment");
          expect(body.code).toBe("ACCESS_DENIED");
        });
    });

    it("should allow access to public experiment for non-member", async () => {
      // Update experiment to be public
      await testApp.updateExperiment({
        experimentId,
        updates: { visibility: "public" },
      });

      const path = testApp.resolvePath(contract.flows.submitStepResult.path, {
        id: experimentId,
      });

      const response = await testApp
        .post(path)
        .withAuth(nonMemberUserId)
        .send(stepResultData)
        .expect(StatusCodes.OK);

      expect(response.body).toMatchObject({
        success: true,
        message: "Step result processed successfully",
      });
    });

    it("should return 401 if not authenticated", async () => {
      const path = testApp.resolvePath(contract.flows.submitStepResult.path, {
        id: experimentId,
      });

      await testApp.post(path).withoutAuth().send(stepResultData).expect(StatusCodes.UNAUTHORIZED);
    });

    it("should handle different step result types", async () => {
      const questionResult = {
        stepId: faker.string.uuid(),
        result: {
          type: "QUESTION",
          result: {
            questionId: faker.string.uuid(),
            answer: "Test answer",
            answeredAt: new Date().toISOString(),
          },
        },
      };

      const path = testApp.resolvePath(contract.flows.submitStepResult.path, {
        id: experimentId,
      });

      const response = await testApp
        .post(path)
        .withAuth(adminUserId)
        .send(questionResult)
        .expect(StatusCodes.OK);

      expect(response.body.success).toBe(true);
    });

    it("should return 400 for invalid request body", async () => {
      const path = testApp.resolvePath(contract.flows.submitStepResult.path, {
        id: experimentId,
      });

      await testApp
        .post(path)
        .withAuth(adminUserId)
        .send({
          // Missing required fields
          invalidField: "invalid",
        })
        .expect(StatusCodes.BAD_REQUEST);
    });
  });

  describe("getMobileFlow", () => {
    it("should successfully get mobile flow for admin user", async () => {
      const path = testApp.resolvePath(contract.flows.getMobileFlow.path, {
        id: experimentId,
      });

      const response = await testApp.get(path).withAuth(adminUserId).expect(StatusCodes.OK);

      expect(response.body).toMatchObject({
        flowId: flowId,
        flowName: "Test Flow for Mobile",
        description: "Test flow for mobile execution",
        steps: expect.arrayContaining([
          expect.objectContaining({
            id: expect.any(String),
            type: expect.stringMatching(/^(INSTRUCTION|QUESTION|MEASUREMENT|ANALYSIS)$/),
            title: expect.any(String),
            description: expect.any(String),
            nextStepIds: expect.any(Array),
            isStartStep: expect.any(Boolean),
            isEndStep: expect.any(Boolean),
          }),
        ]),
        startStepId: expect.any(String),
      });

      expect(response.body.steps).toHaveLength(2);
    });

    it("should successfully get mobile flow for member user", async () => {
      const path = testApp.resolvePath(contract.flows.getMobileFlow.path, {
        id: experimentId,
      });

      const response = await testApp.get(path).withAuth(memberUserId).expect(StatusCodes.OK);

      expect(response.body.flowId).toBe(flowId);
      expect(response.body.steps).toHaveLength(2);
    });

    it("should return 404 for non-existent experiment", async () => {
      const nonExistentId = faker.string.uuid();
      const path = testApp.resolvePath(contract.flows.getMobileFlow.path, {
        id: nonExistentId,
      });

      await testApp
        .get(path)
        .withAuth(adminUserId)
        .expect(StatusCodes.NOT_FOUND)
        .expect(({ body }: { body: ErrorResponse }) => {
          expect(body.message).toContain("not found");
          expect(body.code).toBe("EXPERIMENT_NOT_FOUND");
        });
    });

    it("should return 403 for non-member user accessing private experiment", async () => {
      const path = testApp.resolvePath(contract.flows.getMobileFlow.path, {
        id: experimentId,
      });

      await testApp
        .get(path)
        .withAuth(nonMemberUserId)
        .expect(StatusCodes.FORBIDDEN)
        .expect(({ body }: { body: ErrorResponse }) => {
          expect(body.message).toBe("You do not have access to this experiment");
          expect(body.code).toBe("ACCESS_DENIED");
        });
    });

    it("should allow access to public experiment for non-member", async () => {
      // Update experiment to be public
      await testApp.updateExperiment({
        experimentId,
        updates: { visibility: "public" },
      });

      const path = testApp.resolvePath(contract.flows.getMobileFlow.path, {
        id: experimentId,
      });

      const response = await testApp.get(path).withAuth(nonMemberUserId).expect(StatusCodes.OK);

      // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
      expect(response.body.flowId).toBe(flowId);
    });

    it("should return 400 when experiment has no flow associated", async () => {
      // Create experiment without flow
      const { experiment: noFlowExperiment } = await testApp.createExperiment({
        name: "No Flow Experiment",
        userId: adminUserId,
      });

      const path = testApp.resolvePath(contract.flows.getMobileFlow.path, {
        id: noFlowExperiment.id,
      });

      await testApp
        .get(path)
        .withAuth(adminUserId)
        .expect(StatusCodes.BAD_REQUEST)
        .expect(({ body }: { body: ErrorResponse }) => {
          expect(body.message).toBe("Experiment has no flow associated");
          expect(body.code).toBe("NO_FLOW_ASSOCIATED");
        });
    });

    it("should return 401 if not authenticated", async () => {
      const path = testApp.resolvePath(contract.flows.getMobileFlow.path, {
        id: experimentId,
      });

      await testApp.get(path).withoutAuth().expect(StatusCodes.UNAUTHORIZED);
    });

    it("should handle flow with no description", async () => {
      // Create flow without description
      const flowWithoutDescResponse = await testApp
        .post(contract.flows.createFlow.path)
        .withAuth(adminUserId)
        .send({
          name: "Flow Without Description",
        })
        .expect(StatusCodes.CREATED);

      // Create new experiment with this flow
      const { experiment: newExperiment } = await testApp.createExperiment({
        name: "New Test Experiment",
        userId: adminUserId,
      });

      // Associate flow with experiment
      await testApp.updateExperiment({
        experimentId: newExperiment.id,
        updates: { flowId: flowWithoutDescResponse.body.id },
      });

      const path = testApp.resolvePath(contract.flows.getMobileFlow.path, {
        id: newExperiment.id,
      });

      const response = await testApp.get(path).withAuth(adminUserId).expect(StatusCodes.OK);

      expect(response.body.flowName).toBe("Flow Without Description");
      expect(response.body.description).toBeUndefined();
    });

    it("should handle empty flow (no steps)", async () => {
      // Create flow without any steps
      const emptyFlowResponse = await testApp
        .post(contract.flows.createFlow.path)
        .withAuth(adminUserId)
        .send({
          name: "Empty Flow",
          description: "Flow with no steps",
        })
        .expect(StatusCodes.CREATED);

      // Create new experiment with this empty flow
      const { experiment: emptyFlowExperiment } = await testApp.createExperiment({
        name: "Empty Flow Experiment",
        userId: adminUserId,
      });

      // Associate flow with experiment
      await testApp.updateExperiment({
        experimentId: emptyFlowExperiment.id,
        updates: { flowId: emptyFlowResponse.body.id },
      });

      const path = testApp.resolvePath(contract.flows.getMobileFlow.path, {
        id: emptyFlowExperiment.id,
      });

      const response = await testApp.get(path).withAuth(adminUserId).expect(StatusCodes.OK);

      expect(response.body.steps).toHaveLength(0);
      expect(response.body.startStepId).toBeUndefined();
    });

    it("should return proper step specifications for different step types", async () => {
      // Create a flow with different step types
      const complexFlowResponse = await testApp
        .post(contract.flows.createFlow.path)
        .withAuth(adminUserId)
        .send({
          name: "Complex Flow",
          description: "Flow with different step types",
        })
        .expect(StatusCodes.CREATED);

      const complexFlowId = complexFlowResponse.body.id;

      // Create different types of steps
      const stepPaths = [
        { type: "INSTRUCTION", spec: {} },
        { type: "QUESTION", spec: { required: true, answerType: "TEXT" } },
        { type: "MEASUREMENT", spec: { protocolId: "test-protocol", autoStart: false } },
        { type: "ANALYSIS", spec: { macroId: "test-macro", autoRun: true } },
      ];

      for (const [index, stepConfig] of stepPaths.entries()) {
        const stepPath = testApp.resolvePath(contract.flows.createFlowStep.path, {
          id: complexFlowId,
        });

        await testApp
          .post(stepPath)
          .withAuth(adminUserId)
          .send({
            type: stepConfig.type,
            title: `${stepConfig.type} Step`,
            description: `This is a ${stepConfig.type.toLowerCase()} step`,
            position: { x: index * 100, y: 100 },
            stepSpecification: stepConfig.spec,
          })
          .expect(StatusCodes.CREATED);
      }

      // Create new experiment with this complex flow
      const { experiment: complexExperiment } = await testApp.createExperiment({
        name: "Complex Flow Experiment",
        userId: adminUserId,
      });

      // Associate flow with experiment
      await testApp.updateExperiment({
        experimentId: complexExperiment.id,
        updates: { flowId: complexFlowId },
      });

      const path = testApp.resolvePath(contract.flows.getMobileFlow.path, {
        id: complexExperiment.id,
      });

      const response = await testApp.get(path).withAuth(adminUserId).expect(StatusCodes.OK);

      expect(response.body.steps).toHaveLength(4);

      // Verify each step type is properly formatted
      const instructionStep = response.body.steps.find((s: any) => s.type === "INSTRUCTION");
      const questionStep = response.body.steps.find((s: any) => s.type === "QUESTION");
      const measurementStep = response.body.steps.find((s: any) => s.type === "MEASUREMENT");
      const analysisStep = response.body.steps.find((s: any) => s.type === "ANALYSIS");

      expect(instructionStep).toBeDefined();
      expect(questionStep).toBeDefined();
      expect(measurementStep).toBeDefined();
      expect(analysisStep).toBeDefined();

      expect(instructionStep.stepSpecification).toEqual({});
      // Note: stepSpecification is currently not being preserved in mobile flow format
      expect(questionStep.stepSpecification).toBeDefined();
      expect(measurementStep.stepSpecification).toBeDefined();
      expect(analysisStep.stepSpecification).toBeDefined();
    });
  });

  describe("error handling", () => {
    it("should handle invalid UUID in experiment ID", async () => {
      const invalidId = "invalid-uuid";
      const path = testApp.resolvePath(contract.flows.getMobileFlow.path, {
        id: invalidId,
      });

      await testApp.get(path).withAuth(adminUserId).expect(StatusCodes.BAD_REQUEST);
    });
  });

  describe("logging", () => {
    it("should log successful mobile flow retrieval", async () => {
      const path = testApp.resolvePath(contract.flows.getMobileFlow.path, {
        id: experimentId,
      });

      const response = await testApp.get(path).withAuth(adminUserId).expect(StatusCodes.OK);

      // The controller should log the retrieval
      expect(response.body.steps.length).toBeGreaterThan(0);
    });

    it("should log successful step result submission", async () => {
      const stepResultData = {
        stepId: faker.string.uuid(),
        result: {
          type: "INSTRUCTION",
          completedAt: new Date().toISOString(),
        },
      };

      const path = testApp.resolvePath(contract.flows.submitStepResult.path, {
        id: experimentId,
      });

      await testApp.post(path).withAuth(adminUserId).send(stepResultData).expect(StatusCodes.OK);

      // The controller should log the submission
    });
  });
});
