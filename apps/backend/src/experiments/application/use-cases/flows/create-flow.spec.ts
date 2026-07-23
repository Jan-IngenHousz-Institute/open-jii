import { assertFailure, assertSuccess } from "../../../../common/utils/fp-utils";
import { TestHarness } from "../../../../test/test-harness";
import { CreateFlowUseCase } from "./create-flow";

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
});
