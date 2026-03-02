import { faker } from "@faker-js/faker";

import { assertFailure, failure, AppError } from "../../../../common/utils/fp-utils";
import { TestHarness } from "../../../../test/test-harness";
import { MacroProtocolRepository } from "../../../core/repositories/macro-protocol.repository";
import { MacroRepository } from "../../../core/repositories/macro.repository";
import { RemoveCompatibleProtocolUseCase } from "./remove-compatible-protocol";

describe("RemoveCompatibleProtocolUseCase", () => {
  const testApp = TestHarness.App;
  let testUserId: string;
  let useCase: RemoveCompatibleProtocolUseCase;
  let macroProtocolRepository: MacroProtocolRepository;

  beforeAll(async () => {
    await testApp.setup();
  });

  beforeEach(async () => {
    await testApp.beforeEach();
    testUserId = await testApp.createTestUser({});
    useCase = testApp.module.get(RemoveCompatibleProtocolUseCase);
    macroProtocolRepository = testApp.module.get(MacroProtocolRepository);
  });

  afterEach(() => {
    testApp.afterEach();
  });

  afterAll(async () => {
    await testApp.teardown();
  });

  it("should succeed when called by the macro creator", async () => {
    const macro = await testApp.createMacro({
      name: "Remove Protocol Macro",
      createdBy: testUserId,
    });

    const protocol = await testApp.createProtocol({
      name: `remove-protocol-${faker.string.alphanumeric(6)}`,
      createdBy: testUserId,
    });

    // Link the protocol first
    await macroProtocolRepository.addProtocols(macro.id, [protocol.id]);

    // Remove it
    const result = await useCase.execute(macro.id, protocol.id, testUserId);
    expect(result.isSuccess()).toBe(true);
  });

  it("should return FORBIDDEN when called by a non-creator", async () => {
    const macro = await testApp.createMacro({
      name: "Forbidden Remove Macro",
      createdBy: testUserId,
    });

    const otherUserId = await testApp.createTestUser({ email: "other-remove@example.com" });

    const protocol = await testApp.createProtocol({
      name: `forbidden-remove-protocol-${faker.string.alphanumeric(6)}`,
      createdBy: testUserId,
    });

    await macroProtocolRepository.addProtocols(macro.id, [protocol.id]);

    const result = await useCase.execute(macro.id, protocol.id, otherUserId);
    expect(result.isSuccess()).toBe(false);
    assertFailure(result);
    expect(result.error.code).toBe("FORBIDDEN");
  });

  it("should return NOT_FOUND for unknown macroId", async () => {
    const nonExistentMacroId = faker.string.uuid();
    const fakeProtocolId = faker.string.uuid();

    const result = await useCase.execute(nonExistentMacroId, fakeProtocolId, testUserId);
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

  it("should return INTERNAL_ERROR when macroProtocolRepository.removeProtocol fails", async () => {
    const macro = await testApp.createMacro({
      name: "Remove Failure Macro",
      createdBy: testUserId,
    });

    const protocol = await testApp.createProtocol({
      name: `remove-fail-protocol-${faker.string.alphanumeric(6)}`,
      createdBy: testUserId,
    });

    await macroProtocolRepository.addProtocols(macro.id, [protocol.id]);

    vi.spyOn(macroProtocolRepository, "removeProtocol").mockResolvedValueOnce(
      failure(AppError.internal("db error")),
    );

    const result = await useCase.execute(macro.id, protocol.id, testUserId);
    expect(result.isSuccess()).toBe(false);
    assertFailure(result);
    expect(result.error.code).toBe("INTERNAL_ERROR");
  });
});
