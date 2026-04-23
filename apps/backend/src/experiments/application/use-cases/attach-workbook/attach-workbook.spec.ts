import { assertFailure, assertSuccess } from "../../../../common/utils/fp-utils";
import { TestHarness } from "../../../../test/test-harness";
import { AttachWorkbookUseCase } from "./attach-workbook";

describe("AttachWorkbookUseCase", () => {
  const testApp = TestHarness.App;
  let useCase: AttachWorkbookUseCase;
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

    // Create experiment (admin becomes admin member)
    const { experiment } = await testApp.createExperiment({
      name: "Test Experiment",
      userId: adminUserId,
    });
    experimentId = experiment.id;

    // Add member as non-admin
    await testApp.addExperimentMember(experimentId, memberUserId, "member");

    // Create workbook
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
});
