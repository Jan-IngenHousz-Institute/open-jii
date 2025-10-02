import { assertFailure, assertSuccess, success } from "../../../../common/utils/fp-utils";
import { TestHarness } from "../../../../test/test-harness";
import { ExperimentRepository } from "../../../core/repositories/experiment.repository";
import { CreateFlowUseCase } from "./create-flow";

describe("CreateFlowUseCase", () => {
  const testApp = TestHarness.App;
  let useCase: CreateFlowUseCase;
  let ownerId: string;
  let memberId: string;

  beforeAll(async () => {
    await testApp.setup();
  });

  beforeEach(async () => {
    await testApp.beforeEach();
    ownerId = await testApp.createTestUser({});
    memberId = await testApp.createTestUser({});
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

  it("returns 403 if user is not a member of experiment", async () => {
    const { experiment } = await testApp.createExperiment({ name: "Exp", userId: ownerId });
    // Do not add memberId as a member
    const result = await useCase.execute(
      experiment.id,
      memberId,
      testApp.sampleFlowGraph({ questionKind: "multi_choice" }),
    );
    expect(result.isSuccess()).toBe(false);
    assertFailure(result);
    expect(result.error.statusCode).toBe(403);
  });

  it("creates flow when user is a member and no existing flow", async () => {
    const { experiment } = await testApp.createExperiment({ name: "Exp", userId: ownerId });
    await testApp.addExperimentMember(experiment.id, memberId, "member");

    const graph = testApp.sampleFlowGraph({ questionKind: "multi_choice" });
    const result = await useCase.execute(experiment.id, memberId, graph);
    expect(result.isSuccess()).toBe(true);
    assertSuccess(result);
    const created = result.value;
    expect(created.graph).toEqual(graph);
  });

  it("returns 403 when members attempt to create flow for archived experiments", async () => {
    const { experiment } = await testApp.createExperiment({
      name: "Archived Exp",
      userId: ownerId,
    });
    await testApp.addExperimentMember(experiment.id, memberId, "member");

    // Mock experimentRepository.checkAccess to simulate archived experiment where member has access but is not admin
    const experimentRepository = testApp.module.get(ExperimentRepository);
    vi.spyOn(experimentRepository, "checkAccess").mockResolvedValue(
      success({
        experiment: { ...experiment, status: "archived" },
        hasAccess: true,
        isAdmin: false,
      }),
    );

    try {
      const graph = testApp.sampleFlowGraph({ questionKind: "multi_choice" });
      const result = await useCase.execute(experiment.id, memberId, graph);
      expect(result.isFailure()).toBe(true);
      assertFailure(result);
      expect(result.error.statusCode).toBe(403);
      expect(result.error.message).toContain(
        "Only admins can create flows for archived experiments",
      );
    } finally {
      vi.restoreAllMocks();
    }
  });

  it("allows admins to create flow for archived experiments", async () => {
    const { experiment } = await testApp.createExperiment({
      name: "Archived Exp Admin",
      userId: ownerId,
    });

    // Mock experimentRepository.checkAccess to simulate archived experiment and user is admin
    const experimentRepository = testApp.module.get(ExperimentRepository);
    vi.spyOn(experimentRepository, "checkAccess").mockResolvedValue(
      success({
        experiment: { ...experiment, status: "archived" },
        hasAccess: true,
        isAdmin: true,
      }),
    );

    try {
      const graph = testApp.sampleFlowGraph({ questionKind: "multi_choice" });
      const result = await useCase.execute(experiment.id, ownerId, graph);
      expect(result.isSuccess()).toBe(true);
      assertSuccess(result);
      const created = result.value;
      expect(created.graph).toEqual(graph);
    } finally {
      vi.restoreAllMocks();
    }
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
