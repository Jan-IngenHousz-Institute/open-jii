import { assertSuccess } from "../../../common/utils/fp-utils";
import { TestHarness } from "../../../test/test-harness";
import { FlowRepository } from "./flow.repository";

describe("FlowRepository", () => {
  const testApp = TestHarness.App;
  let repository: FlowRepository;
  let testUserId: string;

  beforeAll(async () => {
    await testApp.setup();
  });

  beforeEach(async () => {
    await testApp.beforeEach();
    testUserId = await testApp.createTestUser({});
    repository = testApp.module.get(FlowRepository);
  });

  afterEach(() => {
    testApp.afterEach();
  });

  afterAll(async () => {
    await testApp.teardown();
  });

  it("getByExperimentId should return null when no flow exists", async () => {
    const { experiment } = await testApp.createExperiment({
      name: "No Flow",
      userId: testUserId,
    });

    const result = await repository.getByExperimentId(experiment.id);
    expect(result.isSuccess()).toBe(true);
    assertSuccess(result);
    expect(result.value).toBeNull();
  });

  it("create should insert a new flow for an experiment", async () => {
    const { experiment } = await testApp.createExperiment({
      name: "Insert Flow",
      userId: testUserId,
    });

    const graph = testApp.sampleFlowGraph({ includeInstruction: true });
    const createResult = await repository.create(experiment.id, graph);
    expect(createResult.isSuccess()).toBe(true);
    assertSuccess(createResult);
    const flow = createResult.value;

    expect(flow).toMatchObject({
      id: expect.any(String) as string,
      experimentId: experiment.id,
      graph,
    });

    const getResult = await repository.getByExperimentId(experiment.id);
    assertSuccess(getResult);
    expect(getResult.value).not.toBeNull();
    expect(getResult.value?.graph).toEqual(graph);
  });

  it("update should update the existing flow graph", async () => {
    const { experiment } = await testApp.createExperiment({
      name: "Update Flow",
      userId: testUserId,
    });

    const graph1 = testApp.sampleFlowGraph({ includeInstruction: true });
    const graph2 = {
      ...graph1,
      nodes: [
        ...graph1.nodes,
        {
          id: "n3",
          type: "measurement" as const,
          name: "Take reading",
          content: { protocolId: crypto.randomUUID(), params: { duration: 10 } },
        },
      ],
      edges: [...graph1.edges, { id: "e2", source: "n2", target: "n3" }],
    };

    const r1 = await repository.create(experiment.id, graph1);
    assertSuccess(r1);
    const created = r1.value;

    const r2 = await repository.update(experiment.id, graph2);
    assertSuccess(r2);
    const updated = r2.value;

    expect(updated.id).toBe(created.id);
    expect(updated.graph).toEqual(graph2);
  });
});
