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
    vi.restoreAllMocks();
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
});
