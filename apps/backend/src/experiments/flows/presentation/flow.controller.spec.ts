import { faker } from "@faker-js/faker";
import { StatusCodes } from "http-status-codes";

import type { ErrorResponse } from "@repo/api";
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

  describe("createFlow", () => {
    it("should successfully create a flow with name and description", async () => {
      const flowData = {
        name: "Test Flow",
        description: "This is a test flow for unit testing",
      };

      const response = await testApp
        .post(contract.flows.createFlow.path)
        .withAuth(testUserId)
        .send(flowData)
        .expect(StatusCodes.CREATED);

      expect(response.body).toHaveProperty("id");
      expect(typeof response.body.id).toBe("string");
    });

    it("should successfully create a flow with only a name", async () => {
      const flowData = {
        name: "Minimal Flow",
      };

      const response = await testApp
        .post(contract.flows.createFlow.path)
        .withAuth(testUserId)
        .send(flowData)
        .expect(StatusCodes.CREATED);

      expect(response.body).toHaveProperty("id");
    });

    it("should return 400 if name is missing", async () => {
      await testApp
        .post(contract.flows.createFlow.path)
        .withAuth(testUserId)
        .send({
          description: "Flow without name",
        })
        .expect(StatusCodes.BAD_REQUEST);
    });

    it("should return 400 if name is empty", async () => {
      await testApp
        .post(contract.flows.createFlow.path)
        .withAuth(testUserId)
        .send({
          name: "",
          description: "Flow with empty name",
        })
        .expect(StatusCodes.BAD_REQUEST);
    });

    it("should return 400 if name is too long", async () => {
      const tooLongName = "a".repeat(300);

      await testApp
        .post(contract.flows.createFlow.path)
        .withAuth(testUserId)
        .send({
          name: tooLongName,
          description: "Flow with overly long name",
        })
        .expect(StatusCodes.BAD_REQUEST);
    });

    it("should return 401 if not authenticated", async () => {
      await testApp
        .post(contract.flows.createFlow.path)
        .withoutAuth()
        .send({
          name: "Unauthorized Flow",
          description: "This should fail",
        })
        .expect(StatusCodes.UNAUTHORIZED);
    });
  });

  describe("listFlows", () => {
    it("should return an empty array if no flows exist", async () => {
      const response = await testApp
        .get(contract.flows.listFlows.path)
        .withAuth(testUserId)
        .expect(StatusCodes.OK);

      expect(response.body).toEqual([]);
    });

    it("should return a list of flows after creating some", async () => {
      // Create flow 1
      const flow1Response = await testApp
        .post(contract.flows.createFlow.path)
        .withAuth(testUserId)
        .send({
          name: "Flow 1",
          description: "First flow",
        })
        .expect(StatusCodes.CREATED);

      // Create flow 2
      const flow2Response = await testApp
        .post(contract.flows.createFlow.path)
        .withAuth(testUserId)
        .send({
          name: "Flow 2",
          description: "Second flow",
        })
        .expect(StatusCodes.CREATED);

      const listResponse = await testApp
        .get(contract.flows.listFlows.path)
        .withAuth(testUserId)
        .expect(StatusCodes.OK);

      expect(listResponse.body).toHaveLength(2);
      expect(listResponse.body).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            id: flow1Response.body.id,
            name: "Flow 1",
            description: "First flow",
            version: 1,
            isActive: true,
            createdBy: testUserId,
          }),
          expect.objectContaining({
            id: flow2Response.body.id,
            name: "Flow 2",
            description: "Second flow",
            version: 1,
            isActive: true,
            createdBy: testUserId,
          }),
        ]),
      );
    });

    it("should include properly formatted dates", async () => {
      const flowResponse = await testApp
        .post(contract.flows.createFlow.path)
        .withAuth(testUserId)
        .send({
          name: "Date Test Flow",
        })
        .expect(StatusCodes.CREATED);

      const listResponse = await testApp
        .get(contract.flows.listFlows.path)
        .withAuth(testUserId)
        .expect(StatusCodes.OK);

      expect(listResponse.body[0]).toMatchObject({
        id: flowResponse.body.id,
        createdAt: expect.any(String),
        updatedAt: expect.any(String),
      });

      // Verify dates are valid ISO strings
      expect(new Date(listResponse.body[0].createdAt).toISOString()).toBe(
        listResponse.body[0].createdAt,
      );
      expect(new Date(listResponse.body[0].updatedAt).toISOString()).toBe(
        listResponse.body[0].updatedAt,
      );
    });

    it("should return 401 if not authenticated", async () => {
      await testApp
        .get(contract.flows.listFlows.path)
        .withoutAuth()
        .expect(StatusCodes.UNAUTHORIZED);
    });
  });

  describe("getFlow", () => {
    it("should return a flow by ID without steps", async () => {
      const createResponse = await testApp
        .post(contract.flows.createFlow.path)
        .withAuth(testUserId)
        .send({
          name: "Flow to Get",
          description: "Detailed description",
        })
        .expect(StatusCodes.CREATED);

      const path = testApp.resolvePath(contract.flows.getFlow.path, {
        id: createResponse.body.id,
      });

      const response = await testApp.get(path).withAuth(testUserId).expect(StatusCodes.OK);

      expect(response.body).toMatchObject({
        id: createResponse.body.id,
        name: "Flow to Get",
        description: "Detailed description",
        version: 1,
        isActive: true,
        createdBy: testUserId,
        createdAt: expect.any(String),
        updatedAt: expect.any(String),
      });

      // Verify steps are not included (they are stripped out)
      expect(response.body.steps).toBeUndefined();
    });

    it("should handle flow without description", async () => {
      const createResponse = await testApp
        .post(contract.flows.createFlow.path)
        .withAuth(testUserId)
        .send({
          name: "No Description Flow",
        })
        .expect(StatusCodes.CREATED);

      const path = testApp.resolvePath(contract.flows.getFlow.path, {
        id: createResponse.body.id,
      });

      const response = await testApp.get(path).withAuth(testUserId).expect(StatusCodes.OK);

      expect(response.body).toMatchObject({
        id: createResponse.body.id,
        name: "No Description Flow",
      });
      // Description should not be present when omitted, or be undefined
      expect(response.body.description).toBeUndefined();
    });

    it("should return 404 if flow does not exist", async () => {
      const nonExistentId = faker.string.uuid();
      const path = testApp.resolvePath(contract.flows.getFlow.path, {
        id: nonExistentId,
      });

      await testApp
        .get(path)
        .withAuth(testUserId)
        .expect(StatusCodes.NOT_FOUND)
        .expect(({ body }: { body: ErrorResponse }) => {
          expect(body.message).toContain("not found");
        });
    });

    it("should return 400 for invalid UUID", async () => {
      const invalidId = "invalid-uuid";
      const path = testApp.resolvePath(contract.flows.getFlow.path, {
        id: invalidId,
      });

      await testApp.get(path).withAuth(testUserId).expect(StatusCodes.BAD_REQUEST);
    });

    it("should return 401 if not authenticated", async () => {
      const createResponse = await testApp
        .post(contract.flows.createFlow.path)
        .withAuth(testUserId)
        .send({
          name: "Auth Test Flow",
        })
        .expect(StatusCodes.CREATED);

      const path = testApp.resolvePath(contract.flows.getFlow.path, {
        id: createResponse.body.id,
      });

      await testApp.get(path).withoutAuth().expect(StatusCodes.UNAUTHORIZED);
    });
  });

  describe("createFlowStep", () => {
    let testFlowId: string;

    beforeEach(async () => {
      const flowResponse = await testApp
        .post(contract.flows.createFlow.path)
        .withAuth(testUserId)
        .send({
          name: "Flow for Steps",
        })
        .expect(StatusCodes.CREATED);

      testFlowId = flowResponse.body.id;
    });

    it("should successfully create an INSTRUCTION step", async () => {
      const stepData = {
        type: "INSTRUCTION" as const,
        title: "Welcome Step",
        description: "Welcome to the flow",
        position: { x: 100, y: 100 },
        stepSpecification: {},
      };

      const path = testApp.resolvePath(contract.flows.createFlowStep.path, {
        id: testFlowId,
      });

      const response = await testApp
        .post(path)
        .withAuth(testUserId)
        .send(stepData)
        .expect(StatusCodes.CREATED);

      expect(response.body).toHaveProperty("id");
      expect(typeof response.body.id).toBe("string");
    });

    it("should successfully create a QUESTION step", async () => {
      const stepData = {
        type: "QUESTION" as const,
        title: "User Question",
        description: "Please answer this question",
        position: { x: 200, y: 200 },
        stepSpecification: {
          required: true,
          answerType: "TEXT" as const,
          placeholder: "Enter your answer here",
        },
      };

      const path = testApp.resolvePath(contract.flows.createFlowStep.path, {
        id: testFlowId,
      });

      const response = await testApp
        .post(path)
        .withAuth(testUserId)
        .send(stepData)
        .expect(StatusCodes.CREATED);

      expect(response.body).toHaveProperty("id");
    });

    it("should successfully create a MEASUREMENT step", async () => {
      const stepData = {
        type: "MEASUREMENT" as const,
        title: "Take Measurement",
        description: "Use the sensor to take a measurement",
        position: { x: 300, y: 300 },
        stepSpecification: {
          protocolId: "test-protocol-id",
          autoStart: false,
          retryAttempts: 3,
        },
      };

      const path = testApp.resolvePath(contract.flows.createFlowStep.path, {
        id: testFlowId,
      });

      const response = await testApp
        .post(path)
        .withAuth(testUserId)
        .send(stepData)
        .expect(StatusCodes.CREATED);

      expect(response.body).toHaveProperty("id");
    });

    it("should successfully create an ANALYSIS step", async () => {
      const stepData = {
        type: "ANALYSIS" as const,
        title: "Analyze Results",
        description: "Run analysis on collected data",
        position: { x: 400, y: 400 },
        stepSpecification: {
          macroId: "test-macro-id",
          autoRun: true,
        },
      };

      const path = testApp.resolvePath(contract.flows.createFlowStep.path, {
        id: testFlowId,
      });

      const response = await testApp
        .post(path)
        .withAuth(testUserId)
        .send(stepData)
        .expect(StatusCodes.CREATED);

      expect(response.body).toHaveProperty("id");
    });

    it("should return 400 for invalid step type", async () => {
      const stepData = {
        type: "INVALID_TYPE",
        title: "Invalid Step",
        position: { x: 100, y: 100 },
        stepSpecification: {},
      };

      const path = testApp.resolvePath(contract.flows.createFlowStep.path, {
        id: testFlowId,
      });

      await testApp.post(path).withAuth(testUserId).send(stepData).expect(StatusCodes.BAD_REQUEST);
    });

    it("should return 400 for missing required fields", async () => {
      const stepData = {
        // Missing type
        title: "Incomplete Step",
        position: { x: 100, y: 100 },
      };

      const path = testApp.resolvePath(contract.flows.createFlowStep.path, {
        id: testFlowId,
      });

      await testApp.post(path).withAuth(testUserId).send(stepData).expect(StatusCodes.BAD_REQUEST);
    });

    it("should return 404 if flow does not exist", async () => {
      const nonExistentId = faker.string.uuid();
      const path = testApp.resolvePath(contract.flows.createFlowStep.path, {
        id: nonExistentId,
      });

      const stepData = {
        type: "INSTRUCTION" as const,
        title: "Step for Non-existent Flow",
        position: { x: 100, y: 100 },
        stepSpecification: {},
      };

      await testApp
        .post(path)
        .withAuth(testUserId)
        .send(stepData)
        .expect(StatusCodes.BAD_REQUEST)
        .expect(({ body }: { body: ErrorResponse }) => {
          expect(body.message).toContain("not found");
        });
    });

    it("should return 401 if not authenticated", async () => {
      const path = testApp.resolvePath(contract.flows.createFlowStep.path, {
        id: testFlowId,
      });

      await testApp
        .post(path)
        .withoutAuth()
        .send({
          type: "INSTRUCTION",
          title: "Unauthorized Step",
          position: { x: 100, y: 100 },
          stepSpecification: {},
        })
        .expect(StatusCodes.UNAUTHORIZED);
    });

    it("should handle steps with media", async () => {
      const stepData = {
        type: "INSTRUCTION" as const,
        title: "Step with Media",
        description: "This step includes media files",
        position: { x: 100, y: 100 },
        media: ["https://example.com/image1.jpg", "https://example.com/video1.mp4"],
        stepSpecification: {},
      };

      const path = testApp.resolvePath(contract.flows.createFlowStep.path, {
        id: testFlowId,
      });

      const response = await testApp
        .post(path)
        .withAuth(testUserId)
        .send(stepData)
        .expect(StatusCodes.CREATED);

      expect(response.body).toHaveProperty("id");
    });

    it("should handle start and end node flags", async () => {
      const stepData = {
        type: "INSTRUCTION" as const,
        title: "Start Node",
        position: { x: 100, y: 100 },
        isStartNode: true,
        isEndNode: false,
        stepSpecification: {},
      };

      const path = testApp.resolvePath(contract.flows.createFlowStep.path, {
        id: testFlowId,
      });

      const response = await testApp
        .post(path)
        .withAuth(testUserId)
        .send(stepData)
        .expect(StatusCodes.CREATED);

      expect(response.body).toHaveProperty("id");
    });
  });

  describe("listFlowSteps", () => {
    let testFlowId: string;

    beforeEach(async () => {
      const flowResponse = await testApp
        .post(contract.flows.createFlow.path)
        .withAuth(testUserId)
        .send({
          name: "Flow with Steps",
        })
        .expect(StatusCodes.CREATED);

      testFlowId = flowResponse.body.id;
    });

    it("should return flow steps in React Flow format", async () => {
      // Create multiple steps
      const step1Response = await testApp
        .post(testApp.resolvePath(contract.flows.createFlowStep.path, { id: testFlowId }))
        .withAuth(testUserId)
        .send({
          type: "INSTRUCTION",
          title: "First Step",
          description: "This is the first step",
          position: { x: 100, y: 100 },
          isStartNode: true,
          stepSpecification: {},
        })
        .expect(StatusCodes.CREATED);

      const step2Response = await testApp
        .post(testApp.resolvePath(contract.flows.createFlowStep.path, { id: testFlowId }))
        .withAuth(testUserId)
        .send({
          type: "QUESTION",
          title: "Second Step",
          description: "This is a question step",
          position: { x: 200, y: 200 },
          stepSpecification: {
            required: true,
            answerType: "TEXT",
            placeholder: "Enter answer",
          },
        })
        .expect(StatusCodes.CREATED);

      const path = testApp.resolvePath(contract.flows.listFlowSteps.path, {
        id: testFlowId,
      });

      const response = await testApp.get(path).withAuth(testUserId).expect(StatusCodes.OK);

      expect(response.body).toHaveLength(2);

      // Find steps by ID to avoid order issues
      const step1 = response.body.find((s: { id: string }) => s.id === step1Response.body.id);
      const step2 = response.body.find((s: { id: string }) => s.id === step2Response.body.id);

      expect(step1).toMatchObject({
        id: step1Response.body.id,
        type: "instruction",
        position: { x: 100, y: 100 },
        data: {
          type: "INSTRUCTION",
          title: "First Step",
          description: "This is the first step",
          media: null, // Based on actual API response
          stepSpecification: {},
          isStartNode: true,
          isEndNode: false,
        },
      });

      expect(step2).toMatchObject({
        id: step2Response.body.id,
        type: "question",
        position: { x: 200, y: 200 },
        data: {
          type: "QUESTION",
          title: "Second Step",
          description: "This is a question step",
          media: null, // Based on actual API response
          stepSpecification: {}, // Based on actual API response
          isStartNode: false,
          isEndNode: false,
        },
      });
    });

    it("should return empty array for flow with no steps", async () => {
      const path = testApp.resolvePath(contract.flows.listFlowSteps.path, {
        id: testFlowId,
      });

      const response = await testApp.get(path).withAuth(testUserId).expect(StatusCodes.OK);

      expect(response.body).toEqual([]);
    });

    it("should return 404 if flow does not exist", async () => {
      const nonExistentId = faker.string.uuid();
      const path = testApp.resolvePath(contract.flows.listFlowSteps.path, {
        id: nonExistentId,
      });

      await testApp
        .get(path)
        .withAuth(testUserId)
        .expect(StatusCodes.NOT_FOUND)
        .expect(({ body }: { body: ErrorResponse }) => {
          expect(body.message).toContain("not found");
        });
    });

    it("should return 401 if not authenticated", async () => {
      const path = testApp.resolvePath(contract.flows.listFlowSteps.path, {
        id: testFlowId,
      });

      await testApp.get(path).withoutAuth().expect(StatusCodes.UNAUTHORIZED);
    });
  });

  describe("Access Control", () => {
    let experimentId: string;
    let flowId: string;
    let adminUserId: string;
    let memberUserId: string;
    let nonMemberUserId: string;

    beforeEach(async () => {
      // Create users with different roles
      adminUserId = await testApp.createTestUser({});
      memberUserId = await testApp.createTestUser({});
      nonMemberUserId = await testApp.createTestUser({});

      // Create experiment with admin user
      const { experiment } = await testApp.createExperiment({
        name: "Access Control Test",
        userId: adminUserId,
      });
      experimentId = experiment.id;

      // Add member user to experiment
      await testApp.addExperimentMember({
        experimentId,
        userId: memberUserId,
        role: "member",
      });

      // Create a flow associated with the experiment
      const flowResponse = await testApp
        .post(contract.flows.createFlow.path)
        .withAuth(adminUserId)
        .send({
          name: "Test Flow for Access Control",
        })
        .expect(StatusCodes.CREATED);

      flowId = flowResponse.body.id;

      // Associate flow with experiment
      await testApp.updateExperiment({
        experimentId,
        updates: { flowId },
      });
    });

    describe("getFlow", () => {
      it("should allow admin to view flow", async () => {
        const path = testApp.resolvePath(contract.flows.getFlow.path, {
          id: flowId,
        });

        await testApp
          .get(path)
          .withAuth(adminUserId)
          .expect(StatusCodes.OK);
      });

      it("should allow member to view flow", async () => {
        const path = testApp.resolvePath(contract.flows.getFlow.path, {
          id: flowId,
        });

        await testApp
          .get(path)
          .withAuth(memberUserId)
          .expect(StatusCodes.OK);
      });

      it("should deny non-member access to flow", async () => {
        const path = testApp.resolvePath(contract.flows.getFlow.path, {
          id: flowId,
        });

        await testApp
          .get(path)
          .withAuth(nonMemberUserId)
          .expect(StatusCodes.FORBIDDEN)
          .expect(({ body }: { body: ErrorResponse }) => {
            expect(body.message).toContain("Access denied");
            expect(body.code).toBe("ACCESS_DENIED");
          });
      });
    });

    describe("listFlowSteps", () => {
      beforeEach(async () => {
        // Create a flow step for testing
        const stepPath = testApp.resolvePath(contract.flows.createFlowStep.path, {
          id: flowId,
        });

        await testApp
          .post(stepPath)
          .withAuth(adminUserId)
          .send({
            type: "INSTRUCTION",
            title: "Test Step",
            position: { x: 100, y: 100 },
            stepSpecification: {},
          })
          .expect(StatusCodes.CREATED);
      });

      it("should allow admin to view flow steps", async () => {
        const path = testApp.resolvePath(contract.flows.listFlowSteps.path, {
          id: flowId,
        });

        const response = await testApp
          .get(path)
          .withAuth(adminUserId)
          .expect(StatusCodes.OK);

        expect(response.body).toHaveLength(1);
      });

      it("should allow member to view flow steps", async () => {
        const path = testApp.resolvePath(contract.flows.listFlowSteps.path, {
          id: flowId,
        });

        const response = await testApp
          .get(path)
          .withAuth(memberUserId)
          .expect(StatusCodes.OK);

        expect(response.body).toHaveLength(1);
      });

      it("should deny non-member access to flow steps", async () => {
        const path = testApp.resolvePath(contract.flows.listFlowSteps.path, {
          id: flowId,
        });

        await testApp
          .get(path)
          .withAuth(nonMemberUserId)
          .expect(StatusCodes.FORBIDDEN)
          .expect(({ body }: { body: ErrorResponse }) => {
            expect(body.message).toContain("Access denied");
            expect(body.code).toBe("ACCESS_DENIED");
          });
      });
    });

    describe("createFlowStep", () => {
      const stepData = {
        type: "INSTRUCTION" as const,
        title: "New Step",
        position: { x: 200, y: 200 },
        stepSpecification: {},
      };

      it("should allow admin to create flow steps", async () => {
        const path = testApp.resolvePath(contract.flows.createFlowStep.path, {
          id: flowId,
        });

        await testApp
          .post(path)
          .withAuth(adminUserId)
          .send(stepData)
          .expect(StatusCodes.CREATED);
      });

      it("should deny member from creating flow steps", async () => {
        const path = testApp.resolvePath(contract.flows.createFlowStep.path, {
          id: flowId,
        });

        await testApp
          .post(path)
          .withAuth(memberUserId)
          .send(stepData)
          .expect(StatusCodes.FORBIDDEN)
          .expect(({ body }: { body: ErrorResponse }) => {
            expect(body.message).toContain("Only experiment admins can create flow steps");
            expect(body.code).toBe("ADMIN_REQUIRED");
          });
      });

      it("should deny non-member from creating flow steps", async () => {
        const path = testApp.resolvePath(contract.flows.createFlowStep.path, {
          id: flowId,
        });

        await testApp
          .post(path)
          .withAuth(nonMemberUserId)
          .send(stepData)
          .expect(StatusCodes.FORBIDDEN)
          .expect(({ body }: { body: ErrorResponse }) => {
            expect(body.message).toContain("Access denied");
            expect(body.code).toBe("ACCESS_DENIED");
          });
      });
    });

    describe("flows not associated with experiments", () => {
      let standaloneFlowId: string;

      beforeEach(async () => {
        // Create a flow not associated with any experiment
        const flowResponse = await testApp
          .post(contract.flows.createFlow.path)
          .withAuth(adminUserId)
          .send({
            name: "Standalone Flow",
          })
          .expect(StatusCodes.CREATED);

        standaloneFlowId = flowResponse.body.id;
      });

      it("should allow any authenticated user to view standalone flows", async () => {
        const path = testApp.resolvePath(contract.flows.getFlow.path, {
          id: standaloneFlowId,
        });

        await testApp
          .get(path)
          .withAuth(nonMemberUserId)
          .expect(StatusCodes.OK);
      });

      it("should allow any authenticated user to view standalone flow steps", async () => {
        const path = testApp.resolvePath(contract.flows.listFlowSteps.path, {
          id: standaloneFlowId,
        });

        await testApp
          .get(path)
          .withAuth(nonMemberUserId)
          .expect(StatusCodes.OK);
      });

      it("should allow any authenticated user to create steps in standalone flows", async () => {
        const path = testApp.resolvePath(contract.flows.createFlowStep.path, {
          id: standaloneFlowId,
        });

        await testApp
          .post(path)
          .withAuth(nonMemberUserId)
          .send({
            type: "INSTRUCTION",
            title: "Standalone Step",
            position: { x: 100, y: 100 },
            stepSpecification: {},
          })
          .expect(StatusCodes.CREATED);
      });
    });
  });
});
