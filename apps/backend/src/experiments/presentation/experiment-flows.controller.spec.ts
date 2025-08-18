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
    vi.restoreAllMocks();
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

  describe("POST /api/v1/experiments/:id/flow", () => {
    it("creates flow for admin", async () => {
      const { experiment } = await testApp.createExperiment({ name: "Exp", userId: ownerId });
      const path = testApp.resolvePath(contract.experiments.createFlow.path, {
        id: experiment.id,
      });
      const body = testApp.sampleFlowGraph({ includeInstruction: true });
      const res = await testApp.post(path).withAuth(ownerId).send(body).expect(StatusCodes.CREATED);
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

    it("allows non-admin members to create", async () => {
      const { experiment } = await testApp.createExperiment({ name: "Exp", userId: ownerId });
      await testApp.addExperimentMember(experiment.id, memberId, "member");
      const path = testApp.resolvePath(contract.experiments.createFlow.path, { id: experiment.id });
      await testApp
        .post(path)
        .withAuth(memberId)
        .send(testApp.sampleFlowGraph({ includeInstruction: true }))
        .expect(StatusCodes.CREATED);
    });

    it("requires auth", async () => {
      const { experiment } = await testApp.createExperiment({ name: "Exp", userId: ownerId });
      const path = testApp.resolvePath(contract.experiments.createFlow.path, {
        id: experiment.id,
      });
      await testApp
        .post(path)
        .withoutAuth()
        .send(testApp.sampleFlowGraph({ includeInstruction: true }))
        .expect(StatusCodes.UNAUTHORIZED);
    });

    it("returns 400 for invalid body", async () => {
      const { experiment } = await testApp.createExperiment({ name: "Exp", userId: ownerId });
      const path = testApp.resolvePath(contract.experiments.createFlow.path, {
        id: experiment.id,
      });
      const invalidBody = { nodes: [] }; // missing edges
      await testApp.post(path).withAuth(ownerId).send(invalidBody).expect(StatusCodes.BAD_REQUEST);
    });

    it("returns 400 when no nodes are provided", async () => {
      const { experiment } = await testApp.createExperiment({ name: "Exp", userId: ownerId });
      const path = testApp.resolvePath(contract.experiments.createFlow.path, {
        id: experiment.id,
      });
      const invalidGraph = { nodes: [] as unknown[], edges: [] as unknown[] };
      await testApp.post(path).withAuth(ownerId).send(invalidGraph).expect(StatusCodes.BAD_REQUEST);
    });

    it("returns 400 when nodes exist but none is a start node", async () => {
      const { experiment } = await testApp.createExperiment({ name: "Exp", userId: ownerId });
      const path = testApp.resolvePath(contract.experiments.createFlow.path, {
        id: experiment.id,
      });
      const badGraph = {
        nodes: [
          {
            id: "n1",
            type: "question" as const,
            name: "Q1",
            content: { kind: "yes_no" as const, text: "Q1" },
            // isStart omitted -> false by default
          },
        ],
        edges: [],
      };
      await testApp.post(path).withAuth(ownerId).send(badGraph).expect(StatusCodes.BAD_REQUEST);
    });

    it("returns 404 when experiment does not exist", async () => {
      const nonExistentId = "00000000-0000-0000-0000-000000000000";
      const path = testApp.resolvePath(contract.experiments.createFlow.path, {
        id: nonExistentId,
      });
      await testApp
        .post(path)
        .withAuth(ownerId)
        .send(testApp.sampleFlowGraph({ includeInstruction: true }))
        .expect(StatusCodes.NOT_FOUND);
    });
  });

  describe("PUT /api/v1/experiments/:id/flow", () => {
    it("updates flow for admin", async () => {
      const { experiment } = await testApp.createExperiment({ name: "Exp", userId: ownerId });
      // create first
      const createPath = testApp.resolvePath(contract.experiments.createFlow.path, {
        id: experiment.id,
      });
      const body = testApp.sampleFlowGraph({ includeInstruction: true });
      await testApp.post(createPath).withAuth(ownerId).send(body).expect(StatusCodes.CREATED);

      const updatePath = testApp.resolvePath(contract.experiments.updateFlow.path, {
        id: experiment.id,
      });
      const updated = { ...body, edges: [{ id: "e1", source: "n1", target: "n1" }] } as typeof body;
      const res = await testApp
        .put(updatePath)
        .withAuth(ownerId)
        .send(updated)
        .expect(StatusCodes.OK);
      const resBody = res.body as { graph: typeof body };
      expect(resBody.graph).toEqual(updated);
    });

    it("returns 404 when updating without existing flow", async () => {
      const { experiment } = await testApp.createExperiment({ name: "Exp", userId: ownerId });
      const updatePath = testApp.resolvePath(contract.experiments.updateFlow.path, {
        id: experiment.id,
      });
      await testApp
        .put(updatePath)
        .withAuth(ownerId)
        .send(testApp.sampleFlowGraph({ includeInstruction: true }))
        .expect(StatusCodes.NOT_FOUND);
    });
  });
});
