import { DatabricksAdapter } from "../../../../common/modules/databricks/databricks.adapter";
import { assertFailure, assertSuccess, failure, success } from "../../../../common/utils/fp-utils";
import { TestHarness } from "../../../../test/test-harness";
import type { CreateMacroDto, UpdateMacroDto } from "../../../core/models/macro.model";
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

  it("should create a new version with incremented version number", async () => {
    // Arrange
    const macroData: CreateMacroDto = {
      name: "Original Macro",
      description: "Original description",
      language: "python",
      code: "cHl0aG9uIGNvZGU=",
    };

    const createResult = await macroRepository.create(macroData, testUserId);
    assertSuccess(createResult);
    const createdMacro = createResult.value[0];
    expect(createdMacro.version).toBe(1);

    const updateData: UpdateMacroDto = {
      name: "Updated Macro",
      description: "Updated description",
      language: "r",
      code: "cmV2aXNlZCBjb2Rl",
    };

    vi.spyOn(databricksAdapter, "uploadMacroCode").mockResolvedValue(success({}));

    // Act
    const result = await useCase.execute(createdMacro.id, updateData, testUserId);

    // Assert
    expect(result.isSuccess()).toBe(true);
    assertSuccess(result);

    // Same UUID across versions, version incremented
    expect(result.value.id).toBe(createdMacro.id);
    expect(result.value.version).toBe(2);
    expect(result.value.name).toBe(updateData.name);
    expect(result.value.description).toBe(updateData.description);
    expect(result.value.language).toBe(updateData.language);
    expect(result.value.createdBy).toBe(testUserId);

    // New version should have a different filename (derived from new UUID)
    expect(result.value.filename).not.toBe(createdMacro.filename);
  });

  it("should preserve old version unchanged in database", async () => {
    // Arrange
    const macroData: CreateMacroDto = {
      name: "Immutable Macro",
      description: "Should not change",
      language: "python",
      code: "b3JpZ2luYWw=",
    };

    const createResult = await macroRepository.create(macroData, testUserId);
    assertSuccess(createResult);
    const v1 = createResult.value[0];

    vi.spyOn(databricksAdapter, "uploadMacroCode").mockResolvedValue(success({}));

    // Act
    const result = await useCase.execute(v1.id, { description: "New description" }, testUserId);
    assertSuccess(result);
    const v2 = result.value;

    // Assert - old version is unchanged (fetch specific version 1)
    const oldResult = await macroRepository.findById(v1.id, 1);
    assertSuccess(oldResult);
    expect(oldResult.value).not.toBeNull();
    expect(oldResult.value!.version).toBe(1);
    expect(oldResult.value!.description).toBe("Should not change");

    // New version has updated data
    expect(v2.version).toBe(2);
    expect(v2.description).toBe("New description");
    expect(v2.name).toBe(macroData.name); // name carried forward
  });

  it("should upload new code to Databricks with new filename", async () => {
    // Arrange
    const macroData: CreateMacroDto = {
      name: "Databricks Macro",
      description: "Test Databricks upload",
      language: "python",
      code: "cHl0aG9uIGNvZGU=",
    };

    const createResult = await macroRepository.create(macroData, testUserId);
    assertSuccess(createResult);
    const createdMacro = createResult.value[0];

    vi.spyOn(databricksAdapter, "uploadMacroCode").mockResolvedValue(success({}));

    const updateData = {
      code: "dXBkYXRlZCBjb2Rl",
    };

    // Act
    const result = await useCase.execute(createdMacro.id, updateData, testUserId);
    assertSuccess(result);

    // Assert - Databricks called with NEW filename (not old one)
    // eslint-disable-next-line @typescript-eslint/unbound-method
    expect(databricksAdapter.uploadMacroCode).toHaveBeenCalledWith({
      code: updateData.code,
      filename: result.value.filename,
      language: "python",
    });
    expect(result.value.filename).not.toBe(createdMacro.filename);
  });

  it("should return error when updating non-existent macro", async () => {
    const nonExistentId = "00000000-0000-0000-0000-000000000000";
    const result = await useCase.execute(nonExistentId, { name: "Updated" }, testUserId);

    expect(result.isSuccess()).toBe(false);
    assertFailure(result);
    expect(result.error.statusCode).toBe(404);
  });

  it("should clean up new version when Databricks upload fails", async () => {
    // Arrange
    const macroData: CreateMacroDto = {
      name: "Databricks Fail Macro",
      description: "This will fail in Databricks",
      language: "python",
      code: "cHl0aG9uIGNvZGU=",
    };

    const createResult = await macroRepository.create(macroData, testUserId);
    assertSuccess(createResult);
    const createdMacro = createResult.value[0];

    vi.spyOn(databricksAdapter, "uploadMacroCode").mockResolvedValue(
      failure({
        message: "Databricks update failed",
        code: "DATABRICKS_ERROR",
        statusCode: 500,
        name: "",
      }),
    );

    // Act
    const result = await useCase.execute(createdMacro.id, { code: "ZmFpbGVkIGNvZGU=" }, testUserId);

    // Assert - should fail
    expect(result.isSuccess()).toBe(false);
    assertFailure(result);
    expect(result.error.message).toBe("Databricks update failed");

    // The failed new version should be cleaned up (only v1 remains)
    const versionsResult = await macroRepository.findVersionsById(createdMacro.id);
    assertSuccess(versionsResult);
    expect(versionsResult.value).toHaveLength(1);
    expect(versionsResult.value[0].version).toBe(1);
  });

  it("should carry forward unchanged fields in partial update", async () => {
    // Arrange
    const macroData: CreateMacroDto = {
      name: "Partial Update Macro",
      description: "Original description",
      language: "python",
      code: "cHl0aG9uIGNvZGU=",
    };

    const createResult = await macroRepository.create(macroData, testUserId);
    assertSuccess(createResult);
    const createdMacro = createResult.value[0];

    vi.spyOn(databricksAdapter, "uploadMacroCode").mockResolvedValue(success({}));

    // Act - only update description
    const result = await useCase.execute(
      createdMacro.id,
      { description: "Only description updated" },
      testUserId,
    );

    // Assert
    assertSuccess(result);
    expect(result.value.version).toBe(2);
    expect(result.value.name).toBe(macroData.name); // carried forward
    expect(result.value.description).toBe("Only description updated");
    expect(result.value.language).toBe(macroData.language); // carried forward
    expect(result.value.code).toBe(macroData.code); // carried forward
  });

  it("should return forbidden error when user is not the creator", async () => {
    // Arrange
    const macroData: CreateMacroDto = {
      name: "Someone Else's Macro",
      description: "Created by another user",
      language: "python",
      code: "cHl0aG9uIGNvZGU=",
    };

    const createResult = await macroRepository.create(macroData, testUserId);
    assertSuccess(createResult);
    const createdMacro = createResult.value[0];

    const anotherUserId = await testApp.createTestUser({ email: "another@example.com" });

    // Act
    const result = await useCase.execute(
      createdMacro.id,
      { name: "Trying to Update" },
      anotherUserId,
    );

    // Assert
    expect(result.isSuccess()).toBe(false);
    assertFailure(result);
    expect(result.error.statusCode).toBe(403);
    expect(result.error.message).toBe("Only the macro creator can update this macro");
  });

  it("should increment version correctly with multiple updates", async () => {
    // Arrange
    const macroData: CreateMacroDto = {
      name: "Multi Version Macro",
      description: "v1",
      language: "python",
      code: "cHl0aG9uIGNvZGU=",
    };

    const createResult = await macroRepository.create(macroData, testUserId);
    assertSuccess(createResult);
    const v1 = createResult.value[0];

    vi.spyOn(databricksAdapter, "uploadMacroCode").mockResolvedValue(success({}));

    // Act - create v2
    const v2Result = await useCase.execute(v1.id, { description: "v2" }, testUserId);
    assertSuccess(v2Result);
    expect(v2Result.value.version).toBe(2);

    // Act - create v3 from v2 (same UUID, so use v1.id)
    const v3Result = await useCase.execute(v1.id, { description: "v3" }, testUserId);
    assertSuccess(v3Result);
    expect(v3Result.value.version).toBe(3);

    // Assert - all 3 versions exist
    const versionsResult = await macroRepository.findVersionsById(v1.id);
    assertSuccess(versionsResult);
    expect(versionsResult.value).toHaveLength(3);
    expect(versionsResult.value.map((v) => v.version)).toEqual([3, 2, 1]); // DESC order
  });

  it("should return failure when findMaxVersion fails", async () => {
    // Arrange
    const createResult = await macroRepository.create(
      { name: "DB Error Macro", language: "python", code: "cHl0aG9uIGNvZGU=" },
      testUserId,
    );
    assertSuccess(createResult);
    const macro = createResult.value[0];

    vi.spyOn(macroRepository, "findMaxVersion").mockResolvedValue(
      failure({ message: "Database error", code: "INTERNAL", statusCode: 500, name: "" }),
    );

    // Act
    const result = await useCase.execute(macro.id, { description: "fail" }, testUserId);

    // Assert
    expect(result.isSuccess()).toBe(false);
    assertFailure(result);
    expect(result.error.message).toBe("Database error");
  });

  it("should return failure when creating new version row fails", async () => {
    // Arrange
    const createResult = await macroRepository.create(
      { name: "Create Fail Macro", language: "python", code: "cHl0aG9uIGNvZGU=" },
      testUserId,
    );
    assertSuccess(createResult);
    const macro = createResult.value[0];

    vi.spyOn(macroRepository, "create").mockResolvedValue(
      failure({
        message: "Unique constraint violation",
        code: "INTERNAL",
        statusCode: 500,
        name: "",
      }),
    );

    // Act
    const result = await useCase.execute(macro.id, { description: "fail" }, testUserId);

    // Assert
    expect(result.isSuccess()).toBe(false);
    assertFailure(result);
  });

  it("should return failure when create returns empty array", async () => {
    // Arrange
    const createResult = await macroRepository.create(
      { name: "Empty Result Macro", language: "python", code: "cHl0aG9uIGNvZGU=" },
      testUserId,
    );
    assertSuccess(createResult);
    const macro = createResult.value[0];

    vi.spyOn(macroRepository, "create").mockResolvedValue(success([]));

    // Act
    const result = await useCase.execute(macro.id, { description: "fail" }, testUserId);

    // Assert
    expect(result.isSuccess()).toBe(false);
    assertFailure(result);
    expect(result.error.message).toBe("Failed to create new macro version");
  });
});
