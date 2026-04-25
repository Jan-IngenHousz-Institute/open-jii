import { assertFailure, assertSuccess, failure, AppError } from "../../../../common/utils/fp-utils";
import { TestHarness } from "../../../../test/test-harness";
import { WorkbookVersionRepository } from "../../../core/repositories/workbook-version.repository";
import { WorkbookRepository } from "../../../core/repositories/workbook.repository";
import { PublishVersionUseCase } from "./publish-version";

describe("PublishVersionUseCase", () => {
  const testApp = TestHarness.App;
  let useCase: PublishVersionUseCase;
  let workbookRepo: WorkbookRepository;
  let versionRepo: WorkbookVersionRepository;
  let userId: string;

  beforeAll(async () => {
    await testApp.setup();
  });

  beforeEach(async () => {
    await testApp.beforeEach();
    userId = await testApp.createTestUser({});
    useCase = testApp.module.get(PublishVersionUseCase);
    workbookRepo = testApp.module.get(WorkbookRepository);
    versionRepo = testApp.module.get(WorkbookVersionRepository);
  });

  afterEach(() => {
    testApp.afterEach();
  });

  afterAll(async () => {
    await testApp.teardown();
  });

  it("creates version 1 for a workbook with no existing versions", async () => {
    const workbook = await testApp.createWorkbook({ name: "WB1", createdBy: userId });

    const result = await useCase.execute(workbook.id, userId);
    assertSuccess(result);
    expect(result.value.version).toBe(1);
    expect(result.value.workbookId).toBe(workbook.id);
    expect(result.value.createdBy).toBe(userId);
  });

  it("reuses existing version when cells have not changed", async () => {
    const workbook = await testApp.createWorkbook({
      name: "WB2",
      cells: [{ id: "md1", type: "markdown", content: "Hello", isCollapsed: false }],
      createdBy: userId,
    });

    const first = await useCase.execute(workbook.id, userId);
    assertSuccess(first);

    const second = await useCase.execute(workbook.id, userId);
    assertSuccess(second);

    expect(second.value.id).toBe(first.value.id);
    expect(second.value.version).toBe(1);
  });

  it("creates a new version when cells have changed", async () => {
    const workbook = await testApp.createWorkbook({
      name: "WB3",
      cells: [{ id: "md1", type: "markdown", content: "v1", isCollapsed: false }],
      createdBy: userId,
    });

    const v1 = await useCase.execute(workbook.id, userId);
    assertSuccess(v1);
    expect(v1.value.version).toBe(1);

    // Update workbook cells directly
    await workbookRepo.update(workbook.id, {
      cells: [{ id: "md1", type: "markdown", content: "v2", isCollapsed: false }],
    });

    const v2 = await useCase.execute(workbook.id, userId);
    assertSuccess(v2);
    expect(v2.value.version).toBe(2);
    expect(v2.value.id).not.toBe(v1.value.id);
  });

  it("returns failure when workbook does not exist", async () => {
    const result = await useCase.execute("00000000-0000-0000-0000-000000000000", userId);
    assertFailure(result);
    expect(result.error.statusCode).toBe(404);
  });

  it("returns failure when workbook repo findById fails", async () => {
    vi.spyOn(workbookRepo, "findById").mockResolvedValue(failure(AppError.internal("DB error")));
    const result = await useCase.execute("00000000-0000-0000-0000-000000000000", userId);
    assertFailure(result);
    vi.restoreAllMocks();
  });

  it("returns failure when version repo create fails", async () => {
    const workbook = await testApp.createWorkbook({ name: "WBFail", createdBy: userId });
    vi.spyOn(versionRepo, "create").mockResolvedValue(failure(AppError.internal("DB error")));
    const result = await useCase.execute(workbook.id, userId);
    assertFailure(result);
    vi.restoreAllMocks();
  });

  it("snapshots the current cells of the workbook", async () => {
    const cells = [
      {
        id: "p1",
        type: "protocol",
        isCollapsed: false,
        payload: { protocolId: "11111111-1111-1111-1111-111111111111", version: 1 },
      },
    ];
    const workbook = await testApp.createWorkbook({
      name: "WBSnap",
      cells,
      createdBy: userId,
    });

    const result = await useCase.execute(workbook.id, userId);
    assertSuccess(result);
    expect(result.value.cells).toEqual(cells);
  });
});
