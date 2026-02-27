import { faker } from "@faker-js/faker";

import { macros } from "@repo/database";

import { assertFailure, assertSuccess } from "../../../../common/utils/fp-utils";
import { TestHarness } from "../../../../test/test-harness";
import { ProtocolMacroRepository } from "../../../core/repositories/protocol-macro.repository";
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
});
