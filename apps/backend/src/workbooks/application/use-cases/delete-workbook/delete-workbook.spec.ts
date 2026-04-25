import { assertFailure, assertSuccess, failure, AppError } from "../../../../common/utils/fp-utils";
import { TestHarness } from "../../../../test/test-harness";
import { WorkbookRepository } from "../../../core/repositories/workbook.repository";
import { GetWorkbookUseCase } from "../get-workbook/get-workbook";
import { DeleteWorkbookUseCase } from "./delete-workbook";

describe("DeleteWorkbookUseCase", () => {
  const testApp = TestHarness.App;
  let useCase: DeleteWorkbookUseCase;
  let getUseCase: GetWorkbookUseCase;
  let repo: WorkbookRepository;
  let userId: string;

  beforeAll(async () => {
    await testApp.setup();
  });

  beforeEach(async () => {
    await testApp.beforeEach();
    userId = await testApp.createTestUser({});
    useCase = testApp.module.get(DeleteWorkbookUseCase);
    getUseCase = testApp.module.get(GetWorkbookUseCase);
    repo = testApp.module.get(WorkbookRepository);
  });

  afterEach(() => {
    testApp.afterEach();
  });

  afterAll(async () => {
    await testApp.teardown();
  });

  it("deletes a workbook owned by the user", async () => {
    const workbook = await testApp.createWorkbook({ name: "WB", createdBy: userId });
    const result = await useCase.execute(workbook.id, userId);
    assertSuccess(result);

    // Verify it no longer exists
    const getResult = await getUseCase.execute(workbook.id, userId);
    assertFailure(getResult);
    expect(getResult.error.statusCode).toBe(404);
  });

  it("returns 404 when workbook does not exist", async () => {
    const result = await useCase.execute("00000000-0000-0000-0000-000000000000", userId);
    assertFailure(result);
    expect(result.error.statusCode).toBe(404);
  });

  it("returns 403 when non-owner tries to delete", async () => {
    const otherUser = await testApp.createTestUser({});
    const workbook = await testApp.createWorkbook({ name: "WB", createdBy: userId });
    const result = await useCase.execute(workbook.id, otherUser);
    assertFailure(result);
    expect(result.error.statusCode).toBe(403);
  });

  it("does not delete other workbooks", async () => {
    const wb1 = await testApp.createWorkbook({ name: "WB 1", createdBy: userId });
    const wb2 = await testApp.createWorkbook({ name: "WB 2", createdBy: userId });
    await useCase.execute(wb1.id, userId);

    const getResult = await getUseCase.execute(wb2.id, userId);
    assertSuccess(getResult);
    expect(getResult.value.id).toBe(wb2.id);
  });

  it("returns failure when repository findById fails", async () => {
    vi.spyOn(repo, "findById").mockResolvedValue(failure(AppError.internal("DB error")));
    const result = await useCase.execute("00000000-0000-0000-0000-000000000000", userId);
    assertFailure(result);
    expect(result.error.statusCode).toBe(500);
    vi.restoreAllMocks();
  });

  it("returns failure when repository delete fails", async () => {
    const workbook = await testApp.createWorkbook({ name: "WB", createdBy: userId });
    vi.spyOn(repo, "delete").mockResolvedValue(failure(AppError.internal("DB error")));
    const result = await useCase.execute(workbook.id, userId);
    assertFailure(result);
    expect(result.error.statusCode).toBe(500);
    vi.restoreAllMocks();
  });
});
