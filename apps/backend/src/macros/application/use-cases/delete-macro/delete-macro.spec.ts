import { assertFailure, assertSuccess, AppError, failure } from "../../../../common/utils/fp-utils";
import type { CreateMacroDto } from "../../../../macros/core/models/macro.model";
import { TestHarness } from "../../../../test/test-harness";
import { MacroRepository } from "../../../core/repositories/macro.repository";
import { DeleteMacroUseCase } from "./delete-macro";

describe("DeleteMacroUseCase", () => {
  const testApp = TestHarness.App;
  let testUserId: string;
  let useCase: DeleteMacroUseCase;
  let macroRepository: MacroRepository;

  beforeAll(async () => {
    await testApp.setup();
  });

  beforeEach(async () => {
    await testApp.beforeEach();
    testUserId = await testApp.createTestUser({});
    useCase = testApp.module.get(DeleteMacroUseCase);
    macroRepository = testApp.module.get(MacroRepository);
  });

  afterEach(() => {
    testApp.afterEach();
  });

  afterAll(async () => {
    await testApp.teardown();
  });

  it("should delete a macro by id", async () => {
    const macroData: CreateMacroDto = {
      name: "Macro to Delete",
      description: "This macro will be deleted",
      language: "python",
      code: "cHl0aG9uIGNvZGU=",
    };

    const createResult = await macroRepository.create(macroData, testUserId);
    assertSuccess(createResult);
    const createdMacro = createResult.value[0];

    const result = await useCase.execute(createdMacro.id, testUserId);

    expect(result.isSuccess()).toBe(true);
    assertSuccess(result);

    const findResult = await macroRepository.findById(createdMacro.id);
    assertSuccess(findResult);
    expect(findResult.value).toBeNull();
  });

  it("should return error when deleting non-existent macro", async () => {
    const nonExistentId = "00000000-0000-0000-0000-000000000000";

    const result = await useCase.execute(nonExistentId, testUserId);

    expect(result.isSuccess()).toBe(false);
    assertFailure(result);
    expect(result.error).toMatchObject({
      code: "NOT_FOUND",
      message: "Macro not found",
      statusCode: 404,
    });
  });

  it("should return error when database deletion fails", async () => {
    const macroData: CreateMacroDto = {
      name: "Database Fail Macro",
      description: "Database deletion will fail",
      language: "javascript",
      code: "cHl0aG9uIGNvZGU=",
    };

    const createResult = await macroRepository.create(macroData, testUserId);
    assertSuccess(createResult);
    const createdMacro = createResult.value[0];

    vi.spyOn(macroRepository, "delete").mockResolvedValue(
      failure(AppError.internal("Database deletion failed")),
    );

    const result = await useCase.execute(createdMacro.id, testUserId);

    expect(result.isSuccess()).toBe(false);
    assertFailure(result);
    expect(result.error.message).toBe("Database deletion failed");
  });

  it("should handle invalid UUID format", async () => {
    const invalidId = "invalid-uuid-format";

    const result = await useCase.execute(invalidId, testUserId);

    expect(result.isSuccess()).toBe(false);
    assertFailure(result);
  });

  // Authorization (creator/org/grant checks) now lives in the @CanAccess route
  // guard and is covered by authorization.service.spec + the guard spec; the
  // use-case itself is pure business logic.
});
