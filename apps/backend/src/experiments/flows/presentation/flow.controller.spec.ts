import { StatusCodes } from "http-status-codes";

import { contract } from "@repo/api";

import { TestHarness } from "../../../test/test-harness";

describe("FlowController", () => {
  const testApp = TestHarness.App;
  let testUserId: string;

  beforeAll(async () => {
    await testApp.setup();
  });

  beforeEach(async () => {
    await testApp.beforeEach();
    testUserId = await testApp.createTestUser({});
  });

  afterEach(() => {
    testApp.afterEach();
  });

  afterAll(async () => {
    await testApp.teardown();
  });

  describe("createFlowWithSteps", () => {
    it("should successfully create a flow with steps", async () => {
      // Create a test experiment first
      const { experiment } = await testApp.createExperiment({
        userId: testUserId,
        name: "Test Experiment",
      });

      const flowData = {
        name: "Test Flow",
        description: "Test Description",
        experimentId: experiment.id,
        steps: [
          {
            type: "INSTRUCTION" as const,
            title: "Welcome Step",
            description: "Welcome to the flow",
            position: { x: 0, y: 0 },
            isStartNode: true,
            stepSpecification: {},
          },
          {
            type: "QUESTION" as const,
            title: "Test Question",
            description: "Please answer this question",
            position: { x: 200, y: 0 },
            isEndNode: true,
            stepSpecification: {
              required: true,
              answerType: "TEXT" as const,
              placeholder: "Enter your answer",
            },
          },
        ],
        connections: [],
      };

      const response = await testApp
        .post(contract.flows.createFlowWithSteps.path)
        .withAuth(testUserId)
        .send(flowData)
        .expect(StatusCodes.CREATED);

      expect(response.body).toHaveProperty("id");
      expect(response.body).toHaveProperty("name", flowData.name);
      expect(response.body).toHaveProperty("description", flowData.description);
      expect(response.body).toHaveProperty("steps");
      expect(response.body).toHaveProperty("connections");
      expect(response.body.steps).toHaveLength(2);
    });

    it("should return 400 if name is missing", async () => {
      await testApp
        .post(contract.flows.createFlowWithSteps.path)
        .withAuth(testUserId)
        .send({
          description: "Missing name",
          steps: [],
          connections: [],
        })
        .expect(StatusCodes.BAD_REQUEST);
    });

    it("should return 401 if not authenticated", async () => {
      await testApp
        .post(contract.flows.createFlowWithSteps.path)
        .withoutAuth()
        .send({
          name: "Unauthorized Flow",
          description: "This should fail",
          steps: [],
          connections: [],
        })
        .expect(StatusCodes.UNAUTHORIZED);
    });
  });

  describe("getFlowByExperiment", () => {
    let testExperimentId: string;

    beforeEach(async () => {
      // Create a test experiment first
      const experimentResponse = await testApp
        .post(contract.experiments.createExperiment.path)
        .withAuth(testUserId)
        .send({
          name: "Test Experiment for Flow",
          description: "Test Description",
          status: "provisioning",
          visibility: "private",
          embargoIntervalDays: 90,
        });

      testExperimentId = experimentResponse.body.id;
    });

    it("should return a flow for an experiment", async () => {
      // First create a flow with steps for the experiment
      const flowData = {
        name: "Mobile Test Flow",
        description: "Test Description",
        experimentId: testExperimentId,
        steps: [
          {
            type: "INSTRUCTION" as const,
            title: "Mobile Step",
            description: "Mobile instruction",
            position: { x: 0, y: 0 },
            isStartNode: true,
            stepSpecification: {},
          },
        ],
        connections: [],
      };

      await testApp
        .post(contract.flows.createFlowWithSteps.path)
        .withAuth(testUserId)
        .send(flowData);

      const response = await testApp
        .get(contract.flows.getFlowByExperiment.path.replace(":id", testExperimentId))
        .withAuth(testUserId)
        .expect(StatusCodes.OK);

      expect(response.body).toHaveProperty("id");
      expect(response.body).toHaveProperty("name");
      expect(response.body).toHaveProperty("steps");
      expect(Array.isArray(response.body.steps)).toBe(true);
    });

    it("should return 404 if experiment does not exist", async () => {
      const nonExistentId = "00000000-0000-0000-0000-000000000000";

      await testApp
        .get(contract.flows.getFlowByExperiment.path.replace(":id", nonExistentId))
        .withAuth(testUserId)
        .expect(StatusCodes.NOT_FOUND);
    });

    it("should return 401 if not authenticated", async () => {
      await testApp
        .get(contract.flows.getFlowByExperiment.path.replace(":id", testExperimentId))
        .withoutAuth()
        .expect(StatusCodes.UNAUTHORIZED);
    });
  });

  describe("listFlows", () => {
    it("should return an empty array if no flows exist", async () => {
      const response = await testApp
        .get(contract.flows.listFlows.path)
        .withAuth(testUserId)
        .expect(StatusCodes.OK);

      expect(Array.isArray(response.body)).toBe(true);
      expect(response.body).toHaveLength(0);
    });

    it("should return a list of flows", async () => {
      // Create test experiments first
      const { experiment: experiment1 } = await testApp.createExperiment({
        userId: testUserId,
        name: "Test Experiment 1",
      });

      const { experiment: experiment2 } = await testApp.createExperiment({
        userId: testUserId,
        name: "Test Experiment 2",
      });

      // Create a few test flows
      const flowData1 = {
        name: "Test Flow 1",
        description: "First test flow",
        experimentId: experiment1.id,
        steps: [
          {
            type: "INSTRUCTION" as const,
            title: "Step 1",
            position: { x: 0, y: 0 },
            isStartNode: true,
            stepSpecification: {},
          },
        ],
        connections: [],
      };

      const flowData2 = {
        name: "Test Flow 2",
        description: "Second test flow",
        experimentId: experiment2.id,
        steps: [
          {
            type: "QUESTION" as const,
            title: "Question Step",
            position: { x: 0, y: 0 },
            isStartNode: true,
            stepSpecification: {
              required: true,
              answerType: "TEXT" as const,
            },
          },
        ],
        connections: [],
      };

      await testApp
        .post(contract.flows.createFlowWithSteps.path)
        .withAuth(testUserId)
        .send(flowData1);

      await testApp
        .post(contract.flows.createFlowWithSteps.path)
        .withAuth(testUserId)
        .send(flowData2);

      const response = await testApp
        .get(contract.flows.listFlows.path)
        .withAuth(testUserId)
        .expect(StatusCodes.OK);

      expect(Array.isArray(response.body)).toBe(true);
      expect(response.body.length).toBeGreaterThanOrEqual(2);
      expect(response.body[0]).toHaveProperty("id");
      expect(response.body[0]).toHaveProperty("name");
    });

    it("should return 401 if not authenticated", async () => {
      await testApp
        .get(contract.flows.listFlows.path)
        .withoutAuth()
        .expect(StatusCodes.UNAUTHORIZED);
    });
  });

  describe("updateFlowWithSteps", () => {
    let testFlowId: string;

    beforeEach(async () => {
      // Create a test experiment first
      const { experiment } = await testApp.createExperiment({
        userId: testUserId,
        name: "Test Experiment for Update",
      });

      // Create a test flow first
      const flowData = {
        name: "Test Flow for Update",
        description: "Original description",
        experimentId: experiment.id,
        steps: [
          {
            type: "INSTRUCTION" as const,
            title: "Original Step",
            position: { x: 0, y: 0 },
            isStartNode: true,
            stepSpecification: {},
          },
        ],
        connections: [],
      };

      const response = await testApp
        .post(contract.flows.createFlowWithSteps.path)
        .withAuth(testUserId)
        .send(flowData);

      testFlowId = response.body.id;
    });

    it("should update a flow successfully", async () => {
      const updateData = {
        flow: {
          name: "Updated Flow Name",
          description: "Updated description",
        },
        steps: {
          create: [
            {
              type: "QUESTION" as const,
              title: "New Question Step",
              position: { x: 200, y: 0 },
              stepSpecification: {
                required: true,
                answerType: "TEXT" as const,
              },
            },
          ],
        },
      };

      const response = await testApp
        .patch(contract.flows.updateFlowWithSteps.path.replace(":id", testFlowId))
        .withAuth(testUserId)
        .send(updateData)
        .expect(StatusCodes.OK);

      expect(response.body).toHaveProperty("id", testFlowId);
      expect(response.body).toHaveProperty("name", "Updated Flow Name");
      expect(response.body).toHaveProperty("description", "Updated description");
      expect(response.body.steps).toHaveLength(2); // Original + new step
    });

    it("should return 404 if flow does not exist", async () => {
      const nonExistentId = "00000000-0000-0000-0000-000000000000";

      await testApp
        .patch(contract.flows.updateFlowWithSteps.path.replace(":id", nonExistentId))
        .withAuth(testUserId)
        .send({
          flow: { name: "Updated Name" },
        })
        .expect(StatusCodes.NOT_FOUND);
    });

    it("should return 401 if not authenticated", async () => {
      await testApp
        .patch(contract.flows.updateFlowWithSteps.path.replace(":id", testFlowId))
        .withoutAuth()
        .send({
          flow: { name: "Updated Name" },
        })
        .expect(StatusCodes.UNAUTHORIZED);
    });
  });
});
