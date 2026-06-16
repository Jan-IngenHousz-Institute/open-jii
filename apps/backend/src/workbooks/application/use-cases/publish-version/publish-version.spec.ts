import { assertFailure, assertSuccess, failure, AppError } from "../../../../common/utils/fp-utils";
import { MacroRepository } from "../../../../macros/core/repositories/macro.repository";
import { ProtocolRepository } from "../../../../protocols/core/repositories/protocol.repository";
import { TestHarness } from "../../../../test/test-harness";
import { WorkbookVersionRepository } from "../../../core/repositories/workbook-version.repository";
import { WorkbookRepository } from "../../../core/repositories/workbook.repository";
import { PublishVersionUseCase } from "./publish-version";

describe("PublishVersionUseCase", () => {
  const testApp = TestHarness.App;
  let useCase: PublishVersionUseCase;
  let workbookRepo: WorkbookRepository;
  let versionRepo: WorkbookVersionRepository;
  let protocolRepo: ProtocolRepository;
  let macroRepo: MacroRepository;
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
    protocolRepo = testApp.module.get(ProtocolRepository);
    macroRepo = testApp.module.get(MacroRepository);
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

  it("always mints a new version (no dedup) on successive calls", async () => {
    const workbook = await testApp.createWorkbook({
      name: "WB2",
      cells: [{ id: "md1", type: "markdown", content: "Hello", isCollapsed: false }],
      createdBy: userId,
    });

    const v1 = await useCase.execute(workbook.id, userId);
    assertSuccess(v1);
    expect(v1.value.version).toBe(1);

    const v2 = await useCase.execute(workbook.id, userId);
    assertSuccess(v2);
    expect(v2.value.version).toBe(2);
    expect(v2.value.id).not.toBe(v1.value.id);
  });

  it("increments to next version when cells have changed", async () => {
    const workbook = await testApp.createWorkbook({
      name: "WB3",
      cells: [{ id: "md1", type: "markdown", content: "v1", isCollapsed: false }],
      createdBy: userId,
    });

    const v1 = await useCase.execute(workbook.id, userId);
    assertSuccess(v1);

    await workbookRepo.update(workbook.id, {
      cells: [{ id: "md1", type: "markdown", content: "v2", isCollapsed: false }],
    });

    const v2 = await useCase.execute(workbook.id, userId);
    assertSuccess(v2);
    expect(v2.value.version).toBe(2);
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

  it("snapshots each pinned macro/protocol version keyed by id + version", async () => {
    const proto = await protocolRepo.create(
      { name: "Snap Proto", code: [{ step: 1 }], family: "multispeq" },
      userId,
    );
    assertSuccess(proto);
    const protocol = proto.value[0];
    const macroResult = await macroRepo.create(
      { name: "Snap Macro", language: "python", code: "cHJpbnQoMSk=" },
      userId,
    );
    assertSuccess(macroResult);
    const macro = macroResult.value[0];

    const cells = [
      {
        id: "p1",
        type: "protocol",
        isCollapsed: false,
        payload: { protocolId: protocol.id, version: 1 },
      },
      {
        id: "m1",
        type: "macro",
        isCollapsed: false,
        payload: { macroId: macro.id, version: 1, language: "python" },
      },
    ];
    const workbook = await testApp.createWorkbook({ name: "WBSnap", cells, createdBy: userId });

    const result = await useCase.execute(workbook.id, userId);
    assertSuccess(result);
    expect(result.value.cells).toEqual(cells);
    expect(result.value.entitySnapshots.protocols[protocol.id][1]).toEqual({ code: protocol.code });
    expect(result.value.entitySnapshots.macros[macro.id][1]).toEqual({ code: macro.code });
  });

  it("snapshots BOTH versions when two cells pin different versions of the same entity", async () => {
    const macroResult = await macroRepo.create(
      { name: "Multi Macro", language: "python", code: "djE=" },
      userId,
    );
    assertSuccess(macroResult);
    const macroId = macroResult.value[0].id;
    const v2 = await macroRepo.mintVersion(macroId, {
      code: "djI=",
      language: "python",
      createdBy: userId,
    });
    assertSuccess(v2);

    const cells = [
      {
        id: "m1",
        type: "macro",
        isCollapsed: false,
        payload: { macroId, version: 1, language: "python" },
      },
      {
        id: "m2",
        type: "macro",
        isCollapsed: false,
        payload: { macroId, version: 2, language: "python" },
      },
    ];
    const workbook = await testApp.createWorkbook({ name: "WBMulti", cells, createdBy: userId });

    const result = await useCase.execute(workbook.id, userId);
    assertSuccess(result);
    // Old id-keyed model kept only the highest; both pins must survive now.
    expect(Object.keys(result.value.entitySnapshots.macros[macroId]).sort()).toEqual(["1", "2"]);
  });

  it("fails when a cell pins a version that does not exist", async () => {
    const macroResult = await macroRepo.create(
      { name: "Missing Ver Macro", language: "python", code: "djE=" },
      userId,
    );
    assertSuccess(macroResult);
    const macroId = macroResult.value[0].id;

    const workbook = await testApp.createWorkbook({
      name: "WBMissing",
      cells: [
        {
          id: "m1",
          type: "macro",
          isCollapsed: false,
          payload: { macroId, version: 99, language: "python" },
        },
      ],
      createdBy: userId,
    });

    const result = await useCase.execute(workbook.id, userId);
    assertFailure(result);
    expect(result.error.statusCode).toBe(404);
  });
});
