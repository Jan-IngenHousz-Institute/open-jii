import { faker } from "@faker-js/faker";

import { assertSuccess } from "../../../../common/utils/fp-utils";
import { TestHarness } from "../../../../test/test-harness";
import { MacroRepository } from "../../../core/repositories/macro.repository";
import { ListMacroVersionsUseCase } from "./list-macro-versions";

describe("ListMacroVersionsUseCase", () => {
  const testApp = TestHarness.App;
  let userId: string;
  let useCase: ListMacroVersionsUseCase;
  let macroRepository: MacroRepository;

  beforeAll(async () => {
    await testApp.setup();
  });

  beforeEach(async () => {
    await testApp.beforeEach();
    userId = await testApp.createTestUser({});
    useCase = testApp.module.get(ListMacroVersionsUseCase);
    macroRepository = testApp.module.get(MacroRepository);
  });

  afterEach(() => {
    testApp.afterEach();
  });

  afterAll(async () => {
    await testApp.teardown();
  });

  it("returns versions newest-first", async () => {
    const created = await macroRepository.create(
      { name: "M", language: "python", code: "djE=" },
      userId,
    );
    assertSuccess(created);
    const macroId = created.value[0].id;
    const minted = await macroRepository.mintVersion(macroId, {
      code: "djI=",
      language: "python",
      createdBy: userId,
    });
    assertSuccess(minted);

    const result = await useCase.execute(macroId);
    assertSuccess(result);
    expect(result.value.map((v) => v.version)).toEqual([2, 1]);
  });

  it("returns an empty list for a macro with no versions", async () => {
    const result = await useCase.execute(faker.string.uuid());
    assertSuccess(result);
    expect(result.value).toEqual([]);
  });
});
