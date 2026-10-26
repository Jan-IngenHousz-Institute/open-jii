import { assertFailure, assertSuccess } from "../../../../common/utils/fp-utils";
import { notificationsFor } from "../../../../test/resource-audience";
import { TestHarness } from "../../../../test/test-harness";
import { WorkbookRepository } from "../../../../workbooks/core/repositories/workbook.repository";
import { FlowRepository } from "../../../core/repositories/flow.repository";
import { AttachWorkbookUseCase } from "./attach-workbook";

describe("AttachWorkbookUseCase", () => {
  const testApp = TestHarness.App;
  let useCase: AttachWorkbookUseCase;
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
    useCase = testApp.module.get(AttachWorkbookUseCase);
    flowRepo = testApp.module.get(FlowRepository);

    const { experiment } = await testApp.createExperiment({
      name: "Test Experiment",
      userId: adminUserId,
    });
    experimentId = experiment.id;

    const workbook = await testApp.createWorkbook({
      name: "Test Workbook",
      cells: [{ id: "md1", type: "markdown", content: "Hello", isCollapsed: false }],
      createdBy: adminUserId,
    });
    workbookId = workbook.id;
  });

  afterEach(() => {
    testApp.afterEach();
  });

  afterAll(async () => {
    await testApp.teardown();
  });

  it("attaches a workbook and creates version 1", async () => {
    const result = await useCase.execute(experimentId, workbookId, adminUserId);
    assertSuccess(result);
    expect(result.value.workbookId).toBe(workbookId);
    expect(result.value.version).toBe(1);
    expect(result.value.workbookVersionId).toBeDefined();
  });

  it("returns failure when experiment not found", async () => {
    const result = await useCase.execute(
      "00000000-0000-0000-0000-000000000000",
      workbookId,
      adminUserId,
    );
    assertFailure(result);
    expect(result.error.statusCode).toBe(404);
  });

  it("returns failure when workbook not found", async () => {
    const result = await useCase.execute(
      experimentId,
      "00000000-0000-0000-0000-000000000000",
      adminUserId,
    );
    assertFailure(result);
    expect(result.error.statusCode).toBe(404);
  });

  it("reuses version when attaching same workbook again with unchanged cells", async () => {
    const first = await useCase.execute(experimentId, workbookId, adminUserId);
    assertSuccess(first);

    const second = await useCase.execute(experimentId, workbookId, adminUserId);
    assertSuccess(second);

    expect(second.value.workbookVersionId).toBe(first.value.workbookVersionId);
    expect(second.value.version).toBe(1);
  });

  it("denies attaching a private workbook the caller cannot read", async () => {
    // The route only guards `manage` on the experiment; attaching a workbook the
    // caller has no read access to would materialise its design into their flow.
    const otherUser = await testApp.createTestUser({});
    const otherOrgId = await testApp.createOrganization();
    await testApp.addOrganizationMember(otherOrgId, otherUser, "owner");
    const privateWorkbook = await testApp.createWorkbook({
      name: "Private Workbook",
      cells: [{ id: "md1", type: "markdown", content: "secret", isCollapsed: false }],
      createdBy: otherUser,
      visibility: "private",
      organizationId: otherOrgId,
    });

    const result = await useCase.execute(experimentId, privateWorkbook.id, adminUserId);
    assertFailure(result);
    expect(result.error.statusCode).toBe(403);
  });

  it("materialises a flow row from the version's cells (mobile backward compat)", async () => {
    const result = await useCase.execute(experimentId, workbookId, adminUserId);
    assertSuccess(result);

    const flow = await flowRepo.getByExperimentId(experimentId);
    assertSuccess(flow);
    expect(flow.value).not.toBeNull();
    expect(flow.value?.graph.nodes).toHaveLength(1);
    expect(flow.value?.graph.nodes[0]).toMatchObject({ id: "md1", type: "instruction" });
    expect(flow.value?.graph.edges).toHaveLength(0);
  });

  /**
   * A second experiment on the same workbook, administered by someone else and by the
   * acting admin, who must not hear about their own save; and a co-admin on the first,
   * who must not hear about their own experiment.
   */
  async function shareWorkbookWithAnotherExperiment() {
    const otherAdmin = await testApp.createTestUser({ name: "Other Admin" });
    const coAdmin = await testApp.createTestUser({ name: "Co Admin" });
    await testApp.addResourceGrant({
      resourceType: "experiment",
      resourceId: experimentId,
      granteeType: "user",
      granteeId: coAdmin,
      role: "admin",
    });
    await testApp.addResourceGrant({
      resourceType: "workbook",
      resourceId: workbookId,
      granteeType: "user",
      granteeId: otherAdmin,
      role: "viewer",
    });
    const { experiment: otherExperiment } = await testApp.createExperiment({
      name: "Other Experiment",
      userId: otherAdmin,
    });
    await testApp.addResourceGrant({
      resourceType: "experiment",
      resourceId: otherExperiment.id,
      granteeType: "user",
      granteeId: adminUserId,
      role: "admin",
    });
    assertSuccess(await useCase.execute(otherExperiment.id, workbookId, otherAdmin));

    return { otherAdmin, coAdmin, otherExperimentId: otherExperiment.id };
  }

  it("tells the admins of another experiment on the workbook, not those of this one", async () => {
    assertSuccess(await useCase.execute(experimentId, workbookId, adminUserId));
    const { otherAdmin, coAdmin, otherExperimentId } = await shareWorkbookWithAnotherExperiment();
    await testApp.module.get(WorkbookRepository).update(workbookId, {
      cells: [{ id: "md1", type: "markdown", content: "Changed", isCollapsed: false }],
    });

    const result = await useCase.execute(experimentId, workbookId, adminUserId);

    assertSuccess(result);
    expect(result.value.version).toBe(2);

    expect(await notificationsFor(testApp, otherAdmin)).toEqual([
      {
        type: "workbook_version_published",
        recipientId: otherAdmin,
        actorId: adminUserId,
        resourceType: "experiment",
        resourceId: otherExperimentId,
        params: {
          experimentName: "Other Experiment",
          workbookName: "Test Workbook",
          version: "2",
        },
      },
    ]);
    expect(await notificationsFor(testApp, coAdmin)).toEqual([]);
    expect(await notificationsFor(testApp, adminUserId)).toEqual([]);
  });
});
