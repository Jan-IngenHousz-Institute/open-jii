import { assertFailure, assertSuccess, failure, AppError } from "../../../../common/utils/fp-utils";
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
  let adminUserId: string;
  let experimentId: string;
  let workbookId: string;

  beforeAll(async () => {
    await testApp.setup();
  });

  beforeEach(async () => {
    await testApp.beforeEach();
    adminUserId = await testApp.createTestUser({});

    attachUseCase = testApp.module.get(AttachWorkbookUseCase);
    detachUseCase = testApp.module.get(DetachWorkbookUseCase);
    flowRepo = testApp.module.get(FlowRepository);

    const { experiment } = await testApp.createExperiment({
      name: "Test Experiment",
      userId: adminUserId,
    });
    experimentId = experiment.id;

    const workbook = await testApp.createWorkbook({
      name: "Test Workbook",
      // Non-empty so attach materializes a real flow row that detach removes.
      cells: [{ id: "md1", type: "markdown", content: "Hello", isCollapsed: false }],
      createdBy: adminUserId,
    });
    workbookId = workbook.id;

    await attachUseCase.execute(experimentId, workbookId, adminUserId);
  });

  afterEach(() => {
    vi.restoreAllMocks();
    testApp.afterEach();
  });

  afterAll(async () => {
    await testApp.teardown();
  });

  it("detaches the workbook and clears workbookId", async () => {
    const result = await detachUseCase.execute(experimentId, adminUserId);
    assertSuccess(result);
    expect(result.value.workbookId).toBeNull();
  });

  it("keeps workbookVersionId after detach for historical reference", async () => {
    const result = await detachUseCase.execute(experimentId, adminUserId);
    assertSuccess(result);
    expect(result.value.workbookVersionId).toBeDefined();
  });

  it("returns failure when experiment not found", async () => {
    const result = await detachUseCase.execute("00000000-0000-0000-0000-000000000000", adminUserId);
    assertFailure(result);
    expect(result.error.statusCode).toBe(404);
  });

  it("returns failure when no workbook is attached", async () => {
    await detachUseCase.execute(experimentId, adminUserId);

    const result = await detachUseCase.execute(experimentId, adminUserId);
    assertFailure(result);
    expect(result.error.statusCode).toBe(400);
  });

  it("removes the materialised flow row so mobile no longer sees the graph", async () => {
    const before = await flowRepo.getByExperimentId(experimentId);
    assertSuccess(before);
    expect(before.value).not.toBeNull();

    const result = await detachUseCase.execute(experimentId, adminUserId);
    assertSuccess(result);

    const after = await flowRepo.getByExperimentId(experimentId);
    assertSuccess(after);
    expect(after.value).toBeNull();
  });

  it("rolls back the pointer AND keeps the flow when the flow delete fails", async () => {
    const experimentRepo = testApp.module.get(ExperimentRepository);
    vi.spyOn(flowRepo, "deleteByExperimentId").mockResolvedValue(
      failure(AppError.internal("delete boom")),
    );

    const result = await detachUseCase.execute(experimentId, adminUserId);
    assertFailure(result);

    // Still attached and the flow row is intact (whole bind rolled back).
    const after = await experimentRepo.checkAccess(experimentId, adminUserId);
    assertSuccess(after);
    expect(after.value.experiment?.workbookId).toBe(workbookId);
    const flow = await flowRepo.getByExperimentId(experimentId);
    assertSuccess(flow);
    expect(flow.value).not.toBeNull();
  });
});
