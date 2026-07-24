import { assertFailure, assertSuccess, failure, AppError } from "../../../../common/utils/fp-utils";
import { TestHarness } from "../../../../test/test-harness";
import { WorkbookRepository } from "../../../../workbooks/core/repositories/workbook.repository";
import { ExperimentRepository } from "../../../core/repositories/experiment.repository";
import { FlowRepository } from "../../../core/repositories/flow.repository";
import { AttachWorkbookUseCase } from "../attach-workbook/attach-workbook";
import { UpgradeWorkbookVersionUseCase } from "./upgrade-workbook-version";

describe("UpgradeWorkbookVersionUseCase", () => {
  const testApp = TestHarness.App;
  let attachUseCase: AttachWorkbookUseCase;
  let upgradeUseCase: UpgradeWorkbookVersionUseCase;
  let workbookRepo: WorkbookRepository;
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
    upgradeUseCase = testApp.module.get(UpgradeWorkbookVersionUseCase);
    workbookRepo = testApp.module.get(WorkbookRepository);
    flowRepo = testApp.module.get(FlowRepository);

    const { experiment } = await testApp.createExperiment({
      name: "Test Experiment",
      userId: adminUserId,
    });
    experimentId = experiment.id;

    const workbook = await testApp.createWorkbook({
      name: "Test Workbook",
      cells: [{ id: "md1", type: "markdown", content: "v1", isCollapsed: false }],
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

  it("reuses version when workbook cells are unchanged", async () => {
    const result = await upgradeUseCase.execute(experimentId, adminUserId);
    assertSuccess(result);
    expect(result.value.version).toBe(1);
  });

  it("creates a new version when workbook cells have changed", async () => {
    await workbookRepo.update(workbookId, {
      cells: [{ id: "md1", type: "markdown", content: "v2", isCollapsed: false }],
    });

    const result = await upgradeUseCase.execute(experimentId, adminUserId);
    assertSuccess(result);
    expect(result.value.version).toBe(2);
    expect(result.value.workbookId).toBe(workbookId);
  });

  it("atomically deletes the old flow when upgrading to an empty (no-node) workbook", async () => {
    // Flow exists after attach (beforeEach workbook has a markdown cell).
    const before = await flowRepo.getByExperimentId(experimentId);
    assertSuccess(before);
    expect(before.value).not.toBeNull();

    await workbookRepo.update(workbookId, { cells: [] });
    const result = await upgradeUseCase.execute(experimentId, adminUserId);
    assertSuccess(result);

    const after = await flowRepo.getByExperimentId(experimentId);
    assertSuccess(after);
    expect(after.value).toBeNull();
  });

  it("does not persist a flow when the upgraded cells materialize an invalid graph", async () => {
    await workbookRepo.update(workbookId, {
      cells: [
        { id: "dup", type: "markdown", content: "a", isCollapsed: false },
        { id: "dup", type: "markdown", content: "b", isCollapsed: false },
      ],
    });
    const upsertSpy = vi.spyOn(flowRepo, "upsert");

    const result = await upgradeUseCase.execute(experimentId, adminUserId);

    assertFailure(result);
    expect(result.error.code).toBe("FLOW_MATERIALIZATION_FAILED");
    expect(upsertSpy).not.toHaveBeenCalled();
    vi.restoreAllMocks();
  });

  it("rolls back the version pin when the flow upsert fails", async () => {
    await workbookRepo.update(workbookId, {
      cells: [{ id: "md1", type: "markdown", content: "v2", isCollapsed: false }],
    });
    const experimentRepo = testApp.module.get(ExperimentRepository);
    const before = await experimentRepo.checkAccess(experimentId, adminUserId);
    assertSuccess(before);
    const currentVersionId = before.value.experiment?.workbookVersionId;

    vi.spyOn(flowRepo, "upsert").mockResolvedValue(failure(AppError.internal("flow boom")));

    const result = await upgradeUseCase.execute(experimentId, adminUserId);
    assertFailure(result);

    const after = await experimentRepo.checkAccess(experimentId, adminUserId);
    assertSuccess(after);
    expect(after.value.experiment?.workbookVersionId).toBe(currentVersionId);
  });

  it("rolls back when the pointer update fails", async () => {
    await workbookRepo.update(workbookId, {
      cells: [{ id: "md1", type: "markdown", content: "v2", isCollapsed: false }],
    });
    const experimentRepo = testApp.module.get(ExperimentRepository);
    const before = await experimentRepo.checkAccess(experimentId, adminUserId);
    assertSuccess(before);
    const currentVersionId = before.value.experiment?.workbookVersionId;

    vi.spyOn(experimentRepo, "update").mockResolvedValue(
      failure(AppError.internal("pointer boom")),
    );

    const result = await upgradeUseCase.execute(experimentId, adminUserId);
    assertFailure(result);

    const after = await experimentRepo.checkAccess(experimentId, adminUserId);
    assertSuccess(after);
    expect(after.value.experiment?.workbookVersionId).toBe(currentVersionId);
  });

  it("returns failure when experiment not found", async () => {
    const result = await upgradeUseCase.execute(
      "00000000-0000-0000-0000-000000000000",
      adminUserId,
    );
    assertFailure(result);
    expect(result.error.statusCode).toBe(404);
  });

  it("returns failure when no workbook is attached", async () => {
    const { experiment } = await testApp.createExperiment({
      name: "No Workbook Experiment",
      userId: adminUserId,
    });

    const result = await upgradeUseCase.execute(experiment.id, adminUserId);
    assertFailure(result);
    expect(result.error.statusCode).toBe(400);
  });

  it("refreshes the materialised flow row when cells change (mobile backward compat)", async () => {
    const before = await flowRepo.getByExperimentId(experimentId);
    assertSuccess(before);
    expect(before.value?.graph.nodes[0]).toMatchObject({
      id: "md1",
      content: { text: "v1" },
    });

    await workbookRepo.update(workbookId, {
      cells: [{ id: "md1", type: "markdown", content: "v2", isCollapsed: false }],
    });
    const result = await upgradeUseCase.execute(experimentId, adminUserId);
    assertSuccess(result);

    const after = await flowRepo.getByExperimentId(experimentId);
    assertSuccess(after);
    expect(after.value?.id).toBe(before.value?.id); // same row, overwritten
    expect(after.value?.graph.nodes[0]).toMatchObject({
      id: "md1",
      content: { text: "v2" },
    });
  });
});
