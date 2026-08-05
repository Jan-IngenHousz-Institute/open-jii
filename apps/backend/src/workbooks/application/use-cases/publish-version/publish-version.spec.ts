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

  it("fails closed when a referenced protocol is private and inaccessible to the publisher", async () => {
    // Referencing a private protocol's UUID must not let the publisher snapshot
    // (and later read) its code without access.
    const otherUser = await testApp.createTestUser({});
    const otherOrgId = await testApp.createOrganization();
    await testApp.addOrganizationMember(otherOrgId, otherUser, "owner");
    const privateProtocol = await testApp.createProtocol({
      name: `secret-protocol-${Math.random().toString(36).slice(2)}`,
      createdBy: otherUser,
      visibility: "private",
      organizationId: otherOrgId,
    });

    const workbook = await testApp.createWorkbook({
      name: "Exfil attempt",
      cells: [
        {
          id: "p1",
          type: "protocol",
          isCollapsed: false,
          payload: { protocolId: privateProtocol.id, version: 1 },
        },
      ],
      createdBy: userId,
    });

    const result = await useCase.execute(workbook.id, userId);
    assertFailure(result);
    expect(result.error.statusCode).toBe(403);
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

  it("snapshots protocols and macros referenced only inside a parallel lane", async () => {
    const protocol = await testApp.createProtocol({
      name: "Nested protocol",
      code: [{ pulses: [10, 20] }],
      createdBy: userId,
    });
    const macro = await testApp.createMacro({
      name: "Nested macro",
      code: "bmVzdGVkLW1hY3Jv",
      createdBy: userId,
    });
    const workbook = await testApp.createWorkbook({
      name: "Nested entities",
      createdBy: userId,
      cells: [
        {
          id: "parallel-1",
          type: "parallel",
          name: "device_lanes",
          defaultLaneId: "lane-1",
          isCollapsed: false,
          lanes: [
            {
              id: "lane-1",
              label: "Lane 1",
              color: "#005E5E",
              conditions: [],
              body: [
                {
                  id: "protocol-1",
                  type: "protocol",
                  isCollapsed: false,
                  payload: { protocolId: protocol.id, version: 1 },
                },
                {
                  id: "macro-1",
                  type: "macro",
                  isCollapsed: false,
                  payload: { macroId: macro.id, language: "python" },
                },
              ],
            },
          ],
        },
      ],
    });

    const result = await useCase.execute(workbook.id, userId);

    assertSuccess(result);
    expect(result.value.entitySnapshots.protocols[protocol.id].code).toEqual(protocol.code);
    expect(result.value.entitySnapshots.macros[macro.id].code).toBe(macro.code);
  });
});
