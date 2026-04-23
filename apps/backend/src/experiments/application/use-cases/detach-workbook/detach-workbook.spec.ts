import { assertFailure, assertSuccess } from "../../../../common/utils/fp-utils";
import { TestHarness } from "../../../../test/test-harness";
import { AttachWorkbookUseCase } from "../attach-workbook/attach-workbook";
import { DetachWorkbookUseCase } from "./detach-workbook";

describe("DetachWorkbookUseCase", () => {
  const testApp = TestHarness.App;
  let attachUseCase: AttachWorkbookUseCase;
  let detachUseCase: DetachWorkbookUseCase;
  let adminUserId: string;
  let memberUserId: string;
  let experimentId: string;
  let workbookId: string;

  beforeAll(async () => {
    await testApp.setup();
  });

  beforeEach(async () => {
    await testApp.beforeEach();
    adminUserId = await testApp.createTestUser({});
    memberUserId = await testApp.createTestUser({ email: "member@test.com" });

    attachUseCase = testApp.module.get(AttachWorkbookUseCase);
    detachUseCase = testApp.module.get(DetachWorkbookUseCase);

    const { experiment } = await testApp.createExperiment({
      name: "Test Experiment",
      userId: adminUserId,
    });
    experimentId = experiment.id;

    await testApp.addExperimentMember(experimentId, memberUserId, "member");

    const workbook = await testApp.createWorkbook({
      name: "Test Workbook",
      createdBy: adminUserId,
    });
    workbookId = workbook.id;

    // Attach workbook first so we can detach it
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
    // workbookVersionId should remain set (historical)
    expect(result.value.workbookVersionId).toBeDefined();
  });

  it("returns failure when experiment not found", async () => {
    const result = await detachUseCase.execute("00000000-0000-0000-0000-000000000000", adminUserId);
    assertFailure(result);
    expect(result.error.statusCode).toBe(404);
  });

  it("returns failure when user is not admin", async () => {
    const result = await detachUseCase.execute(experimentId, memberUserId);
    assertFailure(result);
    expect(result.error.statusCode).toBe(403);
  });

  it("returns failure when no workbook is attached", async () => {
    // First detach
    await detachUseCase.execute(experimentId, adminUserId);

    // Try to detach again
    const result = await detachUseCase.execute(experimentId, adminUserId);
    assertFailure(result);
    expect(result.error.statusCode).toBe(400);
  });
});
