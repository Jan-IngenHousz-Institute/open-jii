import { faker } from "@faker-js/faker";

import { eq, macros, commandMacros, commands } from "@repo/database";

import { assertSuccess } from "../../../common/utils/fp-utils";
import { TestHarness } from "../../../test/test-harness";
import { CommandMacroRepository } from "./command-macro.repository";

describe("CommandMacroRepository", () => {
  const testApp = TestHarness.App;
  let repository: CommandMacroRepository;
  let testUserId: string;
  let commandId: string;
  let macro1Id: string;
  let macro2Id: string;

  beforeAll(async () => {
    await testApp.setup();
  });

  beforeEach(async () => {
    await testApp.beforeEach();
    testUserId = await testApp.createTestUser({});
    repository = testApp.module.get(CommandMacroRepository);

    // Create a command
    const command = await testApp.createCommand({
      name: "Test Command",
      createdBy: testUserId,
    });
    commandId = command.id;

    // Create two macros (no helper available, insert directly)
    const [m1] = await testApp.database
      .insert(macros)
      .values({
        name: `macro-alpha-${faker.string.alphanumeric(6)}`,
        filename: `macro_${faker.string.alphanumeric(8)}`,
        description: "First test macro",
        language: "python",
        code: btoa("print('hello')"),
        createdBy: testUserId,
      })
      .returning();
    macro1Id = m1.id;

    const [m2] = await testApp.database
      .insert(macros)
      .values({
        name: `macro-beta-${faker.string.alphanumeric(6)}`,
        filename: `macro_${faker.string.alphanumeric(8)}`,
        description: "Second test macro",
        language: "python",
        code: btoa("print('world')"),
        createdBy: testUserId,
      })
      .returning();
    macro2Id = m2.id;
  });

  afterEach(() => {
    testApp.afterEach();
  });

  afterAll(async () => {
    await testApp.teardown();
  });

  describe("listMacros", () => {
    it("should return empty array when no macros are linked", async () => {
      const result = await repository.listMacros(commandId);
      expect(result.isSuccess()).toBe(true);
      assertSuccess(result);
      expect(result.value).toEqual([]);
    });

    it("should return linked macros with joined data", async () => {
      // Link both macros
      await repository.addMacros(commandId, [macro1Id, macro2Id]);

      const result = await repository.listMacros(commandId);
      expect(result.isSuccess()).toBe(true);
      assertSuccess(result);
      expect(result.value).toHaveLength(2);

      // Results are ordered by macro name
      for (const entry of result.value) {
        expect(entry.commandId).toBe(commandId);
        expect(entry.addedAt).toBeDefined();
        expect(entry.macro).toMatchObject({
          id: expect.any(String) as string,
          name: expect.any(String) as string,
          filename: expect.any(String) as string,
          language: "python",
          createdBy: testUserId,
        });
      }

      const macroIds = result.value.map((e) => e.macro.id);
      expect(macroIds).toContain(macro1Id);
      expect(macroIds).toContain(macro2Id);
    });
  });

  describe("addMacros", () => {
    it("should insert and return newly linked macros", async () => {
      const result = await repository.addMacros(commandId, [macro1Id, macro2Id]);
      expect(result.isSuccess()).toBe(true);
      assertSuccess(result);
      expect(result.value).toHaveLength(2);

      const macroIds = result.value.map((e) => e.macro.id);
      expect(macroIds).toContain(macro1Id);
      expect(macroIds).toContain(macro2Id);
    });

    it("should return empty array when macroIds is empty", async () => {
      const result = await repository.addMacros(commandId, []);
      expect(result.isSuccess()).toBe(true);
      assertSuccess(result);
      expect(result.value).toEqual([]);
    });

    it("should be idempotent (adding same macro twice does not error)", async () => {
      // Add once
      const first = await repository.addMacros(commandId, [macro1Id]);
      expect(first.isSuccess()).toBe(true);
      assertSuccess(first);
      expect(first.value).toHaveLength(1);

      // Add the same macro again — onConflictDoNothing should prevent error
      const second = await repository.addMacros(commandId, [macro1Id]);
      expect(second.isSuccess()).toBe(true);
      assertSuccess(second);
      expect(second.value).toHaveLength(1);

      // Confirm only one row exists
      const listResult = await repository.listMacros(commandId);
      assertSuccess(listResult);
      expect(listResult.value).toHaveLength(1);
    });
  });

  describe("removeMacro", () => {
    it("should remove the link between command and macro", async () => {
      await repository.addMacros(commandId, [macro1Id, macro2Id]);

      const removeResult = await repository.removeMacro(commandId, macro1Id);
      expect(removeResult.isSuccess()).toBe(true);

      // Only macro2 should remain
      const listResult = await repository.listMacros(commandId);
      assertSuccess(listResult);
      expect(listResult.value).toHaveLength(1);
      expect(listResult.value[0].macro.id).toBe(macro2Id);
    });

    it("should be idempotent (removing non-existent link does not error)", async () => {
      const nonExistentMacroId = faker.string.uuid();
      const result = await repository.removeMacro(commandId, nonExistentMacroId);
      expect(result.isSuccess()).toBe(true);
    });
  });

  describe("cascade behavior", () => {
    it("should remove join rows when a command is deleted", async () => {
      await repository.addMacros(commandId, [macro1Id]);

      // Delete the command
      await testApp.database.delete(commands).where(eq(commands.id, commandId));

      // Verify the join row is gone
      const rows = await testApp.database
        .select()
        .from(commandMacros)
        .where(eq(commandMacros.commandId, commandId));
      expect(rows).toHaveLength(0);
    });

    it("should remove join rows when a macro is deleted", async () => {
      await repository.addMacros(commandId, [macro1Id]);

      // Delete the macro
      await testApp.database.delete(macros).where(eq(macros.id, macro1Id));

      // Verify the join row is gone
      const rows = await testApp.database
        .select()
        .from(commandMacros)
        .where(eq(commandMacros.macroId, macro1Id));
      expect(rows).toHaveLength(0);
    });
  });
});
