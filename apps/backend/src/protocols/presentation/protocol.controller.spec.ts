import { faker } from "@faker-js/faker";
import { StatusCodes } from "http-status-codes";

import { contract } from "@repo/api/contract";
import type { ProtocolMacroList } from "@repo/api/schemas/protocol.schema";
import { macros } from "@repo/database";

import { AppError, failure, success } from "../../common/utils/fp-utils";
import { TestHarness } from "../../test/test-harness";
import type { SuperTestResponse } from "../../test/test-harness";
import { CreateProtocolUseCase } from "../application/use-cases/create-protocol/create-protocol";
import { DuplicateProtocolUseCase } from "../application/use-cases/duplicate-protocol/duplicate-protocol";
import { GetProtocolUsageUseCase } from "../application/use-cases/get-protocol-usage/get-protocol-usage";
import { ListProtocolVersionsUseCase } from "../application/use-cases/list-protocol-versions/list-protocol-versions";
import { RestoreProtocolVersionUseCase } from "../application/use-cases/restore-protocol-version/restore-protocol-version";
import type { ProtocolDto } from "../core/models/protocol.model";
import { ProtocolMacroRepository } from "../core/repositories/protocol-macro.repository";

describe("ProtocolController – createProtocol", () => {
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
      .post(contract.protocols.createProtocol.path)
      .withAuth(testUserId)
      .send(protocolData)
      .expect(StatusCodes.CONFLICT);

    // Assert
    expect(response.body).toMatchObject({
      message: "A protocol with this name already exists",
    });
  });
});

describe("ProtocolController – protocol-macro endpoints", () => {
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

describe("ProtocolController – versioning endpoints", () => {
  const testApp = TestHarness.App;
  let testUserId: string;
  let listProtocolVersionsUseCase: ListProtocolVersionsUseCase;
  let restoreProtocolVersionUseCase: RestoreProtocolVersionUseCase;
  let duplicateProtocolUseCase: DuplicateProtocolUseCase;
  let getProtocolUsageUseCase: GetProtocolUsageUseCase;

  beforeAll(async () => {
    await testApp.setup();
  });

  beforeEach(async () => {
    await testApp.beforeEach();
    testUserId = await testApp.createTestUser({});
    listProtocolVersionsUseCase = testApp.module.get(ListProtocolVersionsUseCase);
    restoreProtocolVersionUseCase = testApp.module.get(RestoreProtocolVersionUseCase);
    duplicateProtocolUseCase = testApp.module.get(DuplicateProtocolUseCase);
    getProtocolUsageUseCase = testApp.module.get(GetProtocolUsageUseCase);
  });

  afterEach(() => {
    testApp.afterEach();
  });

  afterAll(async () => {
    await testApp.teardown();
  });

  const makeProtocol = (id: string): ProtocolDto => ({
    id,
    name: "Copy of P",
    description: null,
    code: [{ step: 1 }],
    family: "multispeq",
    sortOrder: null,
    latestVersion: 1,
    createdBy: testUserId,
    createdAt: new Date(),
    updatedAt: new Date(),
  });

  describe("listProtocolVersions", () => {
    it("returns the version list", async () => {
      const id = faker.string.uuid();
      const spy = vi.spyOn(listProtocolVersionsUseCase, "execute").mockResolvedValue(
        success([
          { version: 2, createdBy: testUserId, createdAt: new Date() },
          { version: 1, createdBy: testUserId, createdAt: new Date() },
        ]),
      );

      const res = await testApp
        .get(contract.protocols.listProtocolVersions.path.replace(":id", id))
        .withAuth(testUserId)
        .expect(StatusCodes.OK);

      expect(res.body).toHaveLength(2);
      expect(spy).toHaveBeenCalledWith(id);
    });

    it("requires authentication", async () => {
      await testApp
        .get(contract.protocols.listProtocolVersions.path.replace(":id", faker.string.uuid()))
        .expect(StatusCodes.UNAUTHORIZED);
    });
  });

  describe("getProtocolUsage", () => {
    it("returns usage count and referencing workbooks", async () => {
      const id = faker.string.uuid();
      const spy = vi
        .spyOn(getProtocolUsageUseCase, "execute")
        .mockResolvedValue(
          success({ count: 2, workbooks: [{ id: faker.string.uuid(), name: "WB" }] }),
        );

      const res = await testApp
        .get(contract.protocols.getProtocolUsage.path.replace(":id", id))
        .withAuth(testUserId)
        .expect(StatusCodes.OK);

      expect(res.body).toMatchObject({ count: 2 });
      expect(spy).toHaveBeenCalledWith(id);
    });
  });

  describe("duplicateProtocol", () => {
    it("duplicates with the session user and name override", async () => {
      const id = faker.string.uuid();
      const spy = vi
        .spyOn(duplicateProtocolUseCase, "execute")
        .mockResolvedValue(success(makeProtocol(faker.string.uuid())));

      const res = await testApp
        .post(contract.protocols.duplicateProtocol.path.replace(":id", id))
        .withAuth(testUserId)
        .send({ name: "Copy of P" })
        .expect(StatusCodes.CREATED);

      expect(res.body).toMatchObject({ name: "Copy of P" });
      expect(spy).toHaveBeenCalledWith(id, testUserId, "Copy of P");
    });

    it("returns 404 when the source protocol is missing", async () => {
      vi.spyOn(duplicateProtocolUseCase, "execute").mockResolvedValue(
        failure(AppError.notFound("Protocol not found")),
      );

      await testApp
        .post(contract.protocols.duplicateProtocol.path.replace(":id", faker.string.uuid()))
        .withAuth(testUserId)
        .send({})
        .expect(StatusCodes.NOT_FOUND);
    });
  });

  describe("restoreProtocolVersion", () => {
    it("restores with the session user and the path version", async () => {
      const id = faker.string.uuid();
      const spy = vi
        .spyOn(restoreProtocolVersionUseCase, "execute")
        .mockResolvedValue(success(makeProtocol(id)));

      const path = testApp.resolvePath(contract.protocols.restoreProtocolVersion.path, {
        id,
        version: "2",
      });
      await testApp.post(path).withAuth(testUserId).send({}).expect(StatusCodes.OK);

      expect(spy).toHaveBeenCalledWith(id, 2, testUserId);
    });

    it("returns 403 when the user is not the creator", async () => {
      const id = faker.string.uuid();
      vi.spyOn(restoreProtocolVersionUseCase, "execute").mockResolvedValue(
        failure(AppError.forbidden("Only the protocol creator can restore versions")),
      );

      const path = testApp.resolvePath(contract.protocols.restoreProtocolVersion.path, {
        id,
        version: "1",
      });
      await testApp.post(path).withAuth(testUserId).send({}).expect(StatusCodes.FORBIDDEN);
    });
  });
});
