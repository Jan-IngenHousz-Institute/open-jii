import {
  assertFailure,
  assertSuccess,
  failure,
  success,
  AppError,
} from "../../../../common/utils/fp-utils";
import { TestHarness } from "../../../../test/test-harness";
import { WorkbookRepository } from "../../../core/repositories/workbook.repository";
import { UpdateWorkbookUseCase } from "./update-workbook";

describe("UpdateWorkbookUseCase", () => {
  const testApp = TestHarness.App;
  let useCase: UpdateWorkbookUseCase;
  let repo: WorkbookRepository;
  let userId: string;

  beforeAll(async () => {
    await testApp.setup();
  });

  beforeEach(async () => {
    await testApp.beforeEach();
    userId = await testApp.createTestUser({});
    useCase = testApp.module.get(UpdateWorkbookUseCase);
    repo = testApp.module.get(WorkbookRepository);
  });

  afterEach(() => {
    testApp.afterEach();
  });

  afterAll(async () => {
    await testApp.teardown();
  });

  it("updates workbook name", async () => {
    const workbook = await testApp.createWorkbook({ name: "Old Name", createdBy: userId });
    const result = await useCase.execute(workbook.id, { name: "New Name" }, userId);
    assertSuccess(result);
    expect(result.value.name).toBe("New Name");
  });

  it("updates workbook cells", async () => {
    const workbook = await testApp.createWorkbook({ name: "WB", createdBy: userId });
    const cells = [{ id: "md1", type: "markdown" as const, content: "Updated" }];
    const result = await useCase.execute(workbook.id, { cells }, userId);
    assertSuccess(result);
    expect(result.value.cells).toEqual(cells);
  });

  it("returns 404 when workbook does not exist", async () => {
    const result = await useCase.execute(
      "00000000-0000-0000-0000-000000000000",
      { name: "Nope" },
      userId,
    );
    assertFailure(result);
    expect(result.error.statusCode).toBe(404);
  });

  it("returns 403 when non-owner tries to update", async () => {
    const otherUser = await testApp.createTestUser({});
    const workbook = await testApp.createWorkbook({ name: "WB", createdBy: userId });
    const result = await useCase.execute(workbook.id, { name: "Hacked" }, otherUser);
    assertFailure(result);
    expect(result.error.statusCode).toBe(403);
  });

  it("preserves fields not included in the update", async () => {
    const workbook = await testApp.createWorkbook({
      name: "WB",
      description: "Original description",
      createdBy: userId,
    });
    const result = await useCase.execute(workbook.id, { name: "Renamed" }, userId);
    assertSuccess(result);
    expect(result.value.name).toBe("Renamed");
    expect(result.value.description).toBe("Original description");
  });

  it("returns failure when repository findById fails", async () => {
    vi.spyOn(repo, "findById").mockResolvedValue(failure(AppError.internal("DB error")));
    const result = await useCase.execute(
      "00000000-0000-0000-0000-000000000000",
      { name: "X" },
      userId,
    );
    assertFailure(result);
    expect(result.error.statusCode).toBe(500);
    vi.restoreAllMocks();
  });

  it("returns failure when repository update fails", async () => {
    const workbook = await testApp.createWorkbook({ name: "WB", createdBy: userId });
    vi.spyOn(repo, "update").mockResolvedValue(failure(AppError.internal("DB error")));
    const result = await useCase.execute(workbook.id, { name: "X" }, userId);
    assertFailure(result);
    expect(result.error.statusCode).toBe(500);
    vi.restoreAllMocks();
  });

  it("returns failure when repository update returns empty array", async () => {
    const workbook = await testApp.createWorkbook({ name: "WB", createdBy: userId });
    vi.spyOn(repo, "update").mockResolvedValue(success([]));
    const result = await useCase.execute(workbook.id, { name: "X" }, userId);
    assertFailure(result);
    expect(result.error.statusCode).toBe(500);
    vi.restoreAllMocks();
  });
});
