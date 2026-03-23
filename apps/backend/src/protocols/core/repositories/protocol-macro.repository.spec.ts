import { faker } from "@faker-js/faker";

import { eq, macros, protocolMacros, protocols } from "@repo/database";

import { assertSuccess } from "../../../common/utils/fp-utils";
import { TestHarness } from "../../../test/test-harness";
import { ProtocolMacroRepository } from "./protocol-macro.repository";

describe("ProtocolMacroRepository", () => {
  const testApp = TestHarness.App;
  let repository: ProtocolMacroRepository;
  let testUserId: string;
  let protocolId: string;
  let protocolVersion: number;
  let macro1Id: string;
  let macro1Version: number;
  let macro2Id: string;
  let macro2Version: number;

  beforeAll(async () => {
    await testApp.setup();
  });

  beforeEach(async () => {
    await testApp.beforeEach();
    testUserId = await testApp.createTestUser({});
    repository = testApp.module.get(ProtocolMacroRepository);

    // Create a protocol
    const protocol = await testApp.createProtocol({
      name: "Test Protocol",
      createdBy: testUserId,
    });
    protocolId = protocol.id;
    protocolVersion = protocol.version;

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
    macro1Version = m1.version;

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
    macro2Version = m2.version;
  });

  afterEach(() => {
    testApp.afterEach();
  });

  afterAll(async () => {
    await testApp.teardown();
  });

  describe("listMacros", () => {
    it("should return empty array when no macros are linked", async () => {
      const result = await repository.listMacros(protocolId, protocolVersion);
      expect(result.isSuccess()).toBe(true);
      assertSuccess(result);
      expect(result.value).toEqual([]);
    });

    it("should return linked macros with joined data", async () => {
      // Link both macros
      await repository.addMacros(protocolId, protocolVersion, [
        { id: macro1Id, version: macro1Version },
        { id: macro2Id, version: macro2Version },
      ]);

      const result = await repository.listMacros(protocolId, protocolVersion);
      expect(result.isSuccess()).toBe(true);
      assertSuccess(result);
      expect(result.value).toHaveLength(2);

      // Results are ordered by macro name
      for (const entry of result.value) {
        expect(entry.protocolId).toBe(protocolId);
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
      const result = await repository.addMacros(protocolId, protocolVersion, [
        { id: macro1Id, version: macro1Version },
        { id: macro2Id, version: macro2Version },
      ]);
      expect(result.isSuccess()).toBe(true);
      assertSuccess(result);
      expect(result.value).toHaveLength(2);

      const macroIds = result.value.map((e) => e.macro.id);
      expect(macroIds).toContain(macro1Id);
      expect(macroIds).toContain(macro2Id);
    });

    it("should return empty array when macroRefs is empty", async () => {
      const result = await repository.addMacros(protocolId, protocolVersion, []);
      expect(result.isSuccess()).toBe(true);
      assertSuccess(result);
      expect(result.value).toEqual([]);
    });

    it("should be idempotent (adding same macro twice does not error)", async () => {
      // Add once
      const first = await repository.addMacros(protocolId, protocolVersion, [
        { id: macro1Id, version: macro1Version },
      ]);
      expect(first.isSuccess()).toBe(true);
      assertSuccess(first);
      expect(first.value).toHaveLength(1);

      // Add the same macro again — onConflictDoNothing should prevent error
      const second = await repository.addMacros(protocolId, protocolVersion, [
        { id: macro1Id, version: macro1Version },
      ]);
      expect(second.isSuccess()).toBe(true);
      assertSuccess(second);
      expect(second.value).toHaveLength(1);

      // Confirm only one row exists
      const listResult = await repository.listMacros(protocolId, protocolVersion);
      assertSuccess(listResult);
      expect(listResult.value).toHaveLength(1);
    });
  });

  describe("removeMacro", () => {
    it("should remove the link between protocol and macro", async () => {
      await repository.addMacros(protocolId, protocolVersion, [
        { id: macro1Id, version: macro1Version },
        { id: macro2Id, version: macro2Version },
      ]);

      const removeResult = await repository.removeMacro(
        protocolId,
        protocolVersion,
        macro1Id,
        macro1Version,
      );
      expect(removeResult.isSuccess()).toBe(true);

      // Only macro2 should remain
      const listResult = await repository.listMacros(protocolId, protocolVersion);
      assertSuccess(listResult);
      expect(listResult.value).toHaveLength(1);
      expect(listResult.value[0].macro.id).toBe(macro2Id);
    });

    it("should be idempotent (removing non-existent link does not error)", async () => {
      const nonExistentMacroId = faker.string.uuid();
      const result = await repository.removeMacro(
        protocolId,
        protocolVersion,
        nonExistentMacroId,
        1,
      );
      expect(result.isSuccess()).toBe(true);
    });
  });

  describe("cascade behavior", () => {
    it("should remove join rows when a protocol is deleted", async () => {
      await repository.addMacros(protocolId, protocolVersion, [
        { id: macro1Id, version: macro1Version },
      ]);

      // Delete the protocol
      await testApp.database.delete(protocols).where(eq(protocols.id, protocolId));

      // Verify the join row is gone
      const rows = await testApp.database
        .select()
        .from(protocolMacros)
        .where(eq(protocolMacros.protocolId, protocolId));
      expect(rows).toHaveLength(0);
    });

    it("should remove join rows when a macro is deleted", async () => {
      await repository.addMacros(protocolId, protocolVersion, [
        { id: macro1Id, version: macro1Version },
      ]);

      // Delete the macro
      await testApp.database.delete(macros).where(eq(macros.id, macro1Id));

      // Verify the join row is gone
      const rows = await testApp.database
        .select()
        .from(protocolMacros)
        .where(eq(protocolMacros.macroId, macro1Id));
      expect(rows).toHaveLength(0);
    });
  });
});
