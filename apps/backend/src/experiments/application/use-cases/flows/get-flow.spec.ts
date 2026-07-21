import { assertFailure, assertSuccess } from "../../../../common/utils/fp-utils";
import { TestHarness } from "../../../../test/test-harness";
import { FlowRepository } from "../../../core/repositories/flow.repository";
import { GetFlowUseCase } from "./get-flow";

describe("GetFlowUseCase", () => {
  const testApp = TestHarness.App;
  let useCase: GetFlowUseCase;
  let flowRepository: FlowRepository;
  let ownerId: string;
  let memberId: string;

  beforeAll(async () => {
    await testApp.setup();
  });

  beforeEach(async () => {
    await testApp.beforeEach();
    ownerId = await testApp.createTestUser({});
    memberId = await testApp.createTestUser({});
    useCase = testApp.module.get(GetFlowUseCase);
    flowRepository = testApp.module.get(FlowRepository);
  });

  afterEach(() => {
    testApp.afterEach();
  });

  afterAll(async () => {
    await testApp.teardown();
  });

  it("returns 404 if experiment not found", async () => {
    const result = await useCase.execute("00000000-0000-0000-0000-000000000000", ownerId);

    expect(result.isFailure()).toBe(true);
    assertFailure(result);
    expect(result.error.statusCode).toBe(404);
  });

  it("returns 404 if no flow exists even when access is allowed", async () => {
    const { experiment } = await testApp.createExperiment({ name: "Has Access", userId: ownerId });

    const result = await useCase.execute(experiment.id, memberId);
    expect(result.isSuccess()).toBe(false);
    assertFailure(result);
    expect(result.error.statusCode).toBe(404);
  });

  it("returns a flow after route authorization", async () => {
    const { experiment } = await testApp.createExperiment({ name: "Experiment", userId: ownerId });
    const graph = testApp.sampleFlowGraph();
    await flowRepository.create(experiment.id, graph);

    const result = await useCase.execute(experiment.id, memberId);
    expect(result.isSuccess()).toBe(true);
    assertSuccess(result);
    expect(result.value.graph).toEqual(graph);
  });
});
