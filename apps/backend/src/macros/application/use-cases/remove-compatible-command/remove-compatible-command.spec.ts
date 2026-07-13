import { faker } from "@faker-js/faker";

import { assertFailure, failure, AppError } from "../../../../common/utils/fp-utils";
import { TestHarness } from "../../../../test/test-harness";
import { MacroCommandRepository } from "../../../core/repositories/macro-command.repository";
import { MacroRepository } from "../../../core/repositories/macro.repository";
import { RemoveCompatibleCommandUseCase } from "./remove-compatible-command";

describe("RemoveCompatibleCommandUseCase", () => {
  const testApp = TestHarness.App;
  let testUserId: string;
  let useCase: RemoveCompatibleCommandUseCase;
  let macroCommandRepository: MacroCommandRepository;

  beforeAll(async () => {
    await testApp.setup();
  });

  beforeEach(async () => {
    await testApp.beforeEach();
    testUserId = await testApp.createTestUser({});
    useCase = testApp.module.get(RemoveCompatibleCommandUseCase);
    macroCommandRepository = testApp.module.get(MacroCommandRepository);
  });

  afterEach(() => {
    testApp.afterEach();
  });

  afterAll(async () => {
    await testApp.teardown();
  });

  it("should succeed when called by the macro creator", async () => {
    const macro = await testApp.createMacro({
      name: "Remove Command Macro",
      createdBy: testUserId,
    });

    const command = await testApp.createCommand({
      name: `remove-command-${faker.string.alphanumeric(6)}`,
      createdBy: testUserId,
    });

    // Link the command first
    await macroCommandRepository.addCommands(macro.id, [command.id]);

    // Remove it
    const result = await useCase.execute(macro.id, command.id, testUserId);
    expect(result.isSuccess()).toBe(true);
  });

  it("should return FORBIDDEN when called by a non-creator", async () => {
    const macro = await testApp.createMacro({
      name: "Forbidden Remove Macro",
      createdBy: testUserId,
    });

    const otherUserId = await testApp.createTestUser({ email: "other-remove@example.com" });

    const command = await testApp.createCommand({
      name: `forbidden-remove-command-${faker.string.alphanumeric(6)}`,
      createdBy: testUserId,
    });

    await macroCommandRepository.addCommands(macro.id, [command.id]);

    const result = await useCase.execute(macro.id, command.id, otherUserId);
    expect(result.isSuccess()).toBe(false);
    assertFailure(result);
    expect(result.error.code).toBe("FORBIDDEN");
  });

  it("should return NOT_FOUND for unknown macroId", async () => {
    const nonExistentMacroId = faker.string.uuid();
    const fakeCommandId = faker.string.uuid();

    const result = await useCase.execute(nonExistentMacroId, fakeCommandId, testUserId);
    expect(result.isSuccess()).toBe(false);
    assertFailure(result);
    expect(result.error.code).toBe("NOT_FOUND");
  });

  it("should return INTERNAL_ERROR when macroRepository.findById fails", async () => {
    const macroRepo = testApp.module.get(MacroRepository);
    vi.spyOn(macroRepo, "findById").mockResolvedValueOnce(failure(AppError.internal("db error")));

    const result = await useCase.execute(faker.string.uuid(), faker.string.uuid(), testUserId);
    expect(result.isSuccess()).toBe(false);
    assertFailure(result);
    expect(result.error.code).toBe("INTERNAL_ERROR");
  });

  it("should return INTERNAL_ERROR when macroCommandRepository.removeCommand fails", async () => {
    const macro = await testApp.createMacro({
      name: "Remove Failure Macro",
      createdBy: testUserId,
    });

    const command = await testApp.createCommand({
      name: `remove-fail-command-${faker.string.alphanumeric(6)}`,
      createdBy: testUserId,
    });

    await macroCommandRepository.addCommands(macro.id, [command.id]);

    vi.spyOn(macroCommandRepository, "removeCommand").mockResolvedValueOnce(
      failure(AppError.internal("db error")),
    );

    const result = await useCase.execute(macro.id, command.id, testUserId);
    expect(result.isSuccess()).toBe(false);
    assertFailure(result);
    expect(result.error.code).toBe("INTERNAL_ERROR");
  });
});
