import { assertFailure, assertSuccess } from "../../../../common/utils/fp-utils";
import { TestHarness } from "../../../../test/test-harness";
import { ExperimentRepository } from "../../../core/repositories/experiment.repository";
import { UpsertFlowUseCase } from "./upsert-flow";

describe("UpsertFlowUseCase", () => {
  const testApp = TestHarness.App;
  let useCase: UpsertFlowUseCase;
  let ownerId: string;
  let memberId: string;

  beforeAll(async () => {
    await testApp.setup();
  });

  beforeEach(async () => {
    await testApp.beforeEach();
    ownerId = await testApp.createTestUser({});
    memberId = await testApp.createTestUser({});
    useCase = testApp.module.get(UpsertFlowUseCase);
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

  it("returns 403 if user is not admin of experiment", async () => {
    const { experiment } = await testApp.createExperiment({ name: "Exp", userId: ownerId });
    // Add member without admin rights
    await testApp.addExperimentMember(experiment.id, memberId, "member");

    const result = await useCase.execute(
      experiment.id,
      memberId,
      testApp.sampleFlowGraph({ questionKind: "multi_choice" }),
    );
    expect(result.isSuccess()).toBe(false);
    assertFailure(result);
    expect(result.error.statusCode).toBe(403);
  });

  it("still forbids non-admin even if experiment is public", async () => {
    const { experiment } = await testApp.createExperiment({ name: "Exp", userId: ownerId });
    // make public
    const experimentsRepo = testApp.module.get(ExperimentRepository);
    await experimentsRepo.update(experiment.id, { visibility: "public" });
    // Add member without admin
    await testApp.addExperimentMember(experiment.id, memberId, "member");
    const result = await useCase.execute(
      experiment.id,
      memberId,
      testApp.sampleFlowGraph({ questionKind: "multi_choice" }),
    );
    expect(result.isSuccess()).toBe(false);
    assertFailure(result);
    expect(result.error.statusCode).toBe(403);
  });

  it("upserts flow when user is admin", async () => {
    const { experiment } = await testApp.createExperiment({ name: "Exp", userId: ownerId });

    const graph = testApp.sampleFlowGraph({ questionKind: "multi_choice" });
    const result = await useCase.execute(experiment.id, ownerId, graph);
    expect(result.isSuccess()).toBe(true);
    assertSuccess(result);
    const created = result.value;
    expect(created.graph).toEqual(graph);

    // update path
    const updatedGraph: ReturnType<typeof testApp.sampleFlowGraph> = {
      ...graph,
      edges: [{ id: "e1", source: "n1", target: "n1" }],
    };
    const result2 = await useCase.execute(experiment.id, ownerId, updatedGraph);
    expect(result2.isSuccess()).toBe(true);
    assertSuccess(result2);
    expect(result2.value.id).toBe(created.id);
    expect(result2.value.graph).toEqual(updatedGraph);
  });

  it("validates input graph and returns 400 for invalid schema", async () => {
    const { experiment } = await testApp.createExperiment({ name: "Exp", userId: ownerId });
    // cast via unknown to intentionally send invalid payload without lint errors
    const badGraph = { nodes: [{ id: "n1" }], edges: [] } as unknown as Parameters<
      UpsertFlowUseCase["execute"]
    >[2];
    const result = await useCase.execute(experiment.id, ownerId, badGraph);
    expect(result.isSuccess()).toBe(false);
    assertFailure(result);
    expect(result.error.statusCode).toBe(400);
  });
});
