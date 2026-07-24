import { StatusCodes } from "http-status-codes";

import { contract } from "@repo/api/contract";
import { flows } from "@repo/database";

import { AuthorizationService } from "../../authorization/authorization.service";
import { TestHarness } from "../../test/test-harness";
import type { FlowGraphDto } from "../core/models/flow.model";
import { FlowRepository } from "../core/repositories/flow.repository";

const refFlowGraph = (): FlowGraphDto => ({
  nodes: [
    {
      id: "n1",
      type: "measurement",
      name: "Dynamic command",
      content: { command: { kind: "ref", ref: { sourceCellId: "m1", field: "toDevice" } } },
      isStart: true,
    },
  ],
  edges: [],
});

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
  });

  afterEach(() => {
    vi.restoreAllMocks();
    testApp.afterEach();
  });

  afterAll(async () => {
    await testApp.teardown();
  });

  describe("GET /api/v1/experiments/:id/flow", () => {
    it("returns 404 when flow not found", async () => {
      const { experiment } = await testApp.createExperiment({ name: "Exp", userId: ownerId });
      const path = testApp.resolveOrpcPath(contract.experiments.getFlow, { id: experiment.id });
      await testApp.get(path).withAuth(ownerId).expect(StatusCodes.NOT_FOUND);
    });

    it("returns 400 for invalid experiment id", async () => {
      const path = testApp.resolveOrpcPath(contract.experiments.getFlow, { id: "not-a-uuid" });
      await testApp.get(path).withAuth(ownerId).expect(StatusCodes.BAD_REQUEST);
    });

    it("returns 401 when unauthorized", async () => {
      const { experiment } = await testApp.createExperiment({ name: "Exp", userId: ownerId });
      const path = testApp.resolveOrpcPath(contract.experiments.getFlow, { id: experiment.id });
      await testApp.get(path).withoutAuth().expect(StatusCodes.UNAUTHORIZED);
    });

    it("returns 426 with no graph for a dynamic-ref flow when capability is missing", async () => {
      const { experiment } = await testApp.createExperiment({ name: "Dyn", userId: ownerId });
      const flowRepository = testApp.module.get(FlowRepository);
      await flowRepository.create(experiment.id, refFlowGraph());

      const path = testApp.resolveOrpcPath(contract.experiments.getFlow, { id: experiment.id });
      const res = await testApp.get(path).withAuth(ownerId).expect(StatusCodes.UPGRADE_REQUIRED);

      // Body carries a stable code/message and never the workbook flow graph.
      const body = res.body as { graph?: unknown; message?: string; data?: { code?: string } };
      expect(body.graph).toBeUndefined();
      expect(JSON.stringify(res.body)).not.toContain("toDevice");
    });

    it("returns the dynamic-ref flow when the capability header is present", async () => {
      const { experiment } = await testApp.createExperiment({ name: "Dyn", userId: ownerId });
      const flowRepository = testApp.module.get(FlowRepository);
      await flowRepository.create(experiment.id, refFlowGraph());

      const path = testApp.resolveOrpcPath(contract.experiments.getFlow, { id: experiment.id });
      const res = await testApp
        .get(path)
        .withAuth(ownerId)
        .set("x-openjii-capabilities", "dynamic-command-ref-v1")
        .expect(StatusCodes.OK);
      const body = res.body as { graph: { nodes: unknown[] } };
      expect(body.graph.nodes).toHaveLength(1);
    });

    it("returns a controlled incompatibility (no graph) for a malformed stored row in production", async () => {
      vi.stubEnv("NODE_ENV", "production");
      const { experiment } = await testApp.createExperiment({ name: "Bad", userId: ownerId });
      // Insert a historical row that fails the strict schema (measurement node
      // carrying instruction content), bypassing the strict write path.
      await testApp.database.insert(flows).values({
        experimentId: experiment.id,
        graph: {
          nodes: [
            {
              id: "n1",
              type: "measurement",
              name: "x",
              content: { text: "SECRET" },
              isStart: true,
            },
          ],
          edges: [],
        },
      });

      const path = testApp.resolveOrpcPath(contract.experiments.getFlow, { id: experiment.id });
      const res = await testApp
        .get(path)
        .withAuth(ownerId)
        .expect(StatusCodes.INTERNAL_SERVER_ERROR);

      const serialized = JSON.stringify(res.body);
      expect(serialized).toContain("FLOW_READ_INCOMPATIBLE");
      expect(serialized).not.toContain("SECRET");
      expect((res.body as { graph?: unknown }).graph).toBeUndefined();
      vi.unstubAllEnvs();
    });
  });

  describe("POST /api/v1/experiments/:id/flow", () => {
    it("creates flow for admin", async () => {
      const { experiment } = await testApp.createExperiment({ name: "Exp", userId: ownerId });
      const path = testApp.resolveOrpcPath(contract.experiments.createFlow, {
        id: experiment.id,
      });
      const body = testApp.sampleFlowGraph({ includeInstruction: true });
      const res = await testApp.post(path).withAuth(ownerId).send(body).expect(StatusCodes.CREATED);
      const resBody = res.body as { graph: typeof body };
      expect(resBody.graph).toEqual(body);

      // GET should now return the flow
      const getPath = testApp.resolveOrpcPath(contract.experiments.getFlow, {
        id: experiment.id,
      });
      const getRes = await testApp.get(getPath).withAuth(ownerId).expect(StatusCodes.OK);
      const getResBody = getRes.body as { graph: typeof body };
      expect(getResBody.graph).toEqual(body);
    });

    it("returns 403 when non-admin members try to create", async () => {
      const { experiment } = await testApp.createExperiment({ name: "Exp", userId: ownerId });
      await testApp.addExperimentMember(experiment.id, memberId, "member");
      const path = testApp.resolveOrpcPath(contract.experiments.createFlow, {
        id: experiment.id,
      });
      await testApp
        .post(path)
        .withAuth(memberId)
        .send(testApp.sampleFlowGraph({ includeInstruction: true }))
        .expect(StatusCodes.FORBIDDEN);
    });

    it("requires auth", async () => {
      const { experiment } = await testApp.createExperiment({ name: "Exp", userId: ownerId });
      const path = testApp.resolveOrpcPath(contract.experiments.createFlow, {
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
      const path = testApp.resolveOrpcPath(contract.experiments.createFlow, {
        id: experiment.id,
      });
      const invalidBody = { nodes: [] }; // missing edges
      await testApp.post(path).withAuth(ownerId).send(invalidBody).expect(StatusCodes.BAD_REQUEST);
    });

    it("returns 400 when no nodes are provided", async () => {
      const { experiment } = await testApp.createExperiment({ name: "Exp", userId: ownerId });
      const path = testApp.resolveOrpcPath(contract.experiments.createFlow, {
        id: experiment.id,
      });
      const invalidGraph = { nodes: [] as unknown[], edges: [] as unknown[] };
      await testApp.post(path).withAuth(ownerId).send(invalidGraph).expect(StatusCodes.BAD_REQUEST);
    });

    it("returns 400 when nodes exist but none is a start node", async () => {
      const { experiment } = await testApp.createExperiment({ name: "Exp", userId: ownerId });
      const path = testApp.resolveOrpcPath(contract.experiments.createFlow, {
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
      const path = testApp.resolveOrpcPath(contract.experiments.createFlow, {
        id: nonExistentId,
      });
      await testApp
        .post(path)
        .withAuth(ownerId)
        .send(testApp.sampleFlowGraph({ includeInstruction: true }))
        .expect(StatusCodes.NOT_FOUND);
    });

    it("rejects a dynamic-ref flow graph while the publish gate is off", async () => {
      const { experiment } = await testApp.createExperiment({ name: "Exp", userId: ownerId });
      const path = testApp.resolveOrpcPath(contract.experiments.createFlow, { id: experiment.id });
      await testApp
        .post(path)
        .withAuth(ownerId)
        .send(refFlowGraph())
        .expect(StatusCodes.BAD_REQUEST);
    });

    it.each(["command", "ref", "payload", "unknown"])(
      "rejects a graph-root %s key at the route contract before repository access",
      async (key) => {
        const { experiment } = await testApp.createExperiment({ name: "Exp", userId: ownerId });
        const flowRepository = testApp.module.get(FlowRepository);
        const readSpy = vi.spyOn(flowRepository, "getByExperimentId");
        const createSpy = vi.spyOn(flowRepository, "create");
        const path = testApp.resolveOrpcPath(contract.experiments.createFlow, {
          id: experiment.id,
        });

        await testApp
          .post(path)
          .withAuth(ownerId)
          .send({ ...testApp.sampleFlowGraph({ includeInstruction: true }), [key]: true })
          .expect(StatusCodes.BAD_REQUEST);

        expect(readSpy).not.toHaveBeenCalled();
        expect(createSpy).not.toHaveBeenCalled();
      },
    );
  });

  describe("PUT /api/v1/experiments/:id/flow", () => {
    it("updates flow for admin", async () => {
      const { experiment } = await testApp.createExperiment({ name: "Exp", userId: ownerId });
      // create first
      const createPath = testApp.resolveOrpcPath(contract.experiments.createFlow, {
        id: experiment.id,
      });
      const body = testApp.sampleFlowGraph({ includeInstruction: true });
      await testApp.post(createPath).withAuth(ownerId).send(body).expect(StatusCodes.CREATED);

      const updatePath = testApp.resolveOrpcPath(contract.experiments.updateFlow, {
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
      const updatePath = testApp.resolveOrpcPath(contract.experiments.updateFlow, {
        id: experiment.id,
      });
      await testApp
        .put(updatePath)
        .withAuth(ownerId)
        .send(testApp.sampleFlowGraph({ includeInstruction: true }))
        .expect(StatusCodes.NOT_FOUND);
    });

    it.each(["command", "ref", "payload", "unknown"])(
      "rejects a graph-root %s key at the update route before repository access",
      async (key) => {
        const { experiment } = await testApp.createExperiment({ name: "Exp", userId: ownerId });
        const flowRepository = testApp.module.get(FlowRepository);
        const readSpy = vi.spyOn(flowRepository, "getByExperimentId");
        const updateSpy = vi.spyOn(flowRepository, "update");
        const path = testApp.resolveOrpcPath(contract.experiments.updateFlow, {
          id: experiment.id,
        });

        await testApp
          .put(path)
          .withAuth(ownerId)
          .send({ ...testApp.sampleFlowGraph({ includeInstruction: true }), [key]: true })
          .expect(StatusCodes.BAD_REQUEST);

        expect(readSpy).not.toHaveBeenCalled();
        expect(updateSpy).not.toHaveBeenCalled();
      },
    );
  });

  describe("authorization", () => {
    it.each([
      {
        name: "get flow",
        action: "read",
        request: (experimentId: string, userId: string) =>
          testApp
            .get(testApp.resolveOrpcPath(contract.experiments.getFlow, { id: experimentId }))
            .withAuth(userId),
      },
      {
        name: "create flow",
        action: "manage",
        request: (experimentId: string, userId: string) =>
          testApp
            .post(testApp.resolveOrpcPath(contract.experiments.createFlow, { id: experimentId }))
            .withAuth(userId)
            .send(testApp.sampleFlowGraph({ includeInstruction: true })),
      },
      {
        name: "update flow",
        action: "manage",
        request: (experimentId: string, userId: string) =>
          testApp
            .put(testApp.resolveOrpcPath(contract.experiments.updateFlow, { id: experimentId }))
            .withAuth(userId)
            .send(testApp.sampleFlowGraph({ includeInstruction: true })),
      },
    ])("requires $action access to $name", async ({ action, request }) => {
      const { experiment } = await testApp.createExperiment({
        name: "Guarded private experiment",
        userId: ownerId,
        visibility: "private",
      });
      const canSpy = vi.spyOn(testApp.module.get(AuthorizationService), "can");

      await request(experiment.id, memberId).expect(StatusCodes.FORBIDDEN);

      expect(canSpy).toHaveBeenCalledTimes(1);
      expect(canSpy).toHaveBeenCalledWith(memberId, {
        resourceType: "experiment",
        resourceId: experiment.id,
        action,
      });
    });
  });
});
