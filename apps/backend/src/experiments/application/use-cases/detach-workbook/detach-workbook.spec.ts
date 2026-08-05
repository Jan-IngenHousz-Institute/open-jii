import { assertFailure, assertSuccess } from "../../../../common/utils/fp-utils";
import { TestHarness } from "../../../../test/test-harness";
import { ExperimentRepository } from "../../../core/repositories/experiment.repository";
import { FlowRepository } from "../../../core/repositories/flow.repository";
import { AttachWorkbookUseCase } from "../attach-workbook/attach-workbook";
import { DetachWorkbookUseCase } from "./detach-workbook";

describe("DetachWorkbookUseCase", () => {
  const testApp = TestHarness.App;
  let attachUseCase: AttachWorkbookUseCase;
  let detachUseCase: DetachWorkbookUseCase;
  let flowRepo: FlowRepository;
  let experimentRepo: ExperimentRepository;
  let adminUserId: string;
  let experimentId: string;
  let workbookId: string;
  let pinnedVersionId: string;

  beforeAll(async () => {
    await testApp.setup();
  });

  beforeEach(async () => {
    await testApp.beforeEach();
    adminUserId = await testApp.createTestUser({});

    attachUseCase = testApp.module.get(AttachWorkbookUseCase);
    detachUseCase = testApp.module.get(DetachWorkbookUseCase);
    flowRepo = testApp.module.get(FlowRepository);
    experimentRepo = testApp.module.get(ExperimentRepository);

    const { experiment } = await testApp.createExperiment({
      name: "Test Experiment",
      userId: adminUserId,
    });
    experimentId = experiment.id;

    const workbook = await testApp.createWorkbook({
      name: "Test Workbook",
      createdBy: adminUserId,
    });
    workbookId = workbook.id;

    const attached = await attachUseCase.execute(experimentId, workbookId, null, null, adminUserId);
    assertSuccess(attached);
    pinnedVersionId = attached.value.workbookVersionId;
  });

  afterEach(() => {
    vi.restoreAllMocks();
    testApp.afterEach();
  });

  afterAll(async () => {
    await testApp.teardown();
  });

  it("detaches the workbook and clears workbookId", async () => {
    const result = await detachUseCase.execute(
      experimentId,
      workbookId,
      pinnedVersionId,
      adminUserId,
    );
    assertSuccess(result);
    expect(result.value.workbookId).toBeNull();
  });

  it("keeps workbookVersionId after detach for historical reference", async () => {
    const result = await detachUseCase.execute(
      experimentId,
      workbookId,
      pinnedVersionId,
      adminUserId,
    );
    assertSuccess(result);
    expect(result.value.workbookVersionId).toBeDefined();
  });

  it("returns failure when experiment not found", async () => {
    const result = await detachUseCase.execute(
      "00000000-0000-0000-0000-000000000000",
      workbookId,
      pinnedVersionId,
      adminUserId,
    );
    assertFailure(result);
    expect(result.error.statusCode).toBe(404);
  });

  it("returns failure when no workbook is attached", async () => {
    await detachUseCase.execute(experimentId, workbookId, pinnedVersionId, adminUserId);

    const result = await detachUseCase.execute(
      experimentId,
      workbookId,
      pinnedVersionId,
      adminUserId,
    );
    assertFailure(result);
    expect(result.error.statusCode).toBe(400);
  });

  it("removes the materialised flow row so mobile no longer sees the graph", async () => {
    const before = await flowRepo.getByExperimentId(experimentId);
    assertSuccess(before);
    expect(before.value).not.toBeNull();

    const result = await detachUseCase.execute(
      experimentId,
      workbookId,
      pinnedVersionId,
      adminUserId,
    );
    assertSuccess(result);

    const after = await flowRepo.getByExperimentId(experimentId);
    assertSuccess(after);
    expect(after.value).toBeNull();
  });

  it("cannot detach a replacement workbook when an older detach completes last", async () => {
    const otherWorkbook = await testApp.createWorkbook({
      name: "Replacement",
      cells: [{ id: "b", type: "markdown", content: "B", isCollapsed: false }],
      createdBy: adminUserId,
    });

    let releaseDetach: (() => void) | undefined;
    let detachStarted: (() => void) | undefined;
    const started = new Promise<void>((resolve) => {
      detachStarted = resolve;
    });
    const gate = new Promise<void>((resolve) => {
      releaseDetach = resolve;
    });
    const updatePair = experimentRepo.updateWorkbookAndFlowIfExpected.bind(experimentRepo);
    vi.spyOn(experimentRepo, "updateWorkbookAndFlowIfExpected").mockImplementation(
      async (...args) => {
        if (args[2].workbookId === null) {
          detachStarted?.();
          await gate;
        }
        return updatePair(...args);
      },
    );

    const staleDetach = detachUseCase.execute(
      experimentId,
      workbookId,
      pinnedVersionId,
      adminUserId,
    );
    await started;
    const replacement = await attachUseCase.execute(
      experimentId,
      otherWorkbook.id,
      workbookId,
      pinnedVersionId,
      adminUserId,
    );
    assertSuccess(replacement);
    releaseDetach?.();

    const staleResult = await staleDetach;
    assertFailure(staleResult);
    expect(staleResult.error.statusCode).toBe(409);

    const current = await experimentRepo.findOne(experimentId);
    assertSuccess(current);
    expect(current.value?.workbookId).toBe(otherWorkbook.id);
    expect(current.value?.workbookVersionId).toBe(replacement.value.workbookVersionId);
    const flow = await flowRepo.getByExperimentId(experimentId);
    assertSuccess(flow);
    expect(flow.value?.graph.nodes[0]).toMatchObject({ id: "b" });
  });
});
