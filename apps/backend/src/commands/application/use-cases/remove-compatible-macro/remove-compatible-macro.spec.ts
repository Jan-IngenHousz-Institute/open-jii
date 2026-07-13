import { faker } from "@faker-js/faker";

import { macros } from "@repo/database";

import { assertFailure, failure, AppError } from "../../../../common/utils/fp-utils";
import { TestHarness } from "../../../../test/test-harness";
import { CommandMacroRepository } from "../../../core/repositories/command-macro.repository";
import { CommandRepository } from "../../../core/repositories/command.repository";
import { RemoveCompatibleMacroUseCase } from "./remove-compatible-macro";

describe("RemoveCompatibleMacroUseCase", () => {
  const testApp = TestHarness.App;
  let testUserId: string;
  let useCase: RemoveCompatibleMacroUseCase;
  let commandMacroRepository: CommandMacroRepository;

  beforeAll(async () => {
    await testApp.setup();
  });

  beforeEach(async () => {
    await testApp.beforeEach();
    testUserId = await testApp.createTestUser({});
    useCase = testApp.module.get(RemoveCompatibleMacroUseCase);
    commandMacroRepository = testApp.module.get(CommandMacroRepository);
  });

  afterEach(() => {
    testApp.afterEach();
  });

  afterAll(async () => {
    await testApp.teardown();
  });

  it("should succeed when called by the command creator", async () => {
    const command = await testApp.createCommand({
      name: "Remove Macro Command",
      createdBy: testUserId,
    });

    const [macro] = await testApp.database
      .insert(macros)
      .values({
        name: `remove-macro-${faker.string.alphanumeric(6)}`,
        filename: `macro_${faker.string.alphanumeric(8)}`,
        description: "test",
        language: "python",
        code: btoa("print('hello')"),
        createdBy: testUserId,
      })
      .returning();

    // Link the macro first
    await commandMacroRepository.addMacros(command.id, [macro.id]);

    // Remove it
    const result = await useCase.execute(command.id, macro.id, testUserId);
    expect(result.isSuccess()).toBe(true);
  });

  it("should return FORBIDDEN when called by a non-creator", async () => {
    const command = await testApp.createCommand({
      name: "Forbidden Remove Command",
      createdBy: testUserId,
    });

    const otherUserId = await testApp.createTestUser({ email: "other-remove@example.com" });

    const [macro] = await testApp.database
      .insert(macros)
      .values({
        name: `forbidden-remove-macro-${faker.string.alphanumeric(6)}`,
        filename: `macro_${faker.string.alphanumeric(8)}`,
        description: "test",
        language: "python",
        code: btoa("print('hello')"),
        createdBy: testUserId,
      })
      .returning();

    await commandMacroRepository.addMacros(command.id, [macro.id]);

    const result = await useCase.execute(command.id, macro.id, otherUserId);
    expect(result.isSuccess()).toBe(false);
    assertFailure(result);
    expect(result.error.code).toBe("FORBIDDEN");
  });

  it("should return NOT_FOUND for unknown commandId", async () => {
    const nonExistentCommandId = faker.string.uuid();
    const fakeMacroId = faker.string.uuid();

    const result = await useCase.execute(nonExistentCommandId, fakeMacroId, testUserId);
    expect(result.isSuccess()).toBe(false);
    assertFailure(result);
    expect(result.error.code).toBe("NOT_FOUND");
  });

  it("should return INTERNAL_ERROR when commandRepository.findOne fails", async () => {
    const commandRepo = testApp.module.get(CommandRepository);
    vi.spyOn(commandRepo, "findOne").mockResolvedValueOnce(failure(AppError.internal("db error")));

    const result = await useCase.execute(faker.string.uuid(), faker.string.uuid(), testUserId);
    expect(result.isSuccess()).toBe(false);
    assertFailure(result);
    expect(result.error.code).toBe("INTERNAL_ERROR");
  });

  it("should return INTERNAL_ERROR when commandMacroRepository.removeMacro fails", async () => {
    const command = await testApp.createCommand({
      name: "Remove Failure Command",
      createdBy: testUserId,
    });

    const [macro] = await testApp.database
      .insert(macros)
      .values({
        name: `remove-fail-macro-${faker.string.alphanumeric(6)}`,
        filename: `macro_${faker.string.alphanumeric(8)}`,
        description: "test",
        language: "python",
        code: btoa("print('hello')"),
        createdBy: testUserId,
      })
      .returning();

    await commandMacroRepository.addMacros(command.id, [macro.id]);

    vi.spyOn(commandMacroRepository, "removeMacro").mockResolvedValueOnce(
      failure(AppError.internal("db error")),
    );

    const result = await useCase.execute(command.id, macro.id, testUserId);
    expect(result.isSuccess()).toBe(false);
    assertFailure(result);
    expect(result.error.code).toBe("INTERNAL_ERROR");
  });
});
