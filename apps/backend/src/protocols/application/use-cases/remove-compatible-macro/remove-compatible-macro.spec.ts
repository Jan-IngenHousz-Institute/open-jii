import { faker } from "@faker-js/faker";

import { macros } from "@repo/database";

import { assertFailure } from "../../../../common/utils/fp-utils";
import { TestHarness } from "../../../../test/test-harness";
import { ProtocolMacroRepository } from "../../../core/repositories/protocol-macro.repository";
import { RemoveCompatibleMacroUseCase } from "./remove-compatible-macro";

describe("RemoveCompatibleMacroUseCase", () => {
  const testApp = TestHarness.App;
  let testUserId: string;
  let useCase: RemoveCompatibleMacroUseCase;
  let protocolMacroRepository: ProtocolMacroRepository;

  beforeAll(async () => {
    await testApp.setup();
  });

  beforeEach(async () => {
    await testApp.beforeEach();
    testUserId = await testApp.createTestUser({});
    useCase = testApp.module.get(RemoveCompatibleMacroUseCase);
    protocolMacroRepository = testApp.module.get(ProtocolMacroRepository);
  });

  afterEach(() => {
    testApp.afterEach();
  });

  afterAll(async () => {
    await testApp.teardown();
  });

  it("should succeed when called by the protocol creator", async () => {
    const protocol = await testApp.createProtocol({
      name: "Remove Macro Protocol",
      createdBy: testUserId,
    });

    const [macro] = await testApp.database
      .insert(macros)
      .values({
        name: `remove-macro-${faker.string.alphanumeric(6)}`,
        filename: `macro_${faker.string.alphanumeric(8)}`,
        description: "test",
        language: "python",
        code: btoa("print('hello')"),
        createdBy: testUserId,
      })
      .returning();

    // Link the macro first
    await protocolMacroRepository.addMacros(protocol.id, [macro.id]);

    // Remove it
    const result = await useCase.execute(protocol.id, macro.id, testUserId);
    expect(result.isSuccess()).toBe(true);
  });

  it("should return FORBIDDEN when called by a non-creator", async () => {
    const protocol = await testApp.createProtocol({
      name: "Forbidden Remove Protocol",
      createdBy: testUserId,
    });

    const otherUserId = await testApp.createTestUser({ email: "other-remove@example.com" });

    const [macro] = await testApp.database
      .insert(macros)
      .values({
        name: `forbidden-remove-macro-${faker.string.alphanumeric(6)}`,
        filename: `macro_${faker.string.alphanumeric(8)}`,
        description: "test",
        language: "python",
        code: btoa("print('hello')"),
        createdBy: testUserId,
      })
      .returning();

    await protocolMacroRepository.addMacros(protocol.id, [macro.id]);

    const result = await useCase.execute(protocol.id, macro.id, otherUserId);
    expect(result.isSuccess()).toBe(false);
    assertFailure(result);
    expect(result.error.code).toBe("FORBIDDEN");
  });

  it("should return NOT_FOUND for unknown protocolId", async () => {
    const nonExistentProtocolId = faker.string.uuid();
    const fakeMacroId = faker.string.uuid();

    const result = await useCase.execute(nonExistentProtocolId, fakeMacroId, testUserId);
    expect(result.isSuccess()).toBe(false);
    assertFailure(result);
    expect(result.error.code).toBe("NOT_FOUND");
  });
});
