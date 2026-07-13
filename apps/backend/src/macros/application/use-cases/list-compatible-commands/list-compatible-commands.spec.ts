import { faker } from "@faker-js/faker";

import { assertFailure, assertSuccess, failure, AppError } from "../../../../common/utils/fp-utils";
import { TestHarness } from "../../../../test/test-harness";
import { MacroCommandRepository } from "../../../core/repositories/macro-command.repository";
import { MacroRepository } from "../../../core/repositories/macro.repository";
import { ListCompatibleCommandsUseCase } from "./list-compatible-commands";

describe("ListCompatibleCommandsUseCase", () => {
  const testApp = TestHarness.App;
  let testUserId: string;
  let useCase: ListCompatibleCommandsUseCase;
  let macroCommandRepository: MacroCommandRepository;

  beforeAll(async () => {
    await testApp.setup();
  });

  beforeEach(async () => {
    await testApp.beforeEach();
    testUserId = await testApp.createTestUser({});
    useCase = testApp.module.get(ListCompatibleCommandsUseCase);
    macroCommandRepository = testApp.module.get(MacroCommandRepository);
  });

  afterEach(() => {
    testApp.afterEach();
  });

  afterAll(async () => {
    await testApp.teardown();
  });

  it("should return empty list when no commands are linked", async () => {
    const macro = await testApp.createMacro({
      name: "Empty Macro",
      createdBy: testUserId,
    });

    const result = await useCase.execute(macro.id);
    expect(result.isSuccess()).toBe(true);
    assertSuccess(result);
    expect(result.value).toEqual([]);
  });

  it("should return list of compatible commands when commands are linked", async () => {
    const macro = await testApp.createMacro({
      name: "Macro With Commands",
      createdBy: testUserId,
    });

    const command1 = await testApp.createCommand({
      name: `list-command-1-${faker.string.alphanumeric(6)}`,
      createdBy: testUserId,
    });

    const command2 = await testApp.createCommand({
      name: `list-command-2-${faker.string.alphanumeric(6)}`,
      createdBy: testUserId,
    });

    // Link commands to macro
    await macroCommandRepository.addCommands(macro.id, [command1.id, command2.id]);

    const result = await useCase.execute(macro.id);
    expect(result.isSuccess()).toBe(true);
    assertSuccess(result);
    expect(result.value).toHaveLength(2);

    const commandIds = result.value.map((e) => e.command.id);
    expect(commandIds).toContain(command1.id);
    expect(commandIds).toContain(command2.id);
  });

  it("should return NOT_FOUND when macro does not exist", async () => {
    const nonExistentId = faker.string.uuid();
    const result = await useCase.execute(nonExistentId);
    expect(result.isSuccess()).toBe(false);
    assertFailure(result);
    expect(result.error.code).toBe("NOT_FOUND");
  });

  it("should return INTERNAL_ERROR when macroRepository.findById fails", async () => {
    const macroRepo = testApp.module.get(MacroRepository);
    vi.spyOn(macroRepo, "findById").mockResolvedValueOnce(failure(AppError.internal("db error")));

    const result = await useCase.execute(faker.string.uuid());
    expect(result.isSuccess()).toBe(false);
    assertFailure(result);
    expect(result.error.code).toBe("INTERNAL_ERROR");
  });

  it("should return INTERNAL_ERROR when macroCommandRepository.listCommands fails", async () => {
    const macro = await testApp.createMacro({
      name: "List Failure Macro",
      createdBy: testUserId,
    });

    vi.spyOn(macroCommandRepository, "listCommands").mockResolvedValueOnce(
      failure(AppError.internal("db error")),
    );

    const result = await useCase.execute(macro.id);
    expect(result.isSuccess()).toBe(false);
    assertFailure(result);
    expect(result.error.code).toBe("INTERNAL_ERROR");
  });
});
