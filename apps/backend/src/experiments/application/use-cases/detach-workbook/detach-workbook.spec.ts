import { assertFailure, assertSuccess } from "../../../../common/utils/fp-utils";
import { TestHarness } from "../../../../test/test-harness";
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
      createdBy: adminUserId,
    });
    workbookId = workbook.id;

    await attachUseCase.execute(experimentId, workbookId, adminUserId);
  });

  afterEach(() => {
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
});
