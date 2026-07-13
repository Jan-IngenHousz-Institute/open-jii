import { faker } from "@faker-js/faker";

import { macros } from "@repo/database";

import { assertFailure, assertSuccess, failure, AppError } from "../../../../common/utils/fp-utils";
import { TestHarness } from "../../../../test/test-harness";
import { CommandMacroRepository } from "../../../core/repositories/command-macro.repository";
import { CommandRepository } from "../../../core/repositories/command.repository";
import { ListCompatibleMacrosUseCase } from "./list-compatible-macros";

describe("ListCompatibleMacrosUseCase", () => {
  const testApp = TestHarness.App;
  let testUserId: string;
  let useCase: ListCompatibleMacrosUseCase;
  let commandMacroRepository: CommandMacroRepository;

  beforeAll(async () => {
    await testApp.setup();
  });

  beforeEach(async () => {
    await testApp.beforeEach();
    testUserId = await testApp.createTestUser({});
    useCase = testApp.module.get(ListCompatibleMacrosUseCase);
    commandMacroRepository = testApp.module.get(CommandMacroRepository);
  });

  afterEach(() => {
    testApp.afterEach();
  });

  afterAll(async () => {
    await testApp.teardown();
  });

  it("should return empty list when no macros are linked", async () => {
    const command = await testApp.createCommand({
      name: "Empty Command",
      createdBy: testUserId,
    });

    const result = await useCase.execute(command.id);
    expect(result.isSuccess()).toBe(true);
    assertSuccess(result);
    expect(result.value).toEqual([]);
  });

  it("should return list of compatible macros when macros are linked", async () => {
    const command = await testApp.createCommand({
      name: "Command With Macros",
      createdBy: testUserId,
    });

    // Create macros
    const [macro1] = await testApp.database
      .insert(macros)
      .values({
        name: `list-macro-1-${faker.string.alphanumeric(6)}`,
        filename: `macro_${faker.string.alphanumeric(8)}`,
        description: "test macro 1",
        language: "python",
        code: btoa("print('hello')"),
        createdBy: testUserId,
      })
      .returning();

    const [macro2] = await testApp.database
      .insert(macros)
      .values({
        name: `list-macro-2-${faker.string.alphanumeric(6)}`,
        filename: `macro_${faker.string.alphanumeric(8)}`,
        description: "test macro 2",
        language: "python",
        code: btoa("print('world')"),
        createdBy: testUserId,
      })
      .returning();

    // Link macros to command
    await commandMacroRepository.addMacros(command.id, [macro1.id, macro2.id]);

    const result = await useCase.execute(command.id);
    expect(result.isSuccess()).toBe(true);
    assertSuccess(result);
    expect(result.value).toHaveLength(2);

    const macroIds = result.value.map((e) => e.macro.id);
    expect(macroIds).toContain(macro1.id);
    expect(macroIds).toContain(macro2.id);
  });

  it("should return NOT_FOUND when command does not exist", async () => {
    const nonExistentId = faker.string.uuid();
    const result = await useCase.execute(nonExistentId);
    expect(result.isSuccess()).toBe(false);
    assertFailure(result);
    expect(result.error.code).toBe("NOT_FOUND");
  });

  it("should return INTERNAL_ERROR when commandRepository.findOne fails", async () => {
    const commandRepo = testApp.module.get(CommandRepository);
    vi.spyOn(commandRepo, "findOne").mockResolvedValueOnce(failure(AppError.internal("db error")));

    const result = await useCase.execute(faker.string.uuid());
    expect(result.isSuccess()).toBe(false);
    assertFailure(result);
    expect(result.error.code).toBe("INTERNAL_ERROR");
  });

  it("should return INTERNAL_ERROR when commandMacroRepository.listMacros fails", async () => {
    const command = await testApp.createCommand({
      name: "List Failure Command",
      createdBy: testUserId,
    });

    vi.spyOn(commandMacroRepository, "listMacros").mockResolvedValueOnce(
      failure(AppError.internal("db error")),
    );

    const result = await useCase.execute(command.id);
    expect(result.isSuccess()).toBe(false);
    assertFailure(result);
    expect(result.error.code).toBe("INTERNAL_ERROR");
  });
});
