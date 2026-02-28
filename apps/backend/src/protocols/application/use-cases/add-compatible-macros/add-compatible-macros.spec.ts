import { faker } from "@faker-js/faker";

import { macros } from "@repo/database";

import { assertFailure, assertSuccess } from "../../../../common/utils/fp-utils";
import { TestHarness } from "../../../../test/test-harness";
import { AddCompatibleMacrosUseCase } from "./add-compatible-macros";

describe("AddCompatibleMacrosUseCase", () => {
  const testApp = TestHarness.App;
  let testUserId: string;
  let useCase: AddCompatibleMacrosUseCase;

  beforeAll(async () => {
    await testApp.setup();
  });

  beforeEach(async () => {
    await testApp.beforeEach();
    testUserId = await testApp.createTestUser({});
    useCase = testApp.module.get(AddCompatibleMacrosUseCase);
  });

  afterEach(() => {
    testApp.afterEach();
  });

  afterAll(async () => {
    await testApp.teardown();
  });

  it("should succeed when called by the protocol creator", async () => {
    const protocol = await testApp.createProtocol({
      name: "Add Macros Protocol",
      createdBy: testUserId,
    });

    const [macro1] = await testApp.database
      .insert(macros)
      .values({
        name: `add-macro-1-${faker.string.alphanumeric(6)}`,
        filename: `macro_${faker.string.alphanumeric(8)}`,
        description: "test",
        language: "python",
        code: btoa("print('hello')"),
        createdBy: testUserId,
      })
      .returning();

    const [macro2] = await testApp.database
      .insert(macros)
      .values({
        name: `add-macro-2-${faker.string.alphanumeric(6)}`,
        filename: `macro_${faker.string.alphanumeric(8)}`,
        description: "test",
        language: "python",
        code: btoa("print('world')"),
        createdBy: testUserId,
      })
      .returning();

    const result = await useCase.execute(protocol.id, [macro1.id, macro2.id], testUserId);
    expect(result.isSuccess()).toBe(true);
    assertSuccess(result);
    expect(result.value).toHaveLength(2);

    const macroIds = result.value.map((e) => e.macro.id);
    expect(macroIds).toContain(macro1.id);
    expect(macroIds).toContain(macro2.id);
  });

  it("should return FORBIDDEN when called by a non-creator", async () => {
    const protocol = await testApp.createProtocol({
      name: "Forbidden Macros Protocol",
      createdBy: testUserId,
    });

    const otherUserId = await testApp.createTestUser({ email: "other@example.com" });

    const [macro] = await testApp.database
      .insert(macros)
      .values({
        name: `forbidden-macro-${faker.string.alphanumeric(6)}`,
        filename: `macro_${faker.string.alphanumeric(8)}`,
        description: "test",
        language: "python",
        code: btoa("print('hello')"),
        createdBy: testUserId,
      })
      .returning();

    const result = await useCase.execute(protocol.id, [macro.id], otherUserId);
    expect(result.isSuccess()).toBe(false);
    assertFailure(result);
    expect(result.error.code).toBe("FORBIDDEN");
  });

  it("should return NOT_FOUND for unknown protocolId", async () => {
    const nonExistentProtocolId = faker.string.uuid();

    const [macro] = await testApp.database
      .insert(macros)
      .values({
        name: `notfound-macro-${faker.string.alphanumeric(6)}`,
        filename: `macro_${faker.string.alphanumeric(8)}`,
        description: "test",
        language: "python",
        code: btoa("print('hello')"),
        createdBy: testUserId,
      })
      .returning();

    const result = await useCase.execute(nonExistentProtocolId, [macro.id], testUserId);
    expect(result.isSuccess()).toBe(false);
    assertFailure(result);
    expect(result.error.code).toBe("NOT_FOUND");
  });

  it("should return NOT_FOUND for unknown macroId", async () => {
    const protocol = await testApp.createProtocol({
      name: "Unknown Macro Protocol",
      createdBy: testUserId,
    });

    const nonExistentMacroId = faker.string.uuid();

    const result = await useCase.execute(protocol.id, [nonExistentMacroId], testUserId);
    expect(result.isSuccess()).toBe(false);
    assertFailure(result);
    expect(result.error.code).toBe("NOT_FOUND");
  });
});
