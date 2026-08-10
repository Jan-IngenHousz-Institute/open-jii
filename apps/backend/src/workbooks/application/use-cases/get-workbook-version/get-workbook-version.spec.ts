import { assertFailure, assertSuccess, failure, AppError } from "../../../../common/utils/fp-utils";
import { TestHarness } from "../../../../test/test-harness";
import { WorkbookVersionRepository } from "../../../core/repositories/workbook-version.repository";
import { PublishVersionUseCase } from "../publish-version/publish-version";
import { GetWorkbookVersionUseCase } from "./get-workbook-version";

describe("GetWorkbookVersionUseCase", () => {
  const testApp = TestHarness.App;
  let useCase: GetWorkbookVersionUseCase;
  let publishVersion: PublishVersionUseCase;
  let versionRepo: WorkbookVersionRepository;
  let userId: string;

  beforeAll(async () => {
    await testApp.setup();
  });

  beforeEach(async () => {
    await testApp.beforeEach();
    userId = await testApp.createTestUser({});
    useCase = testApp.module.get(GetWorkbookVersionUseCase);
    publishVersion = testApp.module.get(PublishVersionUseCase);
    versionRepo = testApp.module.get(WorkbookVersionRepository);
  });

  afterEach(() => {
    testApp.afterEach();
  });

  afterAll(async () => {
    await testApp.teardown();
  });

  it("returns a workbook version by id", async () => {
    const workbook = await testApp.createWorkbook({
      name: "Test WB",
      cells: [{ id: "md1", type: "markdown", content: "Hello", isCollapsed: false }],
      createdBy: userId,
    });

    const published = await publishVersion.execute(workbook.id, userId);
    assertSuccess(published);

    const result = await useCase.execute(published.value.id, workbook.id);
    assertSuccess(result);
    expect(result.value.id).toBe(published.value.id);
    expect(result.value.workbookId).toBe(workbook.id);
    expect(result.value.version).toBe(1);
  });

  it("returns 404 when version does not exist", async () => {
    const workbook = await testApp.createWorkbook({ name: "Empty WB", createdBy: userId });

    const result = await useCase.execute("00000000-0000-0000-0000-000000000000", workbook.id);
    assertFailure(result);
    expect(result.error.statusCode).toBe(404);
  });

  it("returns 404 for a version that belongs to a different workbook", async () => {
    // The caller is authorized against one workbook but names a version of another.
    // Scoping the lookup is what keeps the second workbook's cells out of reach.
    const otherWorkbook = await testApp.createWorkbook({
      name: "Other WB",
      cells: [{ id: "md1", type: "markdown", content: "secret", isCollapsed: false }],
      createdBy: userId,
    });
    const published = await publishVersion.execute(otherWorkbook.id, userId);
    assertSuccess(published);

    const authorizedWorkbook = await testApp.createWorkbook({
      name: "Authorized WB",
      createdBy: userId,
    });

    const result = await useCase.execute(published.value.id, authorizedWorkbook.id);
    assertFailure(result);
    expect(result.error.statusCode).toBe(404);

    // Same version id, asked for under its own workbook, still resolves — the
    // constraint narrows the lookup rather than breaking it.
    const scoped = await useCase.execute(published.value.id, otherWorkbook.id);
    assertSuccess(scoped);
    expect(scoped.value.id).toBe(published.value.id);
  });

  it("returns failure when repository findById fails", async () => {
    vi.spyOn(versionRepo, "findById").mockResolvedValue(failure(AppError.internal("DB error")));

    const result = await useCase.execute(
      "00000000-0000-0000-0000-000000000000",
      "00000000-0000-0000-0000-000000000001",
    );
    assertFailure(result);
    expect(result.error.statusCode).toBe(500);

    vi.restoreAllMocks();
  });
});
