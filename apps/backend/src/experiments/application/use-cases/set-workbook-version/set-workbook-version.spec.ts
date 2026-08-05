import { assertFailure, assertSuccess, failure, AppError } from "../../../../common/utils/fp-utils";
import { TestHarness } from "../../../../test/test-harness";
import { PublishVersionUseCase } from "../../../../workbooks/application/use-cases/publish-version/publish-version";
import { WorkbookRepository } from "../../../../workbooks/core/repositories/workbook.repository";
import { ExperimentRepository } from "../../../core/repositories/experiment.repository";
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

  let adminUserId: string;
  let experimentId: string;
  let workbookId: string;
  let v1Id: string;
  let v2Id: string;
  let workbookRevision: number;

  beforeAll(async () => {
    await testApp.setup();
  });

  beforeEach(async () => {
    await testApp.beforeEach();
    adminUserId = await testApp.createTestUser({});

    attachUseCase = testApp.module.get(AttachWorkbookUseCase);
    upgradeUseCase = testApp.module.get(UpgradeWorkbookVersionUseCase);
    setUseCase = testApp.module.get(SetWorkbookVersionUseCase);
    publishUseCase = testApp.module.get(PublishVersionUseCase);
    workbookRepo = testApp.module.get(WorkbookRepository);
    experimentRepo = testApp.module.get(ExperimentRepository);

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

    // Attach publishes + pins v1.
    const attach = await attachUseCase.execute(
      experimentId,
      workbookId,
      null,
      null,
      workbook.revision,
      adminUserId,
    );
    assertSuccess(attach);
    v1Id = attach.value.workbookVersionId;

    // Change cells and upgrade to mint + pin v2.
    const updated = await workbookRepo.update(workbookId, workbook.revision, {
      cells: [{ id: "md1", type: "markdown", content: "v2", isCollapsed: false }],
    });
    assertSuccess(updated);
    workbookRevision = updated.value[0].revision;
    const upgrade = await upgradeUseCase.execute(
      experimentId,
      workbookId,
      v1Id,
      workbookRevision,
      adminUserId,
    );
    assertSuccess(upgrade);
    v2Id = upgrade.value.workbookVersionId;
  });

  afterEach(() => {
    vi.restoreAllMocks();
    testApp.afterEach();
  });

  afterAll(async () => {
    await testApp.teardown();
  });

  it("rolls the experiment back to an earlier version without publishing", async () => {
    expect(v2Id).not.toBe(v1Id);

    const result = await setUseCase.execute(experimentId, v1Id, workbookId, v2Id, adminUserId);
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
    const result = await setUseCase.execute(experiment.id, v1Id, workbookId, v2Id, adminUserId);
    assertFailure(result);
    expect(result.error.statusCode).toBe(400);
  });

  it("leaves the experiment on its current version when the flow refresh fails", async () => {
    vi.spyOn(experimentRepo, "updateWorkbookAndFlowIfExpected").mockResolvedValue(
      failure(AppError.internal("flow upsert boom")),
    );

    const result = await setUseCase.execute(experimentId, v1Id, workbookId, v2Id, adminUserId);
    assertFailure(result);
    expect(result.error.statusCode).toBe(500);

    // Experiment must NOT have been re-pinned since the flow never updated.
    const access = await experimentRepo.checkAccess(experimentId, adminUserId);
    assertSuccess(access);
    expect(access.value.experiment?.workbookVersionId).toBe(v2Id);
  });

  // Pinning materialises the target version's cells into the experiment, and the
  // route only guards experiment `manage`. So a manager who has lost read access to
  // the attached workbook must not be able to select a version published after the
  // revocation and capture its contents.
  describe("workbook access enforcement", () => {
    /**
     * Experiment administered by `manager`, with a PRIVATE workbook owned by a
     * different user attached. `manager` holds a workbook grant that the test then
     * revokes, reproducing the post-revocation case.
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
      const attach = await attachUseCase.execute(
        experiment.id,
        privateWorkbook.id,
        null,
        null,
        manager,
      );
      assertSuccess(attach);

      // A second version, so there is something other than the pinned one to select.
      await workbookRepo.update(privateWorkbook.id, {
        cells: [{ id: "md1", type: "markdown", content: "post-attach secret", isCollapsed: false }],
      });
      const upgrade = await upgradeUseCase.execute(
        experiment.id,
        privateWorkbook.id,
        attach.value.workbookVersionId,
        manager,
      );
      assertSuccess(upgrade);

      return {
        manager,
        experimentId: experiment.id,
        workbookId: privateWorkbook.id,
        firstVersionId: attach.value.workbookVersionId,
        secondVersionId: upgrade.value.workbookVersionId,
        grant,
      };
    }

    it("allows pinning while the manager still has workbook access", async () => {
      const {
        manager,
        experimentId: expId,
        workbookId,
        firstVersionId,
        secondVersionId,
      } = await setupRevokedManager();

      const result = await setUseCase.execute(
        expId,
        firstVersionId,
        workbookId,
        secondVersionId,
        manager,
      );
      assertSuccess(result);
      expect(result.value.workbookVersionId).toBe(firstVersionId);
    });

    it("denies pinning a workbook version after the workbook grant is revoked", async () => {
      const {
        manager,
        experimentId: expId,
        workbookId,
        firstVersionId,
        secondVersionId,
        grant,
      } = await setupRevokedManager();
      await testApp.removeResourceGrant(grant.id);

      const result = await setUseCase.execute(
        expId,
        firstVersionId,
        workbookId,
        secondVersionId,
        manager,
      );
      assertFailure(result);
      expect(result.error.statusCode).toBe(403);
    });

    it("leaves the experiment on its current version when the pin is refused", async () => {
      const {
        manager,
        experimentId: expId,
        workbookId,
        firstVersionId,
        secondVersionId,
        grant,
      } = await setupRevokedManager();
      await testApp.removeResourceGrant(grant.id);

      assertFailure(
        await setUseCase.execute(expId, firstVersionId, workbookId, secondVersionId, manager),
      );

      const access = await experimentRepo.checkAccess(expId, manager);
      assertSuccess(access);
      expect(access.value.experiment?.workbookVersionId).toBe(secondVersionId);
    });
  });

  it("rejects a version that belongs to a different workbook", async () => {
    const otherWorkbook = await testApp.createWorkbook({
      name: "Other Workbook",
      cells: [{ id: "md1", type: "markdown", content: "x", isCollapsed: false }],
      createdBy: adminUserId,
    });
    const foreign = await publishUseCase.execute(otherWorkbook.id, adminUserId);
    assertSuccess(foreign);

    const result = await setUseCase.execute(
      experimentId,
      foreign.value.id,
      workbookId,
      v2Id,
      adminUserId,
    );
    assertFailure(result);
    expect(result.error.statusCode).toBe(404);
  });

  it("cannot restore onto a replacement workbook when an older restore completes last", async () => {
    const otherWorkbook = await testApp.createWorkbook({
      name: "Replacement",
      cells: [{ id: "b", type: "markdown", content: "B", isCollapsed: false }],
      createdBy: adminUserId,
    });

    let releaseRestore: (() => void) | undefined;
    let restoreStarted: (() => void) | undefined;
    const started = new Promise<void>((resolve) => {
      restoreStarted = resolve;
    });
    const gate = new Promise<void>((resolve) => {
      releaseRestore = resolve;
    });
    const updatePair = experimentRepo.updateWorkbookAndFlowIfExpected.bind(experimentRepo);
    vi.spyOn(experimentRepo, "updateWorkbookAndFlowIfExpected").mockImplementation(
      async (...args) => {
        if (args[2].workbookVersionId === v1Id) {
          restoreStarted?.();
          await gate;
        }
        return updatePair(...args);
      },
    );

    const staleRestore = setUseCase.execute(experimentId, v1Id, workbookId, v2Id, adminUserId);
    await started;
    const replacement = await attachUseCase.execute(
      experimentId,
      otherWorkbook.id,
      workbookId,
      v2Id,
      otherWorkbook.revision,
      adminUserId,
    );
    assertSuccess(replacement);
    releaseRestore?.();

    const staleResult = await staleRestore;
    assertFailure(staleResult);
    expect(staleResult.error.statusCode).toBe(409);

    const current = await experimentRepo.findOne(experimentId);
    assertSuccess(current);
    expect(current.value?.workbookId).toBe(otherWorkbook.id);
    expect(current.value?.workbookVersionId).toBe(replacement.value.workbookVersionId);
  });
});
