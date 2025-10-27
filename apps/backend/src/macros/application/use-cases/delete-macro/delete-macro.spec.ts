import { DatabricksAdapter } from "../../../../common/modules/databricks/databricks.adapter";
import {
  assertFailure,
  assertSuccess,
  AppError,
  failure,
  success,
} from "../../../../common/utils/fp-utils";
import type { CreateMacroDto } from "../../../../macros/core/models/macro.model";
import { TestHarness } from "../../../../test/test-harness";
import { MacroRepository } from "../../../core/repositories/macro.repository";
import { DeleteMacroUseCase } from "./delete-macro";

describe("DeleteMacroUseCase", () => {
  const testApp = TestHarness.App;
  let testUserId: string;
  let useCase: DeleteMacroUseCase;
  let macroRepository: MacroRepository;
  let databricksAdapter: DatabricksAdapter;

  beforeAll(async () => {
    await testApp.setup();
  });

  beforeEach(async () => {
    await testApp.beforeEach();
    testUserId = await testApp.createTestUser({});
    useCase = testApp.module.get(DeleteMacroUseCase);
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

  it("should delete a macro by id", async () => {
    // Arrange
    const macroData: CreateMacroDto = {
      name: "Macro to Delete",
      description: "This macro will be deleted",
      language: "python",
      code: "cHl0aG9uIGNvZGU=",
    };

    // Create a macro to delete
    const createResult = await macroRepository.create(macroData, testUserId);
    assertSuccess(createResult);
    const createdMacro = createResult.value[0];

    // Mock Databricks success
    vi.spyOn(databricksAdapter, "deleteMacroCode").mockResolvedValue(success({}));

    // Act
    const result = await useCase.execute(createdMacro.id, testUserId);

    // Assert
    expect(result.isSuccess()).toBe(true);
    assertSuccess(result);

    // Verify macro was deleted from database
    const findResult = await macroRepository.findById(createdMacro.id);
    assertSuccess(findResult);
    expect(findResult.value).toBeNull();

    // Verify Databricks was called with filename, not name
    // eslint-disable-next-line @typescript-eslint/unbound-method
    expect(databricksAdapter.deleteMacroCode).toHaveBeenCalledWith(createdMacro.filename);
  });

  it("should return error when deleting non-existent macro", async () => {
    // Arrange
    const nonExistentId = "00000000-0000-0000-0000-000000000000";

    // Act
    const result = await useCase.execute(nonExistentId, testUserId);

    // Assert
    expect(result.isSuccess()).toBe(false);
    assertFailure(result);
    expect(result.error).toMatchObject({
      code: "NOT_FOUND",
      message: "Macro not found",
      statusCode: 404,
    });
  });

  it("should still delete macro even if Databricks deletion fails", async () => {
    // Arrange
    const macroData: CreateMacroDto = {
      name: "Macro with Databricks Failure",
      description: "Databricks will fail but macro should still be deleted",
      language: "r",
      code: "cHl0aG9uIGNvZGU=",
    };

    // Create a macro to delete
    const createResult = await macroRepository.create(macroData, testUserId);
    assertSuccess(createResult);
    const createdMacro = createResult.value[0];

    // Mock Databricks failure
    vi.spyOn(databricksAdapter, "deleteMacroCode").mockResolvedValue(
      failure({
        message: "Databricks deletion failed",
        code: "DATABRICKS_ERROR",
        statusCode: 500,
        name: "",
      }),
    );

    // Act
    const result = await useCase.execute(createdMacro.id, testUserId);

    // Assert
    expect(result.isSuccess()).toBe(true);
    assertSuccess(result);

    // Verify macro was still deleted from database despite Databricks failure
    const findResult = await macroRepository.findById(createdMacro.id);
    assertSuccess(findResult);
    expect(findResult.value).toBeNull();

    // Verify Databricks was called with filename, not name
    // eslint-disable-next-line @typescript-eslint/unbound-method
    expect(databricksAdapter.deleteMacroCode).toHaveBeenCalledWith(createdMacro.filename);
  });

  it("should return error when database deletion fails", async () => {
    // Arrange
    const macroData: CreateMacroDto = {
      name: "Database Fail Macro",
      description: "Database deletion will fail",
      language: "javascript",
      code: "cHl0aG9uIGNvZGU=",
    };

    // Create a macro
    const createResult = await macroRepository.create(macroData, testUserId);
    assertSuccess(createResult);
    const createdMacro = createResult.value[0];

    // Mock successful Databricks deletion
    vi.spyOn(databricksAdapter, "deleteMacroCode").mockResolvedValue(success({}));

    // Mock database failure AFTER the macro is created
    // We need to mock it in a way that findById works but delete fails
    vi.spyOn(macroRepository, "delete").mockResolvedValue(
      failure(AppError.internal("Database deletion failed")),
    );

    // Act
    const result = await useCase.execute(createdMacro.id, testUserId);

    // Assert
    expect(result.isSuccess()).toBe(false);
    assertFailure(result);
    expect(result.error.message).toBe("Database deletion failed");
  });

  it("should handle invalid UUID format", async () => {
    // Arrange
    const invalidId = "invalid-uuid-format";

    // Act
    const result = await useCase.execute(invalidId, testUserId);

    // Assert
    expect(result.isSuccess()).toBe(false);
    assertFailure(result);
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

    // Act - try to delete with a different user
    const result = await useCase.execute(createdMacro.id, anotherUserId);

    // Assert
    expect(result.isSuccess()).toBe(false);
    assertFailure(result);
    expect(result.error.statusCode).toBe(403);
    expect(result.error.message).toBe("Only the macro creator can delete this macro");
  });
});
