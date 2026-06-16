import { assertFailure, assertSuccess } from "../../../../common/utils/fp-utils";
import type { CreateMacroDto } from "../../../../macros/core/models/macro.model";
import { TestHarness } from "../../../../test/test-harness";
import { MacroRepository } from "../../../core/repositories/macro.repository";
import { GetMacroUseCase } from "./get-macro";

describe("GetMacroUseCase", () => {
  const testApp = TestHarness.App;
  let testUserId: string;
  let useCase: GetMacroUseCase;
  let macroRepository: MacroRepository;

  beforeAll(async () => {
    await testApp.setup();
  });

  beforeEach(async () => {
    await testApp.beforeEach();
    testUserId = await testApp.createTestUser({});
    useCase = testApp.module.get(GetMacroUseCase);
    macroRepository = testApp.module.get(MacroRepository);
  });

  afterEach(() => {
    testApp.afterEach();
  });

  afterAll(async () => {
    await testApp.teardown();
  });

  it("should get a macro by id", async () => {
    // Arrange
    const macroData: CreateMacroDto = {
      name: "Test Macro",
      description: "A test macro description",
      language: "python",
      code: "cHl0aG9uIGNvZGU=",
    };

    // Create a macro to retrieve
    const createResult = await macroRepository.create(macroData, testUserId);
    assertSuccess(createResult);
    const createdMacro = createResult.value[0];

    // Act
    const result = await useCase.execute(createdMacro.id);

    // Assert
    expect(result.isSuccess()).toBe(true);
    assertSuccess(result);
    expect(result.value).toMatchObject({
      id: createdMacro.id,
      name: macroData.name,
      filename: createdMacro.filename,
      description: macroData.description,
      language: macroData.language,
      createdBy: testUserId,
    });
  });

  it("should return not found error for non-existent macro", async () => {
    // Arrange
    const nonExistentId = "00000000-0000-0000-0000-000000000000";

    // Act
    const result = await useCase.execute(nonExistentId);

    // Assert
    expect(result.isSuccess()).toBe(false);
    assertFailure(result);
    expect(result.error).toMatchObject({
      code: "NOT_FOUND",
      message: "Macro not found",
      statusCode: 404,
    });
  });

  it("should return error for invalid UUID format", async () => {
    // Arrange
    const invalidId = "invalid-uuid";

    // Act
    const result = await useCase.execute(invalidId);

    // Assert
    expect(result.isSuccess()).toBe(false);
    assertFailure(result);
  });

  it("returns a pinned version's code when a non-latest version is requested", async () => {
    const created = await macroRepository.create(
      { name: "Versioned Macro", language: "python", code: "djE=" },
      testUserId,
    );
    assertSuccess(created);
    const macroId = created.value[0].id;
    const minted = await macroRepository.mintVersion(macroId, {
      code: "djI=",
      language: "python",
      createdBy: testUserId,
    });
    assertSuccess(minted);

    const result = await useCase.execute(macroId, 1);
    assertSuccess(result);
    expect(result.value.code).toBe("djE=");
  });

  it("returns not found when a pinned macro version does not exist", async () => {
    const created = await macroRepository.create(
      { name: "Versioned Macro 2", language: "python", code: "djE=" },
      testUserId,
    );
    assertSuccess(created);

    const result = await useCase.execute(created.value[0].id, 99);
    assertFailure(result);
    expect(result.error.statusCode).toBe(404);
  });
});
