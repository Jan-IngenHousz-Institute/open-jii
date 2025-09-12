import { assertFailure, assertSuccess } from "../../../../common/utils/fp-utils";
import { TestHarness } from "../../../../test/test-harness";
import { DatabricksPort } from "../../../core/ports/databricks.port";
import { MacroRepository } from "../../../core/repositories/macro.repository";
import { UpdateMacroUseCase } from "./update-macro";

describe("UpdateMacroUseCase", () => {
  const testApp = TestHarness.App;
  let testUserId: string;
  let useCase: UpdateMacroUseCase;
  let macroRepository: MacroRepository;
  let databricksPort: DatabricksPort;

  beforeAll(async () => {
    await testApp.setup();
  });

  beforeEach(async () => {
    await testApp.beforeEach();
    testUserId = await testApp.createTestUser({});
    useCase = testApp.module.get(UpdateMacroUseCase);
    macroRepository = testApp.module.get(MacroRepository);
    databricksPort = testApp.module.get(DatabricksPort);
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
    const macroData = {
      name: "Original Macro",
      description: "Original description",
      language: "python" as const,
    };

    // Create a macro to update
    const createResult = await macroRepository.create(macroData, testUserId);
    assertSuccess(createResult);
    const createdMacro = createResult.value[0];

    const updateData = {
      name: "Updated Macro",
      description: "Updated description",
      language: "r" as const,
    };

    // Act
    const result = await useCase.execute(createdMacro.id, updateData);

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
  });

  it("should update a macro with code file and process through Databricks", async () => {
    // Arrange
    const macroData = {
      name: "Code Macro",
      description: "A macro with code",
      language: "python" as const,
    };

    // Create a macro to update
    const createResult = await macroRepository.create(macroData, testUserId);
    assertSuccess(createResult);
    const createdMacro = createResult.value[0];

    // Mock Databricks success
    vi.spyOn(databricksPort, "updateMacroCode").mockResolvedValue({
      success: true,
      message: "Code updated successfully",
      databricksJobId: "job-456",
    });

    const updateData = {
      name: "Updated Code Macro",
      codeFile: "dXBkYXRlZCBjb2Rl", // base64 encoded "updated code"
    };

    // Act
    const result = await useCase.execute(createdMacro.id, updateData);

    // Assert
    expect(result.isSuccess()).toBe(true);
    assertSuccess(result);
    expect(result.value.name).toBe(updateData.name);
    expect(result.value.codeFile).toBe(updateData.codeFile);

    // eslint-disable-next-line @typescript-eslint/unbound-method
    expect(databricksPort.updateMacroCode).toHaveBeenCalledWith({
      content: updateData.codeFile,
      language: macroData.language,
      macroId: createdMacro.id,
    });
  });

  it("should return error when updating non-existent macro", async () => {
    // Arrange
    const nonExistentId = "00000000-0000-0000-0000-000000000000";
    const updateData = {
      name: "Updated Name",
    };

    // Act
    const result = await useCase.execute(nonExistentId, updateData);

    // Assert
    expect(result.isSuccess()).toBe(false);
    assertFailure(result);
  });

  it("should return error when Databricks processing fails", async () => {
    // Arrange
    const macroData = {
      name: "Databricks Fail Macro",
      description: "This will fail in Databricks",
      language: "python" as const,
    };

    // Create a macro to update
    const createResult = await macroRepository.create(macroData, testUserId);
    assertSuccess(createResult);
    const createdMacro = createResult.value[0];

    // Mock Databricks failure
    vi.spyOn(databricksPort, "updateMacroCode").mockResolvedValue({
      success: false,
      message: "Databricks update failed",
    });

    const updateData = {
      name: "Updated Macro",
      codeFile: "ZmFpbGVkIGNvZGU=", // base64 encoded "failed code"
    };

    // Act
    const result = await useCase.execute(createdMacro.id, updateData);

    // Assert
    expect(result.isSuccess()).toBe(false);
    assertFailure(result);
    expect(result.error.message).toBe("Databricks update failed");
  });

  it("should update macro without code file successfully", async () => {
    // Arrange
    const macroData = {
      name: "Simple Macro",
      description: "Simple description",
      language: "javascript" as const,
    };

    // Create a macro to update
    const createResult = await macroRepository.create(macroData, testUserId);
    assertSuccess(createResult);
    const createdMacro = createResult.value[0];

    const updateData = {
      name: "Simply Updated Macro",
      description: "Simply updated description",
    };

    // Mock the updateMacroCode method
    const updateMacroCodeSpy = vi.spyOn(databricksPort, "updateMacroCode");

    // Act
    const result = await useCase.execute(createdMacro.id, updateData);

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
    expect(updateMacroCodeSpy).not.toHaveBeenCalled();
  });

  it("should handle partial updates", async () => {
    // Arrange
    const macroData = {
      name: "Partial Update Macro",
      description: "Original description",
      language: "python" as const,
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
    const result = await useCase.execute(createdMacro.id, updateData);

    // Assert
    expect(result.isSuccess()).toBe(true);
    assertSuccess(result);
    expect(result.value).toMatchObject({
      id: createdMacro.id,
      name: macroData.name, // Should remain unchanged
      description: updateData.description, // Should be updated
      language: macroData.language, // Should remain unchanged
      createdBy: testUserId,
    });
  });
});
