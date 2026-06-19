import { assertFailure, assertSuccess, success } from "../../../../common/utils/fp-utils";
import { TestHarness } from "../../../../test/test-harness";
import type { WorkbookVersionDto } from "../../../../workbooks/core/models/workbook-version.model";
import { WorkbookVersionRepository } from "../../../../workbooks/core/repositories/workbook-version.repository";
import { FlowRepository } from "../../../core/repositories/flow.repository";
import { AttachWorkbookUseCase } from "./attach-workbook";

describe("AttachWorkbookUseCase", () => {
  const testApp = TestHarness.App;
  let useCase: AttachWorkbookUseCase;
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
    useCase = testApp.module.get(AttachWorkbookUseCase);
    flowRepo = testApp.module.get(FlowRepository);

    const { experiment } = await testApp.createExperiment({
      name: "Test Experiment",
      userId: adminUserId,
    });
    experimentId = experiment.id;

    await testApp.addExperimentMember(experimentId, memberUserId, "member");

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

  it("returns failure when user is not admin", async () => {
    const result = await useCase.execute(experimentId, workbookId, memberUserId);
    assertFailure(result);
    expect(result.error.statusCode).toBe(403);
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

  it("returns failure when the resolved version belongs to another workbook (OJD-1626)", async () => {
    const versionRepo = testApp.module.get(WorkbookVersionRepository);
    // Cells match the workbook so it reads as not-upgradable and the use-case
    // takes the "reuse latest" branch, surfacing the foreign/invalid version.
    vi.spyOn(versionRepo, "getLatestVersion").mockResolvedValue(
      success({
        id: "ver-foreign",
        workbookId: "99999999-9999-9999-9999-999999999999",
        version: 1,
        cells: [{ id: "md1", type: "markdown", content: "Hello", isCollapsed: false }],
        metadata: {},
        entitySnapshots: { protocols: {}, macros: {} },
        createdAt: new Date(),
        createdBy: adminUserId,
      } as unknown as WorkbookVersionDto),
    );

    const result = await useCase.execute(experimentId, workbookId, adminUserId);
    assertFailure(result);
    expect(result.error.statusCode).toBe(404);
    vi.restoreAllMocks();
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
});
