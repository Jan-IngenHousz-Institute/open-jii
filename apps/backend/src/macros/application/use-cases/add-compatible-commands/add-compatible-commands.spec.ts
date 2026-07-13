import { faker } from "@faker-js/faker";

import { assertFailure, assertSuccess, failure, AppError } from "../../../../common/utils/fp-utils";
import { TestHarness } from "../../../../test/test-harness";
import { MacroCommandRepository } from "../../../core/repositories/macro-command.repository";
import { MacroRepository } from "../../../core/repositories/macro.repository";
import { AddCompatibleCommandsUseCase } from "./add-compatible-commands";

describe("AddCompatibleCommandsUseCase", () => {
  const testApp = TestHarness.App;
  let testUserId: string;
  let useCase: AddCompatibleCommandsUseCase;

  beforeAll(async () => {
    await testApp.setup();
  });

  beforeEach(async () => {
    await testApp.beforeEach();
    testUserId = await testApp.createTestUser({});
    useCase = testApp.module.get(AddCompatibleCommandsUseCase);
  });

  afterEach(() => {
    testApp.afterEach();
  });

  afterAll(async () => {
    await testApp.teardown();
  });

  it("should succeed when called by the macro creator", async () => {
    const macro = await testApp.createMacro({
      name: "Add Commands Macro",
      createdBy: testUserId,
    });

    const command1 = await testApp.createCommand({
      name: `add-command-1-${faker.string.alphanumeric(6)}`,
      createdBy: testUserId,
    });

    const command2 = await testApp.createCommand({
      name: `add-command-2-${faker.string.alphanumeric(6)}`,
      createdBy: testUserId,
    });

    const result = await useCase.execute(macro.id, [command1.id, command2.id], testUserId);
    expect(result.isSuccess()).toBe(true);
    assertSuccess(result);
    expect(result.value).toHaveLength(2);

    const commandIds = result.value.map((e) => e.command.id);
    expect(commandIds).toContain(command1.id);
    expect(commandIds).toContain(command2.id);
  });

  it("should return FORBIDDEN when called by a non-creator", async () => {
    const macro = await testApp.createMacro({
      name: "Forbidden Commands Macro",
      createdBy: testUserId,
    });

    const otherUserId = await testApp.createTestUser({ email: "other@example.com" });

    const command = await testApp.createCommand({
      name: `forbidden-command-${faker.string.alphanumeric(6)}`,
      createdBy: testUserId,
    });

    const result = await useCase.execute(macro.id, [command.id], otherUserId);
    expect(result.isSuccess()).toBe(false);
    assertFailure(result);
    expect(result.error.code).toBe("FORBIDDEN");
  });

  it("should return NOT_FOUND for unknown macroId", async () => {
    const nonExistentMacroId = faker.string.uuid();

    const command = await testApp.createCommand({
      name: `notfound-command-${faker.string.alphanumeric(6)}`,
      createdBy: testUserId,
    });

    const result = await useCase.execute(nonExistentMacroId, [command.id], testUserId);
    expect(result.isSuccess()).toBe(false);
    assertFailure(result);
    expect(result.error.code).toBe("NOT_FOUND");
  });

  it("should return NOT_FOUND for unknown commandId", async () => {
    const macro = await testApp.createMacro({
      name: "Unknown Command Macro",
      createdBy: testUserId,
    });

    const nonExistentCommandId = faker.string.uuid();

    const result = await useCase.execute(macro.id, [nonExistentCommandId], testUserId);
    expect(result.isSuccess()).toBe(false);
    assertFailure(result);
    expect(result.error.code).toBe("NOT_FOUND");
  });

  it("should return INTERNAL_ERROR when macroRepository.findById fails", async () => {
    const macroRepo = testApp.module.get(MacroRepository);
    vi.spyOn(macroRepo, "findById").mockResolvedValueOnce(failure(AppError.internal("db error")));

    const result = await useCase.execute(faker.string.uuid(), [faker.string.uuid()], testUserId);
    expect(result.isSuccess()).toBe(false);
    assertFailure(result);
    expect(result.error.code).toBe("INTERNAL_ERROR");
  });

  it("should return INTERNAL_ERROR when macroCommandRepository.findCommandById fails", async () => {
    const macro = await testApp.createMacro({
      name: "Command Verify Failure Macro",
      createdBy: testUserId,
    });

    const command = await testApp.createCommand({
      name: `verify-fail-command-${faker.string.alphanumeric(6)}`,
      createdBy: testUserId,
    });

    const macroCommandRepo = testApp.module.get(MacroCommandRepository);
    vi.spyOn(macroCommandRepo, "findCommandById").mockResolvedValueOnce(
      failure(AppError.internal("db error")),
    );

    const result = await useCase.execute(macro.id, [command.id], testUserId);
    expect(result.isSuccess()).toBe(false);
    assertFailure(result);
    expect(result.error.code).toBe("INTERNAL_ERROR");
  });

  it("should return INTERNAL_ERROR when macroCommandRepository.addCommands fails", async () => {
    const macro = await testApp.createMacro({
      name: "Add Failure Macro",
      createdBy: testUserId,
    });

    const command = await testApp.createCommand({
      name: `add-fail-command-${faker.string.alphanumeric(6)}`,
      createdBy: testUserId,
    });

    const macroCommandRepo = testApp.module.get(MacroCommandRepository);
    vi.spyOn(macroCommandRepo, "addCommands").mockResolvedValueOnce(
      failure(AppError.internal("db error")),
    );

    const result = await useCase.execute(macro.id, [command.id], testUserId);
    expect(result.isSuccess()).toBe(false);
    assertFailure(result);
    expect(result.error.code).toBe("INTERNAL_ERROR");
  });
});
