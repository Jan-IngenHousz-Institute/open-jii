import { assertSuccess } from "../../../../common/utils/fp-utils";
import { TestHarness } from "../../../../test/test-harness";
import { MacroRepository } from "../../../core/repositories/macro.repository";
import { GetMacroUsageUseCase } from "./get-macro-usage";

describe("GetMacroUsageUseCase", () => {
  const testApp = TestHarness.App;
  let userId: string;
  let useCase: GetMacroUsageUseCase;
  let macroRepository: MacroRepository;

  beforeAll(async () => {
    await testApp.setup();
  });

  beforeEach(async () => {
    await testApp.beforeEach();
    userId = await testApp.createTestUser({});
    useCase = testApp.module.get(GetMacroUsageUseCase);
    macroRepository = testApp.module.get(MacroRepository);
  });

  afterEach(() => {
    testApp.afterEach();
  });

  afterAll(async () => {
    await testApp.teardown();
  });

  async function createMacroId() {
    const created = await macroRepository.create(
      { name: "M", language: "python", code: "djE=" },
      userId,
    );
    assertSuccess(created);
    return created.value[0].id;
  }

  it("counts workbooks that reference the macro", async () => {
    const macroId = await createMacroId();
    const cell = {
      id: "m1",
      type: "macro",
      isCollapsed: false,
      payload: { macroId, version: 1, language: "python" },
    };
    await testApp.createWorkbook({ name: "WB A", cells: [cell], createdBy: userId });
    await testApp.createWorkbook({ name: "WB B", cells: [cell], createdBy: userId });

    const result = await useCase.execute(macroId);
    assertSuccess(result);
    expect(result.value.count).toBe(2);
    expect(result.value.workbooks.map((w) => w.name).sort()).toEqual(["WB A", "WB B"]);
  });

  it("reports zero usage for an unreferenced macro", async () => {
    const macroId = await createMacroId();

    const result = await useCase.execute(macroId);
    assertSuccess(result);
    expect(result.value.count).toBe(0);
    expect(result.value.workbooks).toEqual([]);
  });
});
