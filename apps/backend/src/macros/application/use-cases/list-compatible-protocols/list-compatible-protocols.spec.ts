import { faker } from "@faker-js/faker";

import { assertFailure, assertSuccess, failure, AppError } from "../../../../common/utils/fp-utils";
import { TestHarness } from "../../../../test/test-harness";
import { MacroProtocolRepository } from "../../../core/repositories/macro-protocol.repository";
import { MacroRepository } from "../../../core/repositories/macro.repository";
import { ListCompatibleProtocolsUseCase } from "./list-compatible-protocols";

describe("ListCompatibleProtocolsUseCase", () => {
  const testApp = TestHarness.App;
  let testUserId: string;
  let useCase: ListCompatibleProtocolsUseCase;
  let macroProtocolRepository: MacroProtocolRepository;

  beforeAll(async () => {
    await testApp.setup();
  });

  beforeEach(async () => {
    await testApp.beforeEach();
    testUserId = await testApp.createTestUser({});
    useCase = testApp.module.get(ListCompatibleProtocolsUseCase);
    macroProtocolRepository = testApp.module.get(MacroProtocolRepository);
  });

  afterEach(() => {
    testApp.afterEach();
  });

  afterAll(async () => {
    await testApp.teardown();
  });

  it("should return empty list when no protocols are linked", async () => {
    const macro = await testApp.createMacro({
      name: "Empty Macro",
      createdBy: testUserId,
    });

    const result = await useCase.execute(macro.id);
    expect(result.isSuccess()).toBe(true);
    assertSuccess(result);
    expect(result.value).toEqual([]);
  });

  it("should return list of compatible protocols when protocols are linked", async () => {
    const macro = await testApp.createMacro({
      name: "Macro With Protocols",
      createdBy: testUserId,
    });

    const protocol1 = await testApp.createProtocol({
      name: `list-protocol-1-${faker.string.alphanumeric(6)}`,
      createdBy: testUserId,
    });

    const protocol2 = await testApp.createProtocol({
      name: `list-protocol-2-${faker.string.alphanumeric(6)}`,
      createdBy: testUserId,
    });

    // Link protocols to macro
    await macroProtocolRepository.addProtocols(macro.id, [protocol1.id, protocol2.id]);

    const result = await useCase.execute(macro.id);
    expect(result.isSuccess()).toBe(true);
    assertSuccess(result);
    expect(result.value).toHaveLength(2);

    const protocolIds = result.value.map((e) => e.protocol.id);
    expect(protocolIds).toContain(protocol1.id);
    expect(protocolIds).toContain(protocol2.id);
  });

  it("should return NOT_FOUND when macro does not exist", async () => {
    const nonExistentId = faker.string.uuid();
    const result = await useCase.execute(nonExistentId);
    expect(result.isSuccess()).toBe(false);
    assertFailure(result);
    expect(result.error.code).toBe("NOT_FOUND");
  });

  it("should return INTERNAL_ERROR when macroRepository.findById fails", async () => {
    const macroRepo = testApp.module.get(MacroRepository);
    vi.spyOn(macroRepo, "findById").mockResolvedValueOnce(failure(AppError.internal("db error")));

    const result = await useCase.execute(faker.string.uuid());
    expect(result.isSuccess()).toBe(false);
    assertFailure(result);
    expect(result.error.code).toBe("INTERNAL_ERROR");
  });

  it("should return INTERNAL_ERROR when macroProtocolRepository.listProtocols fails", async () => {
    const macro = await testApp.createMacro({
      name: "List Failure Macro",
      createdBy: testUserId,
    });

    vi.spyOn(macroProtocolRepository, "listProtocols").mockResolvedValueOnce(
      failure(AppError.internal("db error")),
    );

    const result = await useCase.execute(macro.id);
    expect(result.isSuccess()).toBe(false);
    assertFailure(result);
    expect(result.error.code).toBe("INTERNAL_ERROR");
  });
});
