import { faker } from "@faker-js/faker";

import { macros } from "@repo/database";

import { assertFailure, assertSuccess, failure, AppError } from "../../../../common/utils/fp-utils";
import { TestHarness } from "../../../../test/test-harness";
import { ProtocolMacroRepository } from "../../../core/repositories/protocol-macro.repository";
import { ProtocolRepository } from "../../../core/repositories/protocol.repository";
import { ListCompatibleMacrosUseCase } from "./list-compatible-macros";

describe("ListCompatibleMacrosUseCase", () => {
  const testApp = TestHarness.App;
  let testUserId: string;
  let useCase: ListCompatibleMacrosUseCase;
  let protocolMacroRepository: ProtocolMacroRepository;

  beforeAll(async () => {
    await testApp.setup();
  });

  beforeEach(async () => {
    await testApp.beforeEach();
    testUserId = await testApp.createTestUser({});
    useCase = testApp.module.get(ListCompatibleMacrosUseCase);
    protocolMacroRepository = testApp.module.get(ProtocolMacroRepository);
  });

  afterEach(() => {
    testApp.afterEach();
  });

  afterAll(async () => {
    await testApp.teardown();
  });

  it("hides a linked private macro the caller cannot read", async () => {
    const protocol = await testApp.createProtocol({
      name: "Protocol With Mixed Macros",
      createdBy: testUserId,
    });

    const publicMacro = await testApp.createMacro({
      name: `public-macro-${faker.string.alphanumeric(6)}`,
      createdBy: testUserId,
    });

    const otherUser = await testApp.createTestUser({});
    const otherOrgId = await testApp.createOrganization();
    await testApp.addOrganizationMember(otherOrgId, otherUser, "owner");
    const privateMacro = await testApp.createMacro({
      name: `private-macro-${faker.string.alphanumeric(6)}`,
      createdBy: otherUser,
      visibility: "private",
      organizationId: otherOrgId,
    });

    // Link both directly (bypassing the read-checked add use-case) to simulate a
    // macro that later became inaccessible.
    await protocolMacroRepository.addMacros(protocol.id, [publicMacro.id, privateMacro.id]);

    const result = await useCase.execute(protocol.id, testUserId);
    assertSuccess(result);
    const ids = result.value.map((e) => e.macro.id);
    expect(ids).toContain(publicMacro.id);
    expect(ids).not.toContain(privateMacro.id);
  });

  it("should return empty list when no macros are linked", async () => {
    const protocol = await testApp.createProtocol({
      name: "Empty Protocol",
      createdBy: testUserId,
    });

    const result = await useCase.execute(protocol.id);
    expect(result.isSuccess()).toBe(true);
    assertSuccess(result);
    expect(result.value).toEqual([]);
  });

  it("should return list of compatible macros when macros are linked", async () => {
    const protocol = await testApp.createProtocol({
      name: "Protocol With Macros",
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

    // Link macros to protocol
    await protocolMacroRepository.addMacros(protocol.id, [macro1.id, macro2.id]);

    const result = await useCase.execute(protocol.id);
    expect(result.isSuccess()).toBe(true);
    assertSuccess(result);
    expect(result.value).toHaveLength(2);

    const macroIds = result.value.map((e) => e.macro.id);
    expect(macroIds).toContain(macro1.id);
    expect(macroIds).toContain(macro2.id);
  });

  it("should return NOT_FOUND when protocol does not exist", async () => {
    const nonExistentId = faker.string.uuid();
    const result = await useCase.execute(nonExistentId);
    expect(result.isSuccess()).toBe(false);
    assertFailure(result);
    expect(result.error.code).toBe("NOT_FOUND");
  });

  it("should return INTERNAL_ERROR when protocolRepository.findOne fails", async () => {
    const protocolRepo = testApp.module.get(ProtocolRepository);
    vi.spyOn(protocolRepo, "findOne").mockResolvedValueOnce(failure(AppError.internal("db error")));

    const result = await useCase.execute(faker.string.uuid());
    expect(result.isSuccess()).toBe(false);
    assertFailure(result);
    expect(result.error.code).toBe("INTERNAL_ERROR");
  });

  it("should return INTERNAL_ERROR when protocolMacroRepository.listMacros fails", async () => {
    const protocol = await testApp.createProtocol({
      name: "List Failure Protocol",
      createdBy: testUserId,
    });

    vi.spyOn(protocolMacroRepository, "listMacros").mockResolvedValueOnce(
      failure(AppError.internal("db error")),
    );

    const result = await useCase.execute(protocol.id);
    expect(result.isSuccess()).toBe(false);
    assertFailure(result);
    expect(result.error.code).toBe("INTERNAL_ERROR");
  });
});
