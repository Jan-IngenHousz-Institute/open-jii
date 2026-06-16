import { assertSuccess, failure, AppError } from "../../../../common/utils/fp-utils";
import { MacroRepository } from "../../../../macros/core/repositories/macro.repository";
import { ProtocolRepository } from "../../../../protocols/core/repositories/protocol.repository";
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
  let macroRepo: MacroRepository;
  let protocolRepo: ProtocolRepository;
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
    macroRepo = testApp.module.get(MacroRepository);
    protocolRepo = testApp.module.get(ProtocolRepository);
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

  it("is false when only output cells have been appended since the latest version", async () => {
    const source = { id: "md1", type: "markdown" as const, content: "hi", isCollapsed: false };
    const workbook = await testApp.createWorkbook({
      name: "WB",
      cells: [source],
      createdBy: userId,
    });
    await publishV1(workbook);

    await workbookRepo.update(workbook.id, {
      cells: [
        source,
        {
          id: "out1",
          type: "output",
          isCollapsed: false,
          producedBy: source.id,
          data: { value: 42 },
        },
      ],
    });
    const fresh = await workbookRepo.findById(workbook.id);
    assertSuccess(fresh);

    const result = await useCase.execute(expectValue(fresh.value));
    assertSuccess(result);
    expect(result.value).toBe(false);
  });

  it("is true when a referenced macro's head code drifts from the pinned snapshot", async () => {
    const macro = await macroRepo.create({ name: "M", language: "python", code: "djE=" }, userId);
    assertSuccess(macro);
    const macroId = macro.value[0].id;
    const workbook = await testApp.createWorkbook({
      name: "WB",
      cells: [
        {
          id: "m1",
          type: "macro",
          isCollapsed: false,
          payload: { macroId, version: 1, language: "python" },
        },
      ],
      createdBy: userId,
    });
    await publishV1(workbook);
    // Editing the macro mints v2; the cell still pins v1, so head now drifts from the snapshot.
    const v2 = await macroRepo.mintVersion(macroId, {
      code: "djI=",
      language: "python",
      createdBy: userId,
    });
    assertSuccess(v2);

    const fresh = await workbookRepo.findById(workbook.id);
    assertSuccess(fresh);
    const result = await useCase.execute(expectValue(fresh.value));
    assertSuccess(result);
    expect(result.value).toBe(true);
  });

  it("is false when a referenced macro head still matches the pinned snapshot", async () => {
    const macro = await macroRepo.create({ name: "M2", language: "python", code: "djE=" }, userId);
    assertSuccess(macro);
    const macroId = macro.value[0].id;
    const workbook = await testApp.createWorkbook({
      name: "WB",
      cells: [
        {
          id: "m1",
          type: "macro",
          isCollapsed: false,
          payload: { macroId, version: 1, language: "python" },
        },
      ],
      createdBy: userId,
    });
    await publishV1(workbook);

    const fresh = await workbookRepo.findById(workbook.id);
    assertSuccess(fresh);
    const result = await useCase.execute(expectValue(fresh.value));
    assertSuccess(result);
    expect(result.value).toBe(false);
  });

  it("is true when a referenced protocol's head code drifts from the pinned snapshot", async () => {
    const proto = await protocolRepo.create(
      { name: "P", code: [{ step: 1 }], family: "multispeq" },
      userId,
    );
    assertSuccess(proto);
    const protocolId = proto.value[0].id;
    const workbook = await testApp.createWorkbook({
      name: "WB",
      cells: [
        { id: "p1", type: "protocol", isCollapsed: false, payload: { protocolId, version: 1 } },
      ],
      createdBy: userId,
    });
    await publishV1(workbook);
    const v2 = await protocolRepo.mintVersion(protocolId, {
      code: [{ step: 2 }],
      family: "multispeq",
      createdBy: userId,
    });
    assertSuccess(v2);

    const fresh = await workbookRepo.findById(workbook.id);
    assertSuccess(fresh);
    const result = await useCase.execute(expectValue(fresh.value));
    assertSuccess(result);
    expect(result.value).toBe(true);
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
