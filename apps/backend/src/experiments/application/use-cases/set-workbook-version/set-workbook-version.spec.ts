import { assertFailure, assertSuccess, failure, AppError } from "../../../../common/utils/fp-utils";
import { TestHarness } from "../../../../test/test-harness";
import { PublishVersionUseCase } from "../../../../workbooks/application/use-cases/publish-version/publish-version";
import { WorkbookRepository } from "../../../../workbooks/core/repositories/workbook.repository";
import { ExperimentRepository } from "../../../core/repositories/experiment.repository";
import { FlowRepository } from "../../../core/repositories/flow.repository";
import { AttachWorkbookUseCase } from "../attach-workbook/attach-workbook";
import { UpgradeWorkbookVersionUseCase } from "../upgrade-workbook-version/upgrade-workbook-version";
import { SetWorkbookVersionUseCase } from "./set-workbook-version";

describe("SetWorkbookVersionUseCase", () => {
  const testApp = TestHarness.App;
  let attachUseCase: AttachWorkbookUseCase;
  let upgradeUseCase: UpgradeWorkbookVersionUseCase;
  let setUseCase: SetWorkbookVersionUseCase;
  let publishUseCase: PublishVersionUseCase;
  let workbookRepo: WorkbookRepository;
  let experimentRepo: ExperimentRepository;
  let flowRepo: FlowRepository;

  let adminUserId: string;
  let memberUserId: string;
  let experimentId: string;
  let workbookId: string;
  let v1Id: string;
  let v2Id: string;

  beforeAll(async () => {
    await testApp.setup();
  });

  beforeEach(async () => {
    await testApp.beforeEach();
    adminUserId = await testApp.createTestUser({});
    memberUserId = await testApp.createTestUser({ email: "member@test.com" });

    attachUseCase = testApp.module.get(AttachWorkbookUseCase);
    upgradeUseCase = testApp.module.get(UpgradeWorkbookVersionUseCase);
    setUseCase = testApp.module.get(SetWorkbookVersionUseCase);
    publishUseCase = testApp.module.get(PublishVersionUseCase);
    workbookRepo = testApp.module.get(WorkbookRepository);
    experimentRepo = testApp.module.get(ExperimentRepository);
    flowRepo = testApp.module.get(FlowRepository);

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

    // Attach publishes + pins v1.
    const attach = await attachUseCase.execute(experimentId, workbookId, adminUserId);
    assertSuccess(attach);
    v1Id = attach.value.workbookVersionId;

    // Change cells and upgrade to mint + pin v2.
    await workbookRepo.update(workbookId, {
      cells: [{ id: "md1", type: "markdown", content: "v2", isCollapsed: false }],
    });
    const upgrade = await upgradeUseCase.execute(experimentId, adminUserId);
    assertSuccess(upgrade);
    v2Id = upgrade.value.workbookVersionId;
  });

  afterEach(() => {
    testApp.afterEach();
  });

  afterAll(async () => {
    await testApp.teardown();
  });

  it("rolls the experiment back to an earlier version without publishing", async () => {
    expect(v2Id).not.toBe(v1Id);

    const result = await setUseCase.execute(experimentId, v1Id, adminUserId);
    assertSuccess(result);
    expect(result.value.workbookVersionId).toBe(v1Id);
    expect(result.value.version).toBe(1);

    const access = await experimentRepo.checkAccess(experimentId, adminUserId);
    assertSuccess(access);
    expect(access.value.experiment?.workbookVersionId).toBe(v1Id);
  });

  it("rejects when the experiment has no attached workbook", async () => {
    const { experiment } = await testApp.createExperiment({
      name: "No workbook experiment",
      userId: adminUserId,
    });
    const result = await setUseCase.execute(experiment.id, v1Id, adminUserId);
    assertFailure(result);
    expect(result.error.statusCode).toBe(400);
  });

  it("leaves the experiment on its current version when the flow refresh fails", async () => {
    vi.spyOn(flowRepo, "upsert").mockResolvedValue(failure(AppError.internal("flow upsert boom")));

    const result = await setUseCase.execute(experimentId, v1Id, adminUserId);
    assertFailure(result);
    expect(result.error.statusCode).toBe(500);

    // Experiment must NOT have been re-pinned since the flow never updated.
    const access = await experimentRepo.checkAccess(experimentId, adminUserId);
    assertSuccess(access);
    expect(access.value.experiment?.workbookVersionId).toBe(v2Id);
  });

  it("rejects a non-admin", async () => {
    const result = await setUseCase.execute(experimentId, v1Id, memberUserId);
    assertFailure(result);
    expect(result.error.statusCode).toBe(403);
  });

  it("rejects a version that belongs to a different workbook", async () => {
    const otherWorkbook = await testApp.createWorkbook({
      name: "Other Workbook",
      cells: [{ id: "md1", type: "markdown", content: "x", isCollapsed: false }],
      createdBy: adminUserId,
    });
    const foreign = await publishUseCase.execute(otherWorkbook.id, adminUserId);
    assertSuccess(foreign);

    const result = await setUseCase.execute(experimentId, foreign.value.id, adminUserId);
    assertFailure(result);
    expect(result.error.statusCode).toBe(404);
  });
});
