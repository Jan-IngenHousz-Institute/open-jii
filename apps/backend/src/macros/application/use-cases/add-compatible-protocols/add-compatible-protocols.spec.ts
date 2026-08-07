import { faker } from "@faker-js/faker";

import { assertFailure, assertSuccess, failure, AppError } from "../../../../common/utils/fp-utils";
import { TestHarness } from "../../../../test/test-harness";
import { MacroProtocolRepository } from "../../../core/repositories/macro-protocol.repository";
import { MacroRepository } from "../../../core/repositories/macro.repository";
import { AddCompatibleProtocolsUseCase } from "./add-compatible-protocols";

describe("AddCompatibleProtocolsUseCase", () => {
  const testApp = TestHarness.App;
  let testUserId: string;
  let useCase: AddCompatibleProtocolsUseCase;

  beforeAll(async () => {
    await testApp.setup();
  });

  beforeEach(async () => {
    await testApp.beforeEach();
    testUserId = await testApp.createTestUser({});
    useCase = testApp.module.get(AddCompatibleProtocolsUseCase);
  });

  afterEach(() => {
    testApp.afterEach();
  });

  afterAll(async () => {
    await testApp.teardown();
  });

  it("should succeed when called by the macro creator", async () => {
    const macro = await testApp.createMacro({
      name: "Add Protocols Macro",
      createdBy: testUserId,
    });

    const protocol1 = await testApp.createProtocol({
      name: `add-protocol-1-${faker.string.alphanumeric(6)}`,
      createdBy: testUserId,
    });

    const protocol2 = await testApp.createProtocol({
      name: `add-protocol-2-${faker.string.alphanumeric(6)}`,
      createdBy: testUserId,
    });

    const result = await useCase.execute(macro.id, [protocol1.id, protocol2.id], testUserId);
    expect(result.isSuccess()).toBe(true);
    assertSuccess(result);
    expect(result.value).toHaveLength(2);

    const protocolIds = result.value.map((e) => e.protocol.id);
    expect(protocolIds).toContain(protocol1.id);
    expect(protocolIds).toContain(protocol2.id);
  });

  it("should return NOT_FOUND for unknown macroId", async () => {
    const nonExistentMacroId = faker.string.uuid();

    const protocol = await testApp.createProtocol({
      name: `notfound-protocol-${faker.string.alphanumeric(6)}`,
      createdBy: testUserId,
    });

    const result = await useCase.execute(nonExistentMacroId, [protocol.id], testUserId);
    expect(result.isSuccess()).toBe(false);
    assertFailure(result);
    expect(result.error.code).toBe("NOT_FOUND");
  });

  it("should return NOT_FOUND for unknown protocolId", async () => {
    const macro = await testApp.createMacro({
      name: "Unknown Protocol Macro",
      createdBy: testUserId,
    });

    const nonExistentProtocolId = faker.string.uuid();

    const result = await useCase.execute(macro.id, [nonExistentProtocolId], testUserId);
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

  it("should return FORBIDDEN when the caller cannot read a linked protocol", async () => {
    // Link targets are validated by read access, not mere existence: an editor
    // of a public macro must not be able to link (and thereby expose) a private
    // protocol they cannot access.
    const macro = await testApp.createMacro({
      name: "No Access Macro",
      createdBy: testUserId,
    });

    const otherUser = await testApp.createTestUser({});
    const otherOrgId = await testApp.createOrganization();
    await testApp.addOrganizationMember(otherOrgId, otherUser, "owner");
    const privateProtocol = await testApp.createProtocol({
      name: `private-protocol-${faker.string.alphanumeric(6)}`,
      createdBy: otherUser,
      visibility: "private",
      organizationId: otherOrgId,
    });

    const result = await useCase.execute(macro.id, [privateProtocol.id], testUserId);
    expect(result.isSuccess()).toBe(false);
    assertFailure(result);
    expect(result.error.code).toBe("FORBIDDEN");
  });

  it("should return INTERNAL_ERROR when macroProtocolRepository.addProtocols fails", async () => {
    const macro = await testApp.createMacro({
      name: "Add Failure Macro",
      createdBy: testUserId,
    });

    const protocol = await testApp.createProtocol({
      name: `add-fail-protocol-${faker.string.alphanumeric(6)}`,
      createdBy: testUserId,
    });

    const macroProtocolRepo = testApp.module.get(MacroProtocolRepository);
    vi.spyOn(macroProtocolRepo, "addProtocols").mockResolvedValueOnce(
      failure(AppError.internal("db error")),
    );

    const result = await useCase.execute(macro.id, [protocol.id], testUserId);
    expect(result.isSuccess()).toBe(false);
    assertFailure(result);
    expect(result.error.code).toBe("INTERNAL_ERROR");
  });
});
