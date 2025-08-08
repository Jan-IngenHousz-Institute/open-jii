import { assertFailure, assertSuccess } from "../../../../common/utils/fp-utils";
import { TestHarness } from "../../../../test/test-harness";
import { ExperimentRepository } from "../../../core/repositories/experiment.repository";
import { FlowRepository } from "../../../core/repositories/flow.repository";
import { GetFlowUseCase } from "./get-flow";

describe("GetFlowUseCase", () => {
  const testApp = TestHarness.App;
  let useCase: GetFlowUseCase;
  let flowRepository: FlowRepository;
  let experimentRepository: ExperimentRepository;
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
    experimentRepository = testApp.module.get(ExperimentRepository);
  });

  afterEach(() => {
    testApp.afterEach();
  });

  afterAll(async () => {
    await testApp.teardown();
  });

  it("returns 404 if experiment not found", async () => {
    const result = await useCase.execute("00000000-0000-0000-0000-000000000000", ownerId);
    expect(result.isSuccess()).toBe(false);
    assertFailure(result);
    expect(result.error.statusCode).toBe(404);
  });

  it("returns 403 if no access and experiment is private", async () => {
    const { experiment } = await testApp.createExperiment({ name: "Private", userId: ownerId });
    const result = await useCase.execute(experiment.id, memberId);
    expect(result.isSuccess()).toBe(false);
    assertFailure(result);
    expect(result.error.statusCode).toBe(403);
  });

  it("returns 404 if no flow exists even when access is allowed", async () => {
    const { experiment } = await testApp.createExperiment({ name: "Has Access", userId: ownerId });
    // make it public so member can access
    await experimentRepository.update(experiment.id, { visibility: "public" });

    const result = await useCase.execute(experiment.id, memberId);
    expect(result.isSuccess()).toBe(false);
    assertFailure(result);
    expect(result.error.statusCode).toBe(404);
  });

  it("returns flow when exists and user has access (public)", async () => {
    const { experiment } = await testApp.createExperiment({ name: "Public", userId: ownerId });
    await experimentRepository.update(experiment.id, { visibility: "public" });
    const graph = testApp.sampleFlowGraph();
    await flowRepository.upsert(experiment.id, graph);

    const result = await useCase.execute(experiment.id, memberId);
    expect(result.isSuccess()).toBe(true);
    assertSuccess(result);
    expect(result.value.graph).toEqual(graph);
  });

  it("returns flow when user is a member of a private experiment", async () => {
    const { experiment } = await testApp.createExperiment({ name: "Private", userId: ownerId });
    // grant membership
    await testApp.addExperimentMember(experiment.id, memberId, "member");
    const graph = testApp.sampleFlowGraph();
    await flowRepository.upsert(experiment.id, graph);

    const result = await useCase.execute(experiment.id, memberId);
    expect(result.isSuccess()).toBe(true);
    assertSuccess(result);
    expect(result.value.graph).toEqual(graph);
  });
});
