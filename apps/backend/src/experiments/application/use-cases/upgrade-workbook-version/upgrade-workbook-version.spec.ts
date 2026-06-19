import { assertFailure, assertSuccess, success } from "../../../../common/utils/fp-utils";
import { TestHarness } from "../../../../test/test-harness";
import type { WorkbookVersionDto } from "../../../../workbooks/core/models/workbook-version.model";
import { WorkbookVersionRepository } from "../../../../workbooks/core/repositories/workbook-version.repository";
import { WorkbookRepository } from "../../../../workbooks/core/repositories/workbook.repository";
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
    const { experiment } = await testApp.createExperiment({
      name: "No Workbook Experiment",
      userId: adminUserId,
    });

    const result = await upgradeUseCase.execute(experiment.id, adminUserId);
    assertFailure(result);
    expect(result.error.statusCode).toBe(400);
  });

  it("returns failure when the resolved version belongs to another workbook (OJD-1626)", async () => {
    const versionRepo = testApp.module.get(WorkbookVersionRepository);
    // Cells match the workbook so it reads as not-upgradable and the use-case
    // takes the "reuse latest" branch, surfacing the foreign/invalid version.
    vi.spyOn(versionRepo, "getLatestVersion").mockResolvedValue(
      success({
        id: "ver-foreign",
        workbookId: "99999999-9999-9999-9999-999999999999",
        version: 1,
        cells: [{ id: "md1", type: "markdown", content: "v1", isCollapsed: false }],
        metadata: {},
        entitySnapshots: { protocols: {}, macros: {} },
        createdAt: new Date(),
        createdBy: adminUserId,
      } as unknown as WorkbookVersionDto),
    );

    const result = await upgradeUseCase.execute(experimentId, adminUserId);
    assertFailure(result);
    expect(result.error.statusCode).toBe(404);
    vi.restoreAllMocks();
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
