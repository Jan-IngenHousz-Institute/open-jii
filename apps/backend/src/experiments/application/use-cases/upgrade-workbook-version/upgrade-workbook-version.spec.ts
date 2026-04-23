import { assertFailure, assertSuccess } from "../../../../common/utils/fp-utils";
import { TestHarness } from "../../../../test/test-harness";
import { WorkbookRepository } from "../../../../workbooks/core/repositories/workbook.repository";
import { AttachWorkbookUseCase } from "../attach-workbook/attach-workbook";
import { UpgradeWorkbookVersionUseCase } from "./upgrade-workbook-version";

describe("UpgradeWorkbookVersionUseCase", () => {
  const testApp = TestHarness.App;
  let attachUseCase: AttachWorkbookUseCase;
  let upgradeUseCase: UpgradeWorkbookVersionUseCase;
  let workbookRepo: WorkbookRepository;
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
    upgradeUseCase = testApp.module.get(UpgradeWorkbookVersionUseCase);
    workbookRepo = testApp.module.get(WorkbookRepository);

    const { experiment } = await testApp.createExperiment({
      name: "Test Experiment",
      userId: adminUserId,
    });
    experimentId = experiment.id;

    await testApp.addExperimentMember(experimentId, memberUserId, "member");

    const workbook = await testApp.createWorkbook({
      name: "Test Workbook",
      cells: [{ id: "md1", type: "markdown", content: "v1", isCollapsed: false }],
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

  it("reuses version when workbook cells are unchanged", async () => {
    const result = await upgradeUseCase.execute(experimentId, adminUserId);
    assertSuccess(result);
    expect(result.value.version).toBe(1);
  });

  it("creates a new version when workbook cells have changed", async () => {
    // Modify workbook cells
    await workbookRepo.update(workbookId, {
      cells: [{ id: "md1", type: "markdown", content: "v2", isCollapsed: false }],
    });

    const result = await upgradeUseCase.execute(experimentId, adminUserId);
    assertSuccess(result);
    expect(result.value.version).toBe(2);
    expect(result.value.workbookId).toBe(workbookId);
  });

  it("returns failure when experiment not found", async () => {
    const result = await upgradeUseCase.execute(
      "00000000-0000-0000-0000-000000000000",
      adminUserId,
    );
    assertFailure(result);
    expect(result.error.statusCode).toBe(404);
  });

  it("returns failure when user is not admin", async () => {
    const result = await upgradeUseCase.execute(experimentId, memberUserId);
    assertFailure(result);
    expect(result.error.statusCode).toBe(403);
  });

  it("returns failure when no workbook is attached", async () => {
    // Create experiment without a workbook
    const { experiment } = await testApp.createExperiment({
      name: "No Workbook Experiment",
      userId: adminUserId,
    });

    const result = await upgradeUseCase.execute(experiment.id, adminUserId);
    assertFailure(result);
    expect(result.error.statusCode).toBe(400);
  });
});
