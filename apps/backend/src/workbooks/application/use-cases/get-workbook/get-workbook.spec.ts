import { assertFailure, assertSuccess, failure, AppError } from "../../../../common/utils/fp-utils";
import { TestHarness } from "../../../../test/test-harness";
import { WorkbookRepository } from "../../../core/repositories/workbook.repository";
import { PublishVersionUseCase } from "../publish-version/publish-version";
import { GetWorkbookUseCase } from "./get-workbook";

describe("GetWorkbookUseCase", () => {
  const testApp = TestHarness.App;
  let useCase: GetWorkbookUseCase;
  let repo: WorkbookRepository;
  let publishVersion: PublishVersionUseCase;
  let userId: string;

  beforeAll(async () => {
    await testApp.setup();
  });

  beforeEach(async () => {
    await testApp.beforeEach();
    userId = await testApp.createTestUser({});
    useCase = testApp.module.get(GetWorkbookUseCase);
    repo = testApp.module.get(WorkbookRepository);
    publishVersion = testApp.module.get(PublishVersionUseCase);
  });

  afterEach(() => {
    testApp.afterEach();
  });

  afterAll(async () => {
    await testApp.teardown();
  });

  it("returns a workbook by id", async () => {
    const workbook = await testApp.createWorkbook({ name: "WB", createdBy: userId });
    const result = await useCase.execute(workbook.id);
    assertSuccess(result);
    expect(result.value.id).toBe(workbook.id);
    expect(result.value.name).toBe("WB");
  });

  it("includes createdByName from profile", async () => {
    const namedUser = await testApp.createTestUser({ name: "Jane Doe" });
    const workbook = await testApp.createWorkbook({ name: "WB", createdBy: namedUser });
    const result = await useCase.execute(workbook.id);
    assertSuccess(result);
    expect(result.value.createdByName).toBeDefined();
  });

  it("returns 404 when workbook does not exist", async () => {
    const result = await useCase.execute("00000000-0000-0000-0000-000000000000");
    assertFailure(result);
    expect(result.error.statusCode).toBe(404);
  });

  it("returns failure when repository findById fails", async () => {
    vi.spyOn(repo, "findById").mockResolvedValue(failure(AppError.internal("DB error")));
    const result = await useCase.execute("00000000-0000-0000-0000-000000000000");
    assertFailure(result);
    expect(result.error.statusCode).toBe(500);
    vi.restoreAllMocks();
  });

  describe("isUpgradable flag", () => {
    it("is false when no version has been published", async () => {
      const workbook = await testApp.createWorkbook({
        name: "WB",
        cells: [{ id: "md1", type: "markdown", content: "hi", isCollapsed: false }],
        createdBy: userId,
      });
      const result = await useCase.execute(workbook.id);
      assertSuccess(result);
      expect(result.value.isUpgradable).toBe(false);
    });

    it("is false when live cells match the latest version", async () => {
      const workbook = await testApp.createWorkbook({
        name: "WB",
        cells: [{ id: "md1", type: "markdown", content: "hi", isCollapsed: false }],
        createdBy: userId,
      });
      const published = await publishVersion.execute(workbook.id, userId);
      assertSuccess(published);

      const result = await useCase.execute(workbook.id);
      assertSuccess(result);
      expect(result.value.isUpgradable).toBe(false);
    });

    it("is true when cells have changed since the latest version", async () => {
      const workbook = await testApp.createWorkbook({
        name: "WB",
        cells: [{ id: "md1", type: "markdown", content: "hi", isCollapsed: false }],
        createdBy: userId,
      });
      const published = await publishVersion.execute(workbook.id, userId);
      assertSuccess(published);

      await repo.update(workbook.id, {
        cells: [{ id: "md1", type: "markdown", content: "edited", isCollapsed: false }],
      });

      const result = await useCase.execute(workbook.id);
      assertSuccess(result);
      expect(result.value.isUpgradable).toBe(true);
    });
  });
});
