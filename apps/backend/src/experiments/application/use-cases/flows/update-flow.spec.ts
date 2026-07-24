import { flows } from "@repo/database";

import { assertFailure, assertSuccess } from "../../../../common/utils/fp-utils";
import { TestHarness } from "../../../../test/test-harness";
import { FlowRepository } from "../../../core/repositories/flow.repository";
import { UpdateFlowUseCase } from "./update-flow";
import { invalidRefFlowGraphs, validRefFlowGraph } from "./dynamic-flow-fixtures";

describe("UpdateFlowUseCase", () => {
  const testApp = TestHarness.App;
  let useCase: UpdateFlowUseCase;
  let ownerId: string;

  beforeAll(async () => {
    await testApp.setup();
  });

  beforeEach(async () => {
    await testApp.beforeEach();
    ownerId = await testApp.createTestUser({});
    useCase = testApp.module.get(UpdateFlowUseCase);
  });

  afterEach(() => {
    testApp.afterEach();
  });

  afterAll(async () => {
    await testApp.teardown();
  });

  it("returns 404 if experiment not found", async () => {
    const result = await useCase.execute(
      "00000000-0000-0000-0000-000000000000",
      ownerId,
      testApp.sampleFlowGraph({ questionKind: "multi_choice" }),
    );
    expect(result.isSuccess()).toBe(false);
    assertFailure(result);
    expect(result.error.statusCode).toBe(404);
  });

  it("returns 404 when no existing flow to update", async () => {
    const { experiment } = await testApp.createExperiment({ name: "Exp", userId: ownerId });

    const graph = testApp.sampleFlowGraph({ questionKind: "multi_choice" });
    const result = await useCase.execute(experiment.id, ownerId, graph);
    expect(result.isSuccess()).toBe(false);
    assertFailure(result);
    expect(result.error.statusCode).toBe(404);
  });

  it("updates flow when user is admin and flow exists", async () => {
    const { experiment } = await testApp.createExperiment({ name: "Exp", userId: ownerId });

    // First create using repository directly to set up existing flow
    const graph = testApp.sampleFlowGraph({ questionKind: "multi_choice" });
    await testApp.database.insert(flows).values({
      experimentId: experiment.id,
      graph,
    });

    const updatedGraph: ReturnType<typeof testApp.sampleFlowGraph> = {
      ...graph,
      edges: [{ id: "e1", source: "n1", target: "n1" }],
    };

    const result = await useCase.execute(experiment.id, ownerId, updatedGraph);
    expect(result.isSuccess()).toBe(true);
    assertSuccess(result);
    expect(result.value.graph).toEqual(updatedGraph);
  });

  it("returns 403 when any user attempts to update flow for archived experiments", async () => {
    const { experiment } = await testApp.createExperiment({
      name: "Archived Exp Update",
      userId: ownerId,
      status: "archived",
    });

    // Create an existing flow directly in DB
    const graph = testApp.sampleFlowGraph({ questionKind: "multi_choice" });
    await testApp.database.insert(flows).values({
      experimentId: experiment.id,
      graph,
    });

    const updatedGraph: ReturnType<typeof testApp.sampleFlowGraph> = {
      ...graph,
      edges: [{ id: "e1", source: "n1", target: "n1" }],
    };

    const result = await useCase.execute(experiment.id, ownerId, updatedGraph);

    expect(result.isFailure()).toBe(true);
    assertFailure(result);
    expect(result.error.statusCode).toBe(403);
    expect(result.error.message).toContain("Cannot modify an archived experiment");
  });

  it("rejects a dynamic-ref flow graph while the publish gate is off and never calls the repo", async () => {
    const { experiment } = await testApp.createExperiment({ name: "Exp", userId: ownerId });
    const graph = testApp.sampleFlowGraph({ questionKind: "multi_choice" });
    await testApp.database.insert(flows).values({ experimentId: experiment.id, graph });

    const flowRepository = testApp.module.get(FlowRepository);
    const updateSpy = vi.spyOn(flowRepository, "update");

    // Gate-off rejects first, even for an otherwise-valid graph.
    const result = await useCase.execute(experiment.id, ownerId, validRefFlowGraph());

    assertFailure(result);
    expect(result.error.statusCode).toBe(400);
    expect(result.error.code).toBe("DYNAMIC_COMMAND_PUBLISH_DISABLED");
    expect(updateSpy).not.toHaveBeenCalled();
    vi.restoreAllMocks();
  });

  it("allows a structurally valid dynamic-ref flow graph when the publish gate is enabled", async () => {
    vi.stubEnv("DYNAMIC_COMMAND_PUBLISH_ENABLED", "true");
    const { experiment } = await testApp.createExperiment({ name: "Exp", userId: ownerId });
    const graph = testApp.sampleFlowGraph({ questionKind: "multi_choice" });
    await testApp.database.insert(flows).values({ experimentId: experiment.id, graph });

    const result = await useCase.execute(experiment.id, ownerId, validRefFlowGraph());

    assertSuccess(result);
    vi.unstubAllEnvs();
  });

  it.each(Object.keys(invalidRefFlowGraphs))(
    "rejects a gate-enabled ref graph with %s and never persists",
    async (key) => {
      vi.stubEnv("DYNAMIC_COMMAND_PUBLISH_ENABLED", "true");
      const { experiment } = await testApp.createExperiment({ name: "Exp", userId: ownerId });
      const graph = testApp.sampleFlowGraph({ questionKind: "multi_choice" });
      await testApp.database.insert(flows).values({ experimentId: experiment.id, graph });

      const flowRepository = testApp.module.get(FlowRepository);
      const updateSpy = vi.spyOn(flowRepository, "update");

      const result = await useCase.execute(experiment.id, ownerId, invalidRefFlowGraphs[key]());

      assertFailure(result);
      expect(result.error.statusCode).toBe(400);
      // Schema-invalid shapes are caught by the self strict-parse
      // (FLOW_GRAPH_INVALID); the rest by the dynamic validator. Both no-persist.
      expect(["FLOW_GRAPH_INVALID", "WORKBOOK_STRUCTURAL_VALIDATION_FAILED"]).toContain(
        result.error.code,
      );
      expect(updateSpy).not.toHaveBeenCalled();
      vi.restoreAllMocks();
      vi.unstubAllEnvs();
    },
  );

  it.each(["command", "ref", "payload", "unknown"])(
    "rejects a graph-root %s key before any flow repository access",
    async (key) => {
      const { experiment } = await testApp.createExperiment({ name: "Exp", userId: ownerId });
      const flowRepository = testApp.module.get(FlowRepository);
      const readSpy = vi.spyOn(flowRepository, "getByExperimentId");
      const updateSpy = vi.spyOn(flowRepository, "update");
      const graph = {
        ...testApp.sampleFlowGraph({ questionKind: "multi_choice" }),
        [key]: { sentinel: true },
      };

      const result = await useCase.execute(experiment.id, ownerId, graph);

      assertFailure(result);
      expect(result.error.code).toBe("FLOW_GRAPH_INVALID");
      expect(readSpy).not.toHaveBeenCalled();
      expect(updateSpy).not.toHaveBeenCalled();
    },
  );
});
