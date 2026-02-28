import { faker } from "@faker-js/faker";
import { StatusCodes } from "http-status-codes";

import { contract } from "@repo/api";
import type { ProtocolMacroList } from "@repo/api";
import { macros } from "@repo/database";

import { TestHarness } from "../../test/test-harness";
import type { SuperTestResponse } from "../../test/test-harness";
import { ProtocolMacroRepository } from "../core/repositories/protocol-macro.repository";

describe("ProtocolMacrosController", () => {
  const testApp = TestHarness.App;
  let testUserId: string;
  let protocolMacroRepository: ProtocolMacroRepository;

  beforeAll(async () => {
    await testApp.setup({ mock: { AnalyticsAdapter: true } });
  });

  beforeEach(async () => {
    await testApp.beforeEach();
    testUserId = await testApp.createTestUser({});
    protocolMacroRepository = testApp.module.get(ProtocolMacroRepository);
    vi.restoreAllMocks();
  });

  afterEach(() => {
    testApp.afterEach();
  });

  afterAll(async () => {
    await testApp.teardown();
  });

  // Helper to create a macro for tests
  async function createTestMacro(userId: string) {
    const [macro] = await testApp.database
      .insert(macros)
      .values({
        name: `ctrl-macro-${faker.string.alphanumeric(8)}`,
        filename: `macro_${faker.string.alphanumeric(8)}`,
        description: "controller test macro",
        language: "python",
        code: btoa("print('hello')"),
        createdBy: userId,
      })
      .returning();
    return macro;
  }

  describe("listCompatibleMacros", () => {
    it("should return 200 with linked macros", async () => {
      const protocol = await testApp.createProtocol({
        name: "List Macros Protocol",
        createdBy: testUserId,
      });

      const macro1 = await createTestMacro(testUserId);
      const macro2 = await createTestMacro(testUserId);
      await protocolMacroRepository.addMacros(protocol.id, [macro1.id, macro2.id]);

      const path = testApp.resolvePath(contract.protocols.listCompatibleMacros.path, {
        id: protocol.id,
      });

      const response: SuperTestResponse<ProtocolMacroList> = await testApp
        .get(path)
        .withAuth(testUserId)
        .expect(StatusCodes.OK);
      expect(response.body).toHaveLength(2);

      const macroIds = response.body.map((e) => e.macro.id);
      expect(macroIds).toContain(macro1.id);
      expect(macroIds).toContain(macro2.id);
    });

    it("should return 200 with empty array when no macros linked", async () => {
      const protocol = await testApp.createProtocol({
        name: "Empty Macros Protocol",
        createdBy: testUserId,
      });

      const path = testApp.resolvePath(contract.protocols.listCompatibleMacros.path, {
        id: protocol.id,
      });

      const response = await testApp.get(path).withAuth(testUserId).expect(StatusCodes.OK);
      expect(response.body).toHaveLength(0);
    });

    it("should return 401 without auth", async () => {
      const protocol = await testApp.createProtocol({
        name: "Unauth List Protocol",
        createdBy: testUserId,
      });

      const path = testApp.resolvePath(contract.protocols.listCompatibleMacros.path, {
        id: protocol.id,
      });

      await testApp.get(path).withoutAuth().expect(StatusCodes.UNAUTHORIZED);
    });

    it("should return 404 for unknown protocol", async () => {
      const nonExistentId = faker.string.uuid();
      const path = testApp.resolvePath(contract.protocols.listCompatibleMacros.path, {
        id: nonExistentId,
      });

      await testApp.get(path).withAuth(testUserId).expect(StatusCodes.NOT_FOUND);
    });
  });

  describe("addCompatibleMacros", () => {
    it("should return 201 with valid body", async () => {
      const protocol = await testApp.createProtocol({
        name: "Add Macros Controller Protocol",
        createdBy: testUserId,
      });

      const macro = await createTestMacro(testUserId);

      const path = testApp.resolvePath(contract.protocols.addCompatibleMacros.path, {
        id: protocol.id,
      });

      const response: SuperTestResponse<ProtocolMacroList> = await testApp
        .post(path)
        .withAuth(testUserId)
        .send({ macroIds: [macro.id] })
        .expect(StatusCodes.CREATED);

      expect(response.body).toHaveLength(1);
      expect(response.body[0].macro.id).toBe(macro.id);
    });

    it("should return 401 without auth", async () => {
      const protocol = await testApp.createProtocol({
        name: "Unauth Add Protocol",
        createdBy: testUserId,
      });

      const macro = await createTestMacro(testUserId);

      const path = testApp.resolvePath(contract.protocols.addCompatibleMacros.path, {
        id: protocol.id,
      });

      await testApp
        .post(path)
        .withoutAuth()
        .send({ macroIds: [macro.id] })
        .expect(StatusCodes.UNAUTHORIZED);
    });

    it("should return 403 for non-creator", async () => {
      const protocol = await testApp.createProtocol({
        name: "Forbidden Add Protocol",
        createdBy: testUserId,
      });

      const otherUserId = await testApp.createTestUser({ email: "other-ctrl@example.com" });
      const macro = await createTestMacro(testUserId);

      const path = testApp.resolvePath(contract.protocols.addCompatibleMacros.path, {
        id: protocol.id,
      });

      await testApp
        .post(path)
        .withAuth(otherUserId)
        .send({ macroIds: [macro.id] })
        .expect(StatusCodes.FORBIDDEN);
    });

    it("should return 404 for unknown protocol", async () => {
      const nonExistentId = faker.string.uuid();
      const macro = await createTestMacro(testUserId);

      const path = testApp.resolvePath(contract.protocols.addCompatibleMacros.path, {
        id: nonExistentId,
      });

      await testApp
        .post(path)
        .withAuth(testUserId)
        .send({ macroIds: [macro.id] })
        .expect(StatusCodes.NOT_FOUND);
    });
  });

  describe("removeCompatibleMacro", () => {
    it("should return 204 on successful removal", async () => {
      const protocol = await testApp.createProtocol({
        name: "Remove Macro Controller Protocol",
        createdBy: testUserId,
      });

      const macro = await createTestMacro(testUserId);
      await protocolMacroRepository.addMacros(protocol.id, [macro.id]);

      const path = testApp.resolvePath(contract.protocols.removeCompatibleMacro.path, {
        id: protocol.id,
        macroId: macro.id,
      });

      await testApp.delete(path).withAuth(testUserId).expect(StatusCodes.NO_CONTENT);

      // Verify it was actually removed
      const listPath = testApp.resolvePath(contract.protocols.listCompatibleMacros.path, {
        id: protocol.id,
      });
      const listResponse = await testApp.get(listPath).withAuth(testUserId).expect(StatusCodes.OK);
      expect(listResponse.body).toHaveLength(0);
    });

    it("should return 401 without auth", async () => {
      const protocol = await testApp.createProtocol({
        name: "Unauth Remove Protocol",
        createdBy: testUserId,
      });

      const macro = await createTestMacro(testUserId);
      await protocolMacroRepository.addMacros(protocol.id, [macro.id]);

      const path = testApp.resolvePath(contract.protocols.removeCompatibleMacro.path, {
        id: protocol.id,
        macroId: macro.id,
      });

      await testApp.delete(path).withoutAuth().expect(StatusCodes.UNAUTHORIZED);
    });

    it("should return 403 for non-creator", async () => {
      const protocol = await testApp.createProtocol({
        name: "Forbidden Remove Controller Protocol",
        createdBy: testUserId,
      });

      const otherUserId = await testApp.createTestUser({ email: "other-remove-ctrl@example.com" });
      const macro = await createTestMacro(testUserId);
      await protocolMacroRepository.addMacros(protocol.id, [macro.id]);

      const path = testApp.resolvePath(contract.protocols.removeCompatibleMacro.path, {
        id: protocol.id,
        macroId: macro.id,
      });

      await testApp.delete(path).withAuth(otherUserId).expect(StatusCodes.FORBIDDEN);
    });

    it("should return 404 for unknown protocol", async () => {
      const nonExistentId = faker.string.uuid();
      const fakeMacroId = faker.string.uuid();

      const path = testApp.resolvePath(contract.protocols.removeCompatibleMacro.path, {
        id: nonExistentId,
        macroId: fakeMacroId,
      });

      await testApp.delete(path).withAuth(testUserId).expect(StatusCodes.NOT_FOUND);
    });
  });
});
