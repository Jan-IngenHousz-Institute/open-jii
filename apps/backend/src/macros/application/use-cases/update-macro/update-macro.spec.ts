import { DatabricksAdapter } from "../../../../common/modules/databricks/databricks.adapter";
import { assertFailure, assertSuccess, failure, success } from "../../../../common/utils/fp-utils";
import { TestHarness } from "../../../../test/test-harness";
import type { CreateMacroDto, UpdateMacroDto } from "../../../core/models/macro.model";
import { deriveFilenameFromName } from "../../../core/models/macro.model";
import { MacroRepository } from "../../../core/repositories/macro.repository";
import { UpdateMacroUseCase } from "./update-macro";

describe("UpdateMacroUseCase", () => {
  const testApp = TestHarness.App;
  let testUserId: string;
  let useCase: UpdateMacroUseCase;
  let macroRepository: MacroRepository;
  let databricksAdapter: DatabricksAdapter;

  beforeAll(async () => {
    await testApp.setup();
  });

  beforeEach(async () => {
    await testApp.beforeEach();
    testUserId = await testApp.createTestUser({});
    useCase = testApp.module.get(UpdateMacroUseCase);
    macroRepository = testApp.module.get(MacroRepository);
    databricksAdapter = testApp.module.get(DatabricksAdapter);
  });

  afterEach(() => {
    testApp.afterEach();
    vi.restoreAllMocks();
  });

  afterAll(async () => {
    await testApp.teardown();
  });

  it("should update a macro with valid data", async () => {
    // Arrange
    const macroData: CreateMacroDto = {
      name: "Original Macro",
      description: "Original description",
      language: "python",
      code: "cHl0aG9uIGNvZGU=",
    };

    // Create a macro to update
    const createResult = await macroRepository.create(macroData, testUserId);
    assertSuccess(createResult);
    const createdMacro = createResult.value[0];

    const updateData: UpdateMacroDto = {
      name: "Updated Macro",
      description: "Updated description",
      language: "r",
      code: "cmV2aXNlZCBjb2Rl",
    };

    // Mock the uploadMacroCode method since we're providing code
    vi.spyOn(databricksAdapter, "uploadMacroCode").mockResolvedValue(success({}));

    // Act
    const result = await useCase.execute(createdMacro.id, updateData, testUserId);

    // Assert
    expect(result.isSuccess()).toBe(true);
    assertSuccess(result);
    expect(result.value).toMatchObject({
      id: createdMacro.id,
      name: updateData.name,
      description: updateData.description,
      language: updateData.language,
      createdBy: testUserId,
    });

    // Verify filename was updated
    expect(result.value.filename).toBe(deriveFilenameFromName("Updated Macro"));
  });

  it("should update a macro with code file and process through Databricks", async () => {
    // Arrange
    const macroData: CreateMacroDto = {
      name: "Code Macro",
      description: "A macro with code",
      language: "python",
      code: "cHl0aG9uIGNvZGU=",
    };

    // Create a macro to update
    const createResult = await macroRepository.create(macroData, testUserId);
    assertSuccess(createResult);
    const createdMacro = createResult.value[0];

    // Mock Databricks success
    vi.spyOn(databricksAdapter, "uploadMacroCode").mockResolvedValue(success({}));

    const updateData = {
      name: "Updated Code Macro",
      code: "dXBkYXRlZCBjb2Rl", // base64 encoded "updated code"
    };

    // Act
    const result = await useCase.execute(createdMacro.id, updateData, testUserId);

    // Assert
    expect(result.isSuccess()).toBe(true);
    assertSuccess(result);
    expect(result.value.name).toBe(updateData.name);
    expect(result.value.code).toBe(updateData.code);

    // eslint-disable-next-line @typescript-eslint/unbound-method
    expect(databricksAdapter.uploadMacroCode).toHaveBeenCalledWith({
      code: updateData.code,
      filename: "updated_code_macro", // derived from updateData.name
      language: "python", // original language from created macro
    });
  });

  it("should return error when updating non-existent macro", async () => {
    // Arrange
    const nonExistentId = "00000000-0000-0000-0000-000000000000";
    const updateData = {
      name: "Updated Name",
    };

    // Act
    const result = await useCase.execute(nonExistentId, updateData, testUserId);

    // Assert
    expect(result.isSuccess()).toBe(false);
    assertFailure(result);
  });

  it("should return error when Databricks processing fails", async () => {
    // Arrange
    const macroData: CreateMacroDto = {
      name: "Databricks Fail Macro",
      description: "This will fail in Databricks",
      language: "python",
      code: "cHl0aG9uIGNvZGU=",
    };

    // Create a macro to update
    const createResult = await macroRepository.create(macroData, testUserId);
    assertSuccess(createResult);
    const createdMacro = createResult.value[0];

    // Mock Databricks failure
    vi.spyOn(databricksAdapter, "uploadMacroCode").mockResolvedValue(
      failure({
        message: "Databricks update failed",
        code: "DATABRICKS_ERROR",
        statusCode: 500,
        name: "",
      }),
    );

    const updateData = {
      name: "Updated Macro",
      code: "ZmFpbGVkIGNvZGU=", // base64 encoded "failed code"
    };

    // Act
    const result = await useCase.execute(createdMacro.id, updateData, testUserId);

    // Assert
    expect(result.isSuccess()).toBe(false);
    assertFailure(result);
    expect(result.error.message).toBe("Databricks update failed");
  });

  it("should update macro without code file successfully", async () => {
    // Arrange
    const macroData: CreateMacroDto = {
      name: "Simple Macro",
      description: "Simple description",
      language: "javascript",
      code: "amF2YXNjcmlwdCBjb2Rl",
    };

    // Create a macro to update
    const createResult = await macroRepository.create(macroData, testUserId);
    assertSuccess(createResult);
    const createdMacro = createResult.value[0];

    const updateData = {
      name: "Simply Updated Macro",
      description: "Simply updated description",
    };

    // Mock the uploadMacroCode method
    const uploadMacroCodeSpy = vi.spyOn(databricksAdapter, "uploadMacroCode");

    // Act
    const result = await useCase.execute(createdMacro.id, updateData, testUserId);

    // Assert
    expect(result.isSuccess()).toBe(true);
    assertSuccess(result);
    expect(result.value).toMatchObject({
      id: createdMacro.id,
      name: updateData.name,
      description: updateData.description,
      language: macroData.language, // Should remain unchanged
      createdBy: testUserId,
    });

    // Databricks should not be called when no code file provided
    expect(uploadMacroCodeSpy).not.toHaveBeenCalled();
  });

  it("should handle partial updates", async () => {
    // Arrange
    const macroData: CreateMacroDto = {
      name: "Partial Update Macro",
      description: "Original description",
      language: "python",
      code: "cHl0aG9uIGNvZGU=",
    };

    // Create a macro to update
    const createResult = await macroRepository.create(macroData, testUserId);
    assertSuccess(createResult);
    const createdMacro = createResult.value[0];

    const updateData = {
      description: "Only description updated",
      // name and language not provided - should remain unchanged
    };

    // Act
    const result = await useCase.execute(createdMacro.id, updateData, testUserId);

    // Assert
    expect(result.isSuccess()).toBe(true);
    assertSuccess(result);
    expect(result.value).toMatchObject({
      id: createdMacro.id,
      name: macroData.name,
      description: updateData.description,
      language: macroData.language,
      createdBy: testUserId,
    });
  });

  it("should return forbidden error when user is not the creator", async () => {
    // Arrange
    const macroData: CreateMacroDto = {
      name: "Someone Else's Macro",
      description: "Created by another user",
      language: "python",
      code: "cHl0aG9uIGNvZGU=",
    };

    // Create a macro with testUserId
    const createResult = await macroRepository.create(macroData, testUserId);
    assertSuccess(createResult);
    const createdMacro = createResult.value[0];

    // Create another user
    const anotherUserId = await testApp.createTestUser({ email: "another@example.com" });

    const updateData = {
      name: "Trying to Update",
      description: "This should fail",
    };

    // Act - try to update with a different user
    const result = await useCase.execute(createdMacro.id, updateData, anotherUserId);

    // Assert
    expect(result.isSuccess()).toBe(false);
    assertFailure(result);
    expect(result.error.statusCode).toBe(403);
    expect(result.error.message).toBe("Only the macro creator can update this macro");
  });
});
