import { flows } from "@repo/database";

import { assertFailure, assertSuccess } from "../../../../common/utils/fp-utils";
import { TestHarness } from "../../../../test/test-harness";
import { UpdateFlowUseCase } from "./update-flow";

describe("UpdateFlowUseCase", () => {
  const testApp = TestHarness.App;
  let useCase: UpdateFlowUseCase;
  let ownerId: string;
  let memberId: string;

  beforeAll(async () => {
    await testApp.setup();
  });

  beforeEach(async () => {
    await testApp.beforeEach();
    ownerId = await testApp.createTestUser({});
    memberId = await testApp.createTestUser({});
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

  it("returns 403 if user is not a member of experiment", async () => {
    const { experiment } = await testApp.createExperiment({ name: "Exp", userId: ownerId });
    // memberId is NOT added as a member
    const result = await useCase.execute(
      experiment.id,
      memberId,
      testApp.sampleFlowGraph({ questionKind: "multi_choice" }),
    );
    expect(result.isSuccess()).toBe(false);
    assertFailure(result);
    expect(result.error.statusCode).toBe(403);
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
});
