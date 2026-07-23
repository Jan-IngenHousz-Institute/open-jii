import { faker } from "@faker-js/faker";
import { StatusCodes } from "http-status-codes";

import { contract } from "@repo/api/contract";
import type { ProtocolMacroList } from "@repo/api/domains/protocol/protocol.schema";
import { macros } from "@repo/database";

import { AuthorizationService } from "../../authorization/authorization.service";
import { AppError, failure } from "../../common/utils/fp-utils";
import { TestHarness } from "../../test/test-harness";
import type { SuperTestResponse } from "../../test/test-harness";
import { CreateProtocolUseCase } from "../application/use-cases/create-protocol/create-protocol";
import { ProtocolMacroRepository } from "../core/repositories/protocol-macro.repository";

describe("ProtocolController - createProtocol", () => {
  const testApp = TestHarness.App;
  let testUserId: string;
  let createProtocolUseCase: CreateProtocolUseCase;

  beforeAll(async () => {
    await testApp.setup({ mock: { AnalyticsAdapter: true } });
  });

  beforeEach(async () => {
    await testApp.beforeEach();
    testUserId = await testApp.createTestUser({});
    createProtocolUseCase = testApp.module.get(CreateProtocolUseCase);
  });

  afterEach(() => {
    testApp.afterEach();
  });

  afterAll(async () => {
    await testApp.teardown();
  });

  it("should return 409 when a protocol with the same name already exists", async () => {
    // Arrange
    const protocolData = {
      name: "Test Protocol",
      description: "A test protocol description",
      code: [{ steps: [{ name: "Step 1", action: "test" }] }],
      family: "multispeq",
    };

    vi.spyOn(createProtocolUseCase, "execute").mockResolvedValue(
      failure(AppError.conflict("A protocol with this name already exists")),
    );

    // Act
    const response = await testApp
      .post(testApp.resolveOrpcPath(contract.protocols.createProtocol))
      .withAuth(testUserId)
      .send(protocolData)
      .expect(StatusCodes.CONFLICT);

    // Assert
    expect(response.body).toMatchObject({
      message: "A protocol with this name already exists",
    });
  });

  it("returns 403 when creating a protocol in an organization the caller is not a member of", async () => {
    const organizationId = faker.string.uuid();
    const isOrgMemberSpy = vi
      .spyOn(testApp.module.get(AuthorizationService), "isOrgMember")
      .mockResolvedValue(false);

    await testApp
      .post(testApp.resolveOrpcPath(contract.protocols.createProtocol))
      .withAuth(testUserId)
      .send({
        name: "Org protocol",
        description: "x",
        code: [{ steps: [] }],
        family: "multispeq",
        organizationId,
      })
      .expect(StatusCodes.FORBIDDEN);

    expect(isOrgMemberSpy).toHaveBeenCalledWith(testUserId, organizationId);
  });
});

describe("ProtocolController - read and update endpoints", () => {
  const testApp = TestHarness.App;
  let testUserId: string;

  beforeAll(async () => {
    await testApp.setup({ mock: { AnalyticsAdapter: true } });
  });

  beforeEach(async () => {
    await testApp.beforeEach();
    testUserId = await testApp.createTestUser({});
  });

  afterEach(() => {
    testApp.afterEach();
  });

  afterAll(async () => {
    await testApp.teardown();
  });

  it("getProtocol returns 200 with the protocol and parsed code", async () => {
    const protocol = await testApp.createProtocol({
      name: "Readable Protocol",
      createdBy: testUserId,
    });

    const path = testApp.resolveOrpcPath(contract.protocols.getProtocol, { id: protocol.id });
    const response: SuperTestResponse<{ id: string; name: string; code: unknown[] }> = await testApp
      .get(path)
      .withAuth(testUserId)
      .expect(StatusCodes.OK);

    expect(response.body).toMatchObject({ id: protocol.id, name: "Readable Protocol" });
    expect(Array.isArray(response.body.code)).toBe(true);
  });

  it("getProtocol returns 404 for an unknown id", async () => {
    const path = testApp.resolveOrpcPath(contract.protocols.getProtocol, {
      id: faker.string.uuid(),
    });

    await testApp.get(path).withAuth(testUserId).expect(StatusCodes.NOT_FOUND);
  });

  it("listProtocols returns 200 including the created protocol", async () => {
    const protocol = await testApp.createProtocol({
      name: "Listed Protocol",
      createdBy: testUserId,
    });

    const path = testApp.resolveOrpcPath(contract.protocols.listProtocols);
    const response: SuperTestResponse<{ id: string }[]> = await testApp
      .get(path)
      .withAuth(testUserId)
      .expect(StatusCodes.OK);

    expect(response.body.some((p) => p.id === protocol.id)).toBe(true);
  });

  it("updateProtocol returns 403 when a non-creator tries to update", async () => {
    const protocol = await testApp.createProtocol({
      name: "Owned Protocol",
      createdBy: testUserId,
    });
    const otherUserId = await testApp.createTestUser({});

    const path = testApp.resolveOrpcPath(contract.protocols.updateProtocol, { id: protocol.id });
    await testApp
      .patch(path)
      .withAuth(otherUserId)
      .send({ name: "Hijacked" })
      .expect(StatusCodes.FORBIDDEN);
  });

  describe("authorization", () => {
    // Each guarded route must delegate to AuthorizationService.can() with the
    // resource/action declared by its @CanAccess decorator, and turn a denial
    // into a 403. Mocking can() to deny pins the {resource, action} wiring, so a
    // missing or wrong-action decorator fails here.
    it.each([
      {
        name: "get protocol",
        action: "read",
        request: (id: string, userId: string) =>
          testApp
            .get(testApp.resolveOrpcPath(contract.protocols.getProtocol, { id }))
            .withAuth(userId),
      },
      {
        name: "update protocol",
        action: "update",
        request: (id: string, userId: string) =>
          testApp
            .patch(testApp.resolveOrpcPath(contract.protocols.updateProtocol, { id }))
            .withAuth(userId)
            .send({ name: "Blocked update" }),
      },
      {
        name: "delete protocol",
        action: "manage",
        request: (id: string, userId: string) =>
          testApp
            .delete(testApp.resolveOrpcPath(contract.protocols.deleteProtocol, { id }))
            .withAuth(userId),
      },
      {
        name: "list compatible macros",
        action: "read",
        request: (id: string, userId: string) =>
          testApp
            .get(testApp.resolveOrpcPath(contract.protocols.listCompatibleMacros, { id }))
            .withAuth(userId),
      },
      {
        name: "add compatible macros",
        action: "update",
        request: (id: string, userId: string) =>
          testApp
            .post(testApp.resolveOrpcPath(contract.protocols.addCompatibleMacros, { id }))
            .withAuth(userId)
            .send({ macroIds: [faker.string.uuid()] }),
      },
      {
        name: "remove compatible macro",
        action: "update",
        request: (id: string, userId: string) =>
          testApp
            .delete(
              testApp.resolveOrpcPath(contract.protocols.removeCompatibleMacro, {
                id,
                macroId: faker.string.uuid(),
              }),
            )
            .withAuth(userId),
      },
    ])("requires $action access to $name", async ({ action, request }) => {
      const canSpy = vi
        .spyOn(testApp.module.get(AuthorizationService), "can")
        .mockResolvedValue({ allow: false, reason: "forbidden" });
      const protocolId = faker.string.uuid();

      await request(protocolId, testUserId).expect(StatusCodes.FORBIDDEN);

      expect(canSpy).toHaveBeenCalledWith(testUserId, {
        resourceType: "protocol",
        resourceId: protocolId,
        action,
      });
    });
  });
});

describe("ProtocolController - protocol-macro endpoints", () => {
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

      const path = testApp.resolveOrpcPath(contract.protocols.listCompatibleMacros, {
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

      const path = testApp.resolveOrpcPath(contract.protocols.listCompatibleMacros, {
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

      const path = testApp.resolveOrpcPath(contract.protocols.listCompatibleMacros, {
        id: protocol.id,
      });

      await testApp.get(path).withoutAuth().expect(StatusCodes.UNAUTHORIZED);
    });

    it("should return 404 for unknown protocol", async () => {
      const nonExistentId = faker.string.uuid();
      const path = testApp.resolveOrpcPath(contract.protocols.listCompatibleMacros, {
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

      const path = testApp.resolveOrpcPath(contract.protocols.addCompatibleMacros, {
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

      const path = testApp.resolveOrpcPath(contract.protocols.addCompatibleMacros, {
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

      const path = testApp.resolveOrpcPath(contract.protocols.addCompatibleMacros, {
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

      const path = testApp.resolveOrpcPath(contract.protocols.addCompatibleMacros, {
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

      const path = testApp.resolveOrpcPath(contract.protocols.removeCompatibleMacro, {
        id: protocol.id,
        macroId: macro.id,
      });

      await testApp.delete(path).withAuth(testUserId).expect(StatusCodes.NO_CONTENT);

      // Verify it was actually removed
      const listPath = testApp.resolveOrpcPath(contract.protocols.listCompatibleMacros, {
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

      const path = testApp.resolveOrpcPath(contract.protocols.removeCompatibleMacro, {
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

      const path = testApp.resolveOrpcPath(contract.protocols.removeCompatibleMacro, {
        id: protocol.id,
        macroId: macro.id,
      });

      await testApp.delete(path).withAuth(otherUserId).expect(StatusCodes.FORBIDDEN);
    });

    it("should return 404 for unknown protocol", async () => {
      const nonExistentId = faker.string.uuid();
      const fakeMacroId = faker.string.uuid();

      const path = testApp.resolveOrpcPath(contract.protocols.removeCompatibleMacro, {
        id: nonExistentId,
        macroId: fakeMacroId,
      });

      await testApp.delete(path).withAuth(testUserId).expect(StatusCodes.NOT_FOUND);
    });
  });
});
