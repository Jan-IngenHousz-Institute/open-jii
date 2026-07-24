import { assertFailure, assertSuccess } from "../../../../common/utils/fp-utils";
import { TestHarness } from "../../../../test/test-harness";
import { FlowRepository } from "../../../core/repositories/flow.repository";
import { CreateFlowUseCase } from "./create-flow";
import { invalidRefFlowGraphs, validRefFlowGraph } from "./dynamic-flow-fixtures";

describe("CreateFlowUseCase", () => {
  const testApp = TestHarness.App;
  let useCase: CreateFlowUseCase;
  let ownerId: string;

  beforeAll(async () => {
    await testApp.setup();
  });

  beforeEach(async () => {
    await testApp.beforeEach();
    ownerId = await testApp.createTestUser({});
    useCase = testApp.module.get(CreateFlowUseCase);
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

  it("returns 403 when any user attempts to create flow for archived experiments", async () => {
    // Create an archived experiment
    const { experiment } = await testApp.createExperiment({
      name: "Archived Exp",
      userId: ownerId,
      status: "archived",
    });

    const graph = testApp.sampleFlowGraph({ questionKind: "multi_choice" });

    const result = await useCase.execute(experiment.id, ownerId, graph);

    expect(result.isFailure()).toBe(true);
    assertFailure(result);
    expect(result.error.statusCode).toBe(403);
    expect(result.error.message).toContain("Cannot modify an archived experiment");
  });

  it("creates flow when user is admin and no existing flow", async () => {
    const { experiment } = await testApp.createExperiment({ name: "Exp", userId: ownerId });

    const graph = testApp.sampleFlowGraph({ questionKind: "multi_choice" });
    const result = await useCase.execute(experiment.id, ownerId, graph);
    expect(result.isSuccess()).toBe(true);
    assertSuccess(result);
    const created = result.value;
    expect(created.graph).toEqual(graph);
  });

  it("fails with 400 when flow already exists", async () => {
    const { experiment } = await testApp.createExperiment({ name: "Exp", userId: ownerId });

    const graph = testApp.sampleFlowGraph({ questionKind: "multi_choice" });
    const first = await useCase.execute(experiment.id, ownerId, graph);
    expect(first.isSuccess()).toBe(true);

    const second = await useCase.execute(experiment.id, ownerId, graph);
    expect(second.isSuccess()).toBe(false);
    assertFailure(second);
    expect(second.error.statusCode).toBe(400);
  });

  it("rejects a dynamic-ref flow graph while the publish gate is off and never calls the repo", async () => {
    const { experiment } = await testApp.createExperiment({ name: "Exp", userId: ownerId });
    const flowRepository = testApp.module.get(FlowRepository);
    const createSpy = vi.spyOn(flowRepository, "create");

    // Gate-off rejects first, even for an otherwise-valid graph.
    const result = await useCase.execute(experiment.id, ownerId, validRefFlowGraph());

    assertFailure(result);
    expect(result.error.statusCode).toBe(400);
    expect(result.error.code).toBe("DYNAMIC_COMMAND_PUBLISH_DISABLED");
    expect(createSpy).not.toHaveBeenCalled();
    vi.restoreAllMocks();
  });

  it("allows a structurally valid dynamic-ref flow graph when the publish gate is enabled", async () => {
    vi.stubEnv("DYNAMIC_COMMAND_PUBLISH_ENABLED", "true");
    const { experiment } = await testApp.createExperiment({ name: "Exp", userId: ownerId });

    const result = await useCase.execute(experiment.id, ownerId, validRefFlowGraph());

    assertSuccess(result);
    vi.unstubAllEnvs();
  });

  it.each(Object.keys(invalidRefFlowGraphs))(
    "rejects a gate-enabled ref graph with %s and never persists",
    async (key) => {
      vi.stubEnv("DYNAMIC_COMMAND_PUBLISH_ENABLED", "true");
      const { experiment } = await testApp.createExperiment({ name: "Exp", userId: ownerId });
      const flowRepository = testApp.module.get(FlowRepository);
      const createSpy = vi.spyOn(flowRepository, "create");

      const result = await useCase.execute(experiment.id, ownerId, invalidRefFlowGraphs[key]());

      assertFailure(result);
      expect(result.error.statusCode).toBe(400);
      // Schema-invalid shapes (duplicate ids, type/content mismatch) are caught
      // by the self strict-parse (FLOW_GRAPH_INVALID); the rest by the dynamic
      // validator (WORKBOOK_STRUCTURAL_VALIDATION_FAILED). Both fail closed.
      expect(["FLOW_GRAPH_INVALID", "WORKBOOK_STRUCTURAL_VALIDATION_FAILED"]).toContain(
        result.error.code,
      );
      expect(createSpy).not.toHaveBeenCalled();
      vi.restoreAllMocks();
      vi.unstubAllEnvs();
    },
  );

  // Misplaced ref-like keys the strict envelopes must reject rather than strip.
  const misplacedRefGraphs: Record<string, unknown> = {
    "node-sibling command": {
      nodes: [
        {
          id: "n1",
          type: "instruction",
          name: "x",
          content: { text: "a", command: { kind: "ref", ref: { sourceCellId: "s", field: "f" } } },
          isStart: true,
        },
      ],
      edges: [],
    },
    "branch path command": {
      nodes: [
        {
          id: "b1",
          type: "branch",
          name: "B",
          content: {
            paths: [
              {
                id: "p1",
                label: "x",
                color: "#000",
                command: { kind: "ref", ref: { sourceCellId: "s", field: "f" } },
              },
            ],
          },
          isStart: true,
        },
      ],
      edges: [],
    },
    "branch condition ref": {
      nodes: [
        {
          id: "b1",
          type: "branch",
          name: "B",
          content: {
            paths: [
              {
                id: "p1",
                label: "x",
                color: "#000",
                conditions: [
                  {
                    id: "c1",
                    sourceCellId: "s",
                    field: "f",
                    operator: "eq",
                    value: "1",
                    ref: { sourceCellId: "s", field: "f" },
                  },
                ],
              },
            ],
          },
          isStart: true,
        },
      ],
      edges: [],
    },
  };

  it.each(Object.keys(misplacedRefGraphs))(
    "rejects a misplaced %s at the strict envelope with no persistence",
    async (key) => {
      const { experiment } = await testApp.createExperiment({ name: "Exp", userId: ownerId });
      const flowRepository = testApp.module.get(FlowRepository);
      const createSpy = vi.spyOn(flowRepository, "create");

      const result = await useCase.execute(
        experiment.id,
        ownerId,
        misplacedRefGraphs[key] as never,
      );

      assertFailure(result);
      expect(result.error.code).toBe("FLOW_GRAPH_INVALID");
      expect(createSpy).not.toHaveBeenCalled();
      vi.restoreAllMocks();
    },
  );

  it.each(["command", "ref", "payload", "unknown"])(
    "rejects a graph-root %s key before any flow repository access",
    async (key) => {
      const { experiment } = await testApp.createExperiment({ name: "Exp", userId: ownerId });
      const flowRepository = testApp.module.get(FlowRepository);
      const readSpy = vi.spyOn(flowRepository, "getByExperimentId");
      const createSpy = vi.spyOn(flowRepository, "create");
      const graph = {
        ...testApp.sampleFlowGraph({ questionKind: "multi_choice" }),
        [key]: { sentinel: true },
      };

      const result = await useCase.execute(experiment.id, ownerId, graph);

      assertFailure(result);
      expect(result.error.code).toBe("FLOW_GRAPH_INVALID");
      expect(readSpy).not.toHaveBeenCalled();
      expect(createSpy).not.toHaveBeenCalled();
    },
  );
});
