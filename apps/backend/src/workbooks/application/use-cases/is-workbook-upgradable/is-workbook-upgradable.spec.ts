import { assertSuccess, failure, success, AppError } from "../../../../common/utils/fp-utils";
import type { ProtocolDto } from "../../../../protocols/core/models/protocol.model";
import type { ProtocolRepository } from "../../../../protocols/core/repositories/protocol.repository";
import { TestHarness } from "../../../../test/test-harness";
import type { WorkbookVersionDto } from "../../../core/models/workbook-version.model";
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

  // Regression for OJD-1626: live entities keep keys in insertion order while
  // published snapshots come back from jsonb with keys re-normalised. A plain
  // JSON.stringify diff flags such workbooks "upgradable" forever; the
  // canonical comparison must treat key-order-only differences as unchanged.
  function makeVersion(overrides: Partial<WorkbookVersionDto>): WorkbookVersionDto {
    return {
      id: "ver-1",
      workbookId: "wb-1",
      version: 1,
      cells: [],
      metadata: {},
      entitySnapshots: { protocols: {}, macros: {} },
      createdAt: new Date(),
      createdBy: userId,
      ...overrides,
    } as unknown as WorkbookVersionDto;
  }

  it("is false when cells differ only in object key order", async () => {
    const liveCell = { id: "md1", isCollapsed: false, type: "markdown" as const, content: "hi" };
    const snapCell = { type: "markdown" as const, content: "hi", isCollapsed: false, id: "md1" };
    const workbook = { id: "wb-1", cells: [liveCell] } as unknown as WorkbookDto;

    vi.spyOn(versionRepo, "getLatestVersion").mockResolvedValue(
      success(makeVersion({ cells: [snapCell] })),
    );

    const result = await useCase.execute(workbook);
    assertSuccess(result);
    expect(result.value).toBe(false);
    vi.restoreAllMocks();
  });

  it("is false when a referenced protocol's code differs only in object key order", async () => {
    const protocolId = "11111111-1111-1111-1111-111111111111";
    const protocolCell = {
      id: "p1",
      isCollapsed: false,
      type: "protocol" as const,
      payload: { protocolId, version: 1 },
    };
    const workbook = { id: "wb-1", cells: [protocolCell] } as unknown as WorkbookDto;

    vi.spyOn(versionRepo, "getLatestVersion").mockResolvedValue(
      success(
        makeVersion({
          cells: [protocolCell],
          entitySnapshots: {
            protocols: { [protocolId]: { code: { a: 1, b: 2 }, family: "multispeq" } },
            macros: {},
          },
        }),
      ),
    );
    // ProtocolRepository is duplicated across modules, so spy on the exact
    // instance the use-case holds rather than whatever module.get() resolves.
    const protocolRepo = (useCase as unknown as { protocolRepository: ProtocolRepository })
      .protocolRepository;
    vi.spyOn(protocolRepo, "findByIds").mockResolvedValue(
      success(new Map([[protocolId, { code: { b: 2, a: 1 } } as unknown as ProtocolDto]])),
    );

    const result = await useCase.execute(workbook);
    assertSuccess(result);
    expect(result.value).toBe(false);
    vi.restoreAllMocks();
  });

  it("is true when a referenced protocol's code has genuinely changed", async () => {
    const protocolId = "22222222-2222-2222-2222-222222222222";
    const protocolCell = {
      id: "p1",
      isCollapsed: false,
      type: "protocol" as const,
      payload: { protocolId, version: 1 },
    };
    const workbook = { id: "wb-1", cells: [protocolCell] } as unknown as WorkbookDto;

    vi.spyOn(versionRepo, "getLatestVersion").mockResolvedValue(
      success(
        makeVersion({
          cells: [protocolCell],
          entitySnapshots: {
            protocols: { [protocolId]: { code: { a: 1, b: 2 }, family: "multispeq" } },
            macros: {},
          },
        }),
      ),
    );
    // ProtocolRepository is duplicated across modules, so spy on the exact
    // instance the use-case holds rather than whatever module.get() resolves.
    const protocolRepo = (useCase as unknown as { protocolRepository: ProtocolRepository })
      .protocolRepository;
    vi.spyOn(protocolRepo, "findByIds").mockResolvedValue(
      success(new Map([[protocolId, { code: { a: 1, b: 3 } } as unknown as ProtocolDto]])),
    );

    const result = await useCase.execute(workbook);
    assertSuccess(result);
    expect(result.value).toBe(true);
    vi.restoreAllMocks();
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
