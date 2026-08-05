import { assertFailure, assertSuccess } from "../../../../common/utils/fp-utils";
import { TestHarness } from "../../../../test/test-harness";
import { PublishVersionUseCase } from "../../../../workbooks/application/use-cases/publish-version/publish-version";
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
  let experimentRepo: ExperimentRepository;
  let flowRepo: FlowRepository;
  let publishVersion: PublishVersionUseCase;
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
    experimentRepo = testApp.module.get(ExperimentRepository);
    flowRepo = testApp.module.get(FlowRepository);
    publishVersion = testApp.module.get(PublishVersionUseCase);

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

    await attachUseCase.execute(experimentId, workbookId, null, adminUserId);
  });

  afterEach(() => {
    vi.restoreAllMocks();
    testApp.afterEach();
  });

  afterAll(async () => {
    await testApp.teardown();
  });

  it("reuses version when workbook cells are unchanged", async () => {
    const result = await upgradeUseCase.execute(experimentId, workbookId, adminUserId);
    assertSuccess(result);
    expect(result.value.version).toBe(1);
  });

  it("creates a new version when workbook cells have changed", async () => {
    await workbookRepo.update(workbookId, {
      cells: [{ id: "md1", type: "markdown", content: "v2", isCollapsed: false }],
    });

    const result = await upgradeUseCase.execute(experimentId, workbookId, adminUserId);
    assertSuccess(result);
    expect(result.value.version).toBe(2);
    expect(result.value.workbookId).toBe(workbookId);
  });

  it("returns failure when experiment not found", async () => {
    const result = await upgradeUseCase.execute(
      "00000000-0000-0000-0000-000000000000",
      workbookId,
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

    const result = await upgradeUseCase.execute(experiment.id, workbookId, adminUserId);
    assertFailure(result);
    expect(result.error.statusCode).toBe(400);
  });

  // A user who manages the experiment but has no read access to the attached
  // workbook must not be able to pin or mint workbook state through the upgrade
  // path (the route only guards experiment `manage`).
  describe("workbook access enforcement", () => {
    /**
     * Experiment administered by `manager`, with a PRIVATE workbook owned by a
     * different user attached. `manager` holds a workbook grant that the test
     * then revokes, reproducing the post-revocation case.
     */
    async function setupRevokedManager() {
      const workbookOwner = await testApp.createTestUser({ name: "Workbook Owner" });
      const manager = await testApp.createTestUser({ name: "Experiment Manager" });

      const privateWorkbook = await testApp.createWorkbook({
        name: `Private WB ${crypto.randomUUID()}`,
        cells: [{ id: "md1", type: "markdown", content: "secret", isCollapsed: false }],
        createdBy: workbookOwner,
        visibility: "private",
      });

      const { experiment } = await testApp.createExperiment({
        name: `Managed Exp ${crypto.randomUUID()}`,
        userId: manager,
      });

      // Grant the manager workbook access so the attach succeeds, then revoke it.
      const grant = await testApp.addResourceGrant({
        resourceType: "workbook",
        resourceId: privateWorkbook.id,
        granteeType: "user",
        granteeId: manager,
        role: "admin",
      });
      assertSuccess(await attachUseCase.execute(experiment.id, privateWorkbook.id, manager));

      return { manager, experimentId: experiment.id, workbookId: privateWorkbook.id, grant };
    }

    it("allows the upgrade while the manager still has workbook access", async () => {
      const { manager, experimentId: expId, workbookId: wbId } = await setupRevokedManager();
      await workbookRepo.update(wbId, {
        cells: [{ id: "md1", type: "markdown", content: "v2", isCollapsed: false }],
      });

      const result = await upgradeUseCase.execute(expId, manager);
      assertSuccess(result);
      expect(result.value.version).toBe(2);
    });

    it("denies minting a new version after the workbook grant is revoked", async () => {
      const { manager, experimentId: expId, workbookId: wbId, grant } = await setupRevokedManager();
      await workbookRepo.update(wbId, {
        cells: [{ id: "md1", type: "markdown", content: "post-revocation", isCollapsed: false }],
      });
      await testApp.removeResourceGrant(grant.id);

      const result = await upgradeUseCase.execute(expId, manager);
      assertFailure(result);
      expect(result.error.statusCode).toBe(403);
    });

    it("denies pinning the existing latest version after revocation (never reaches publish)", async () => {
      const { manager, experimentId: expId, grant } = await setupRevokedManager();
      // Cells unchanged → the upgrade would reuse the latest version without
      // publishing, so the check must sit before that branch too.
      await testApp.removeResourceGrant(grant.id);

      const result = await upgradeUseCase.execute(expId, manager);
      assertFailure(result);
      expect(result.error.statusCode).toBe(403);
    });
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
    const result = await upgradeUseCase.execute(experimentId, workbookId, adminUserId);
    assertSuccess(result);

    const after = await flowRepo.getByExperimentId(experimentId);
    assertSuccess(after);
    expect(after.value?.id).toBe(before.value?.id); // same row, overwritten
    expect(after.value?.graph.nodes[0]).toMatchObject({
      id: "md1",
      content: { text: "v2" },
    });
  });

  it("cannot pin an old workbook after a concurrent attachment changes the pairing", async () => {
    await workbookRepo.update(workbookId, {
      cells: [{ id: "md1", type: "markdown", content: "stale A", isCollapsed: false }],
    });
    const otherWorkbook = await testApp.createWorkbook({
      name: "Workbook B",
      cells: [{ id: "md-b", type: "markdown", content: "current B", isCollapsed: false }],
      createdBy: adminUserId,
    });

    let releasePublish: (() => void) | undefined;
    let publishStarted: (() => void) | undefined;
    const started = new Promise<void>((resolve) => {
      publishStarted = resolve;
    });
    const gate = new Promise<void>((resolve) => {
      releasePublish = resolve;
    });
    const publishSpy = vi.spyOn(publishVersion, "execute");
    publishSpy.mockImplementationOnce(async (id, userId) => {
      publishStarted?.();
      await gate;
      publishSpy.mockRestore();
      return publishVersion.execute(id, userId);
    });

    const staleUpgrade = upgradeUseCase.execute(experimentId, workbookId, adminUserId);
    await started;
    const attached = await attachUseCase.execute(
      experimentId,
      otherWorkbook.id,
      workbookId,
      adminUserId,
    );
    assertSuccess(attached);
    releasePublish?.();

    const staleResult = await staleUpgrade;
    assertFailure(staleResult);
    expect(staleResult.error.statusCode).toBe(409);

    const currentExperiment = await experimentRepo.findOne(experimentId);
    assertSuccess(currentExperiment);
    expect(currentExperiment.value?.workbookId).toBe(otherWorkbook.id);
    expect(currentExperiment.value?.workbookVersionId).toBe(attached.value.workbookVersionId);

    const currentFlow = await flowRepo.getByExperimentId(experimentId);
    assertSuccess(currentFlow);
    expect(currentFlow.value?.graph.nodes).toEqual([
      expect.objectContaining({ id: "md-b", content: { text: "current B" } }),
    ]);
  });
});
