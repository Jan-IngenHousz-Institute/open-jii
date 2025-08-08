import { StatusCodes } from "http-status-codes";

import { contract } from "@repo/api";

import { TestHarness } from "../../test/test-harness";

describe("ExperimentFlowsController", () => {
  const testApp = TestHarness.App;
  let ownerId: string;
  let memberId: string;

  beforeAll(async () => {
    await testApp.setup();
  });

  beforeEach(async () => {
    await testApp.beforeEach();
    ownerId = await testApp.createTestUser({});
    memberId = await testApp.createTestUser({});
    jest.restoreAllMocks();
  });

  afterEach(() => {
    testApp.afterEach();
  });

  afterAll(async () => {
    await testApp.teardown();
  });

  describe("GET /api/v1/experiments/:id/flow", () => {
    it("returns 404 when flow not found", async () => {
      const { experiment } = await testApp.createExperiment({ name: "Exp", userId: ownerId });
      const path = testApp.resolvePath(contract.experiments.getFlow.path, { id: experiment.id });
      await testApp.get(path).withAuth(ownerId).expect(StatusCodes.NOT_FOUND);
    });

    it("returns 400 for invalid experiment id", async () => {
      const path = testApp.resolvePath(contract.experiments.getFlow.path, { id: "not-a-uuid" });
      await testApp.get(path).withAuth(ownerId).expect(StatusCodes.BAD_REQUEST);
    });

    it("returns 401 when unauthorized", async () => {
      const { experiment } = await testApp.createExperiment({ name: "Exp", userId: ownerId });
      const path = testApp.resolvePath(contract.experiments.getFlow.path, { id: experiment.id });
      await testApp.get(path).withoutAuth().expect(StatusCodes.UNAUTHORIZED);
    });
  });

  describe("PUT /api/v1/experiments/:id/flow", () => {
    it("creates or updates flow for admin", async () => {
      const { experiment } = await testApp.createExperiment({ name: "Exp", userId: ownerId });
      const path = testApp.resolvePath(contract.experiments.upsertFlow.path, {
        id: experiment.id,
      });
      const body = testApp.sampleFlowGraph({ includeInstruction: true });
      const res = await testApp.put(path).withAuth(ownerId).send(body).expect(StatusCodes.OK);
      const resBody = res.body as { graph: typeof body };
      expect(resBody.graph).toEqual(body);

      // GET should now return the flow
      const getPath = testApp.resolvePath(contract.experiments.getFlow.path, {
        id: experiment.id,
      });
      const getRes = await testApp.get(getPath).withAuth(ownerId).expect(StatusCodes.OK);
      const getResBody = getRes.body as { graph: typeof body };
      expect(getResBody.graph).toEqual(body);
    });

    it("forbids non-admin members", async () => {
      const { experiment } = await testApp.createExperiment({ name: "Exp", userId: ownerId });
      // Add non-admin member
      await testApp.addExperimentMember(experiment.id, memberId, "member");

      const path = testApp.resolvePath(contract.experiments.upsertFlow.path, {
        id: experiment.id,
      });
      await testApp
        .put(path)
        .withAuth(memberId)
        .send(testApp.sampleFlowGraph({ includeInstruction: true }))
        .expect(StatusCodes.FORBIDDEN);
    });

    it("requires auth", async () => {
      const { experiment } = await testApp.createExperiment({ name: "Exp", userId: ownerId });
      const path = testApp.resolvePath(contract.experiments.upsertFlow.path, {
        id: experiment.id,
      });
      await testApp
        .put(path)
        .withoutAuth()
        .send(testApp.sampleFlowGraph({ includeInstruction: true }))
        .expect(StatusCodes.UNAUTHORIZED);
    });

    it("returns 400 for invalid body", async () => {
      const { experiment } = await testApp.createExperiment({ name: "Exp", userId: ownerId });
      const path = testApp.resolvePath(contract.experiments.upsertFlow.path, {
        id: experiment.id,
      });
      const invalidBody = { nodes: [] }; // missing edges
      await testApp.put(path).withAuth(ownerId).send(invalidBody).expect(StatusCodes.BAD_REQUEST);
    });

    it("returns 404 when experiment does not exist", async () => {
      const nonExistentId = "00000000-0000-0000-0000-000000000000";
      const path = testApp.resolvePath(contract.experiments.upsertFlow.path, {
        id: nonExistentId,
      });
      await testApp
        .put(path)
        .withAuth(ownerId)
        .send(testApp.sampleFlowGraph({ includeInstruction: true }))
        .expect(StatusCodes.NOT_FOUND);
    });
  });
});
