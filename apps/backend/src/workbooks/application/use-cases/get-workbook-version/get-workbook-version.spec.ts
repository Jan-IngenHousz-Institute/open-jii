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

    const result = await useCase.execute(published.value.id);
    assertSuccess(result);
    expect(result.value.id).toBe(published.value.id);
    expect(result.value.workbookId).toBe(workbook.id);
    expect(result.value.version).toBe(1);
  });

  const publishDynamicVersion = async () => {
    vi.stubEnv("DYNAMIC_COMMAND_PUBLISH_ENABLED", "true");
    const workbook = await testApp.createWorkbook({
      name: "Dynamic WB",
      cells: [
        {
          id: "m1",
          type: "macro",
          isCollapsed: false,
          payload: { macroId: "22222222-2222-2222-2222-222222222222", language: "python" },
        },
        {
          id: "c1",
          type: "command",
          isCollapsed: false,
          payload: { kind: "ref", ref: { sourceCellId: "m1", field: "toDevice" } },
        },
      ],
      createdBy: userId,
    });
    const published = await publishVersion.execute(workbook.id, userId);
    assertSuccess(published);
    vi.unstubAllEnvs();
    return published.value.id;
  };

  it("returns a static version without the capability", async () => {
    const workbook = await testApp.createWorkbook({
      name: "Static WB",
      cells: [{ id: "md1", type: "markdown", content: "Hi", isCollapsed: false }],
      createdBy: userId,
    });
    const published = await publishVersion.execute(workbook.id, userId);
    assertSuccess(published);

    const result = await useCase.execute(published.value.id);
    assertSuccess(result);
  });

  it("refuses a dynamic version with 426 when the capability is missing", async () => {
    const versionId = await publishDynamicVersion();

    const result = await useCase.execute(versionId);

    assertFailure(result);
    expect(result.error.statusCode).toBe(426);
    expect(result.error.code).toBe("DYNAMIC_COMMAND_CLIENT_UPGRADE_REQUIRED");
  });

  it("returns a dynamic version when the client advertises the capability", async () => {
    const versionId = await publishDynamicVersion();

    const result = await useCase.execute(versionId, { clientSupportsDynamicRef: true });

    assertSuccess(result);
    expect(result.value.id).toBe(versionId);
  });

  it("returns 404 when version does not exist", async () => {
    const result = await useCase.execute("00000000-0000-0000-0000-000000000000");
    assertFailure(result);
    expect(result.error.statusCode).toBe(404);
  });

  it("returns failure when repository findById fails", async () => {
    vi.spyOn(versionRepo, "findById").mockResolvedValue(failure(AppError.internal("DB error")));

    const result = await useCase.execute("00000000-0000-0000-0000-000000000000");
    assertFailure(result);
    expect(result.error.statusCode).toBe(500);

    vi.restoreAllMocks();
  });
});
