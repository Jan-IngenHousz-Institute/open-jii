import { faker } from "@faker-js/faker";

import { assertSuccess } from "../../../common/utils/fp-utils";
import { TestHarness } from "../../../test/test-harness";
import { WorkbookVersionRepository } from "../../../workbooks/core/repositories/workbook-version.repository";
import { macroSnapshotKey, MacroSnapshotRepository } from "./macro-snapshot.repository";

describe("MacroSnapshotRepository", () => {
  const testApp = TestHarness.App;
  let repository: MacroSnapshotRepository;
  let workbookVersionRepository: WorkbookVersionRepository;
  let userId: string;

  beforeAll(async () => {
    await testApp.setup();
  });

  beforeEach(async () => {
    await testApp.beforeEach();
    userId = await testApp.createTestUser({});
    repository = testApp.module.get(MacroSnapshotRepository);
    workbookVersionRepository = testApp.module.get(WorkbookVersionRepository);
  });

  afterEach(() => testApp.afterEach());
  afterAll(async () => testApp.teardown());

  it("returns an empty map without querying versions", async () => {
    const result = await repository.findScriptsByVersionIds([]);
    assertSuccess(result);
    expect(result.value.size).toBe(0);
  });

  it("resolves code and language from the immutable workbook snapshot", async () => {
    const macroId = faker.string.uuid();
    const workbook = await testApp.createWorkbook({ name: "Snapshot workbook", createdBy: userId });
    const versionResult = await workbookVersionRepository.create({
      workbookId: workbook.id,
      version: 1,
      cells: [
        {
          id: "macro-cell",
          type: "macro",
          isCollapsed: false,
          payload: { macroId, language: "python", name: "Pinned analysis" },
        },
      ],
      metadata: {},
      entitySnapshots: {
        protocols: {},
        macros: { [macroId]: { code: "cGlubmVkLWNvZGU=" } },
      },
      createdBy: userId,
    });
    assertSuccess(versionResult);

    const result = await repository.findScriptsByVersionIds([versionResult.value.id]);

    assertSuccess(result);
    expect(result.value.get(macroSnapshotKey(versionResult.value.id, macroId))).toEqual({
      id: macroId,
      name: "Pinned analysis",
      language: "python",
      code: "cGlubmVkLWNvZGU=",
    });
  });

  it("resolves a macro referenced only inside a parallel lane", async () => {
    const macroId = faker.string.uuid();
    const workbook = await testApp.createWorkbook({ name: "Nested macro", createdBy: userId });
    const versionResult = await workbookVersionRepository.create({
      workbookId: workbook.id,
      version: 1,
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
                  id: "macro-cell",
                  type: "macro",
                  isCollapsed: false,
                  payload: { macroId, language: "python", name: "Pinned nested analysis" },
                },
              ],
            },
          ],
        },
      ],
      metadata: {},
      entitySnapshots: {
        protocols: {},
        macros: { [macroId]: { code: "cGlubmVkLW5lc3RlZC1jb2Rl" } },
      },
      createdBy: userId,
    });
    assertSuccess(versionResult);

    const result = await repository.findScriptsByVersionIds([versionResult.value.id]);

    assertSuccess(result);
    expect(result.value.get(macroSnapshotKey(versionResult.value.id, macroId))).toMatchObject({
      name: "Pinned nested analysis",
      code: "cGlubmVkLW5lc3RlZC1jb2Rl",
    });
  });

  it("does not invent a script when a referenced snapshot is missing", async () => {
    const macroId = faker.string.uuid();
    const workbook = await testApp.createWorkbook({ name: "Old workbook", createdBy: userId });
    const versionResult = await workbookVersionRepository.create({
      workbookId: workbook.id,
      version: 1,
      cells: [
        {
          id: "macro-cell",
          type: "macro",
          isCollapsed: false,
          payload: { macroId, language: "javascript" },
        },
      ],
      metadata: {},
      entitySnapshots: { protocols: {}, macros: {} },
      createdBy: userId,
    });
    assertSuccess(versionResult);

    const result = await repository.findScriptsByVersionIds([versionResult.value.id]);

    assertSuccess(result);
    expect(result.value.size).toBe(0);
  });
});
