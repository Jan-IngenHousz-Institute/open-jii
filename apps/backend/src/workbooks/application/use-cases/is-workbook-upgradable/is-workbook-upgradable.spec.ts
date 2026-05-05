import { assertSuccess, failure, AppError } from "../../../../common/utils/fp-utils";
import { TestHarness } from "../../../../test/test-harness";
import type { WorkbookDto } from "../../../core/models/workbook.model";
import { WorkbookVersionRepository } from "../../../core/repositories/workbook-version.repository";
import { WorkbookRepository } from "../../../core/repositories/workbook.repository";
import { PublishVersionUseCase } from "../publish-version/publish-version";
import { IsWorkbookUpgradableUseCase } from "./is-workbook-upgradable";

function expectValue<T>(v: T | null | undefined): T {
  if (v == null) throw new Error("expected non-null value");
  return v;
}

describe("IsWorkbookUpgradableUseCase", () => {
  const testApp = TestHarness.App;
  let useCase: IsWorkbookUpgradableUseCase;
  let workbookRepo: WorkbookRepository;
  let versionRepo: WorkbookVersionRepository;
  let publishVersion: PublishVersionUseCase;
  let userId: string;

  beforeAll(async () => {
    await testApp.setup();
  });

  beforeEach(async () => {
    await testApp.beforeEach();
    userId = await testApp.createTestUser({});
    useCase = testApp.module.get(IsWorkbookUpgradableUseCase);
    workbookRepo = testApp.module.get(WorkbookRepository);
    versionRepo = testApp.module.get(WorkbookVersionRepository);
    publishVersion = testApp.module.get(PublishVersionUseCase);
  });

  afterEach(() => {
    testApp.afterEach();
  });

  afterAll(async () => {
    await testApp.teardown();
  });

  /** Publish v1 of `workbook` so subsequent calls have something to
   *  compare the live cells against. */
  async function publishV1(workbook: WorkbookDto) {
    const result = await publishVersion.execute(workbook.id, userId);
    assertSuccess(result);
    return result.value;
  }

  it("is false when no version has ever been published", async () => {
    const workbook = await testApp.createWorkbook({
      name: "WB",
      cells: [{ id: "md1", type: "markdown", content: "hi", isCollapsed: false }],
      createdBy: userId,
    });
    const fresh = await workbookRepo.findById(workbook.id);
    assertSuccess(fresh);

    const result = await useCase.execute(expectValue(fresh.value));
    assertSuccess(result);
    expect(result.value).toBe(false);
  });

  it("is false when live cells match the latest version", async () => {
    const workbook = await testApp.createWorkbook({
      name: "WB",
      cells: [{ id: "md1", type: "markdown", content: "hi", isCollapsed: false }],
      createdBy: userId,
    });
    await publishV1(workbook);
    const fresh = await workbookRepo.findById(workbook.id);
    assertSuccess(fresh);

    const result = await useCase.execute(expectValue(fresh.value));
    assertSuccess(result);
    expect(result.value).toBe(false);
  });

  it("is true when a cell has been added since the latest version", async () => {
    const workbook = await testApp.createWorkbook({
      name: "WB",
      cells: [{ id: "md1", type: "markdown", content: "hi", isCollapsed: false }],
      createdBy: userId,
    });
    await publishV1(workbook);

    await workbookRepo.update(workbook.id, {
      cells: [
        { id: "md1", type: "markdown", content: "hi", isCollapsed: false },
        { id: "md2", type: "markdown", content: "added", isCollapsed: false },
      ],
    });
    const fresh = await workbookRepo.findById(workbook.id);
    assertSuccess(fresh);

    const result = await useCase.execute(expectValue(fresh.value));
    assertSuccess(result);
    expect(result.value).toBe(true);
  });

  it("is true when a cell's design payload has changed", async () => {
    const workbook = await testApp.createWorkbook({
      name: "WB",
      cells: [{ id: "md1", type: "markdown", content: "hi", isCollapsed: false }],
      createdBy: userId,
    });
    await publishV1(workbook);

    await workbookRepo.update(workbook.id, {
      cells: [{ id: "md1", type: "markdown", content: "edited", isCollapsed: false }],
    });
    const fresh = await workbookRepo.findById(workbook.id);
    assertSuccess(fresh);

    const result = await useCase.execute(expectValue(fresh.value));
    assertSuccess(result);
    expect(result.value).toBe(true);
  });

  it("is false when only UI fold state (isCollapsed) changes", async () => {
    const workbook = await testApp.createWorkbook({
      name: "WB",
      cells: [{ id: "md1", type: "markdown", content: "hi", isCollapsed: false }],
      createdBy: userId,
    });
    await publishV1(workbook);

    await workbookRepo.update(workbook.id, {
      cells: [{ id: "md1", type: "markdown", content: "hi", isCollapsed: true }],
    });
    const fresh = await workbookRepo.findById(workbook.id);
    assertSuccess(fresh);

    const result = await useCase.execute(expectValue(fresh.value));
    assertSuccess(result);
    expect(result.value).toBe(false);
  });

  it("is false when only per-run question state (isAnswered/answer) changes", async () => {
    const original = {
      id: "q1",
      type: "question" as const,
      isCollapsed: false,
      isAnswered: false,
      name: "soil_moisture",
      question: { kind: "open_ended" as const, text: "How wet?", required: false },
    };
    const workbook = await testApp.createWorkbook({
      name: "WB",
      cells: [original],
      createdBy: userId,
    });
    await publishV1(workbook);

    await workbookRepo.update(workbook.id, {
      cells: [{ ...original, isAnswered: true, answer: "very" }],
    });
    const fresh = await workbookRepo.findById(workbook.id);
    assertSuccess(fresh);

    const result = await useCase.execute(expectValue(fresh.value));
    assertSuccess(result);
    expect(result.value).toBe(false);
  });

  it("propagates failure when the version repository fails", async () => {
    const workbook = await testApp.createWorkbook({ name: "WB", createdBy: userId });
    const fresh = await workbookRepo.findById(workbook.id);
    assertSuccess(fresh);
    vi.spyOn(versionRepo, "getLatestVersion").mockResolvedValue(
      failure(AppError.internal("DB error")),
    );

    const result = await useCase.execute(expectValue(fresh.value));
    expect(result.isFailure()).toBe(true);
    vi.restoreAllMocks();
  });
});
