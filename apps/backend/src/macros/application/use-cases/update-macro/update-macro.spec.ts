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

  beforeAll(async () => {
    await testApp.setup();
  });

  beforeEach(async () => {
    await testApp.beforeEach();
    testUserId = await testApp.createTestUser({});
    useCase = testApp.module.get(UpdateMacroUseCase);
    macroRepository = testApp.module.get(MacroRepository);
  });

  afterEach(() => {
    testApp.afterEach();
  });

  afterAll(async () => {
    await testApp.teardown();
  });

  it("should update a macro with valid data", async () => {
    const macroData: CreateMacroDto = {
      name: "Original Macro",
      description: "Original description",
      language: "python",
      code: "cHl0aG9uIGNvZGU=",
    };

    const createResult = await macroRepository.create(macroData, testUserId);
    assertSuccess(createResult);
    const createdMacro = createResult.value[0];

    const updateData: UpdateMacroDto = {
      name: "Updated Macro",
      description: "Updated description",
      language: "r",
      code: "cmV2aXNlZCBjb2Rl",
    };

    const result = await useCase.execute(createdMacro.id, updateData, testUserId);

    expect(result.isSuccess()).toBe(true);
    assertSuccess(result);
    expect(result.value).toMatchObject({
      id: createdMacro.id,
      name: updateData.name,
      description: updateData.description,
      language: updateData.language,
      createdBy: testUserId,
    });

    // Filename remains same as it's based on ID
    expect(result.value.filename).toBe(createdMacro.filename);
  });

  it("should return error when updating non-existent macro", async () => {
    const nonExistentId = "00000000-0000-0000-0000-000000000000";
    const updateData = {
      name: "Updated Name",
    };

    const result = await useCase.execute(nonExistentId, updateData, testUserId);

    expect(result.isSuccess()).toBe(false);
    assertFailure(result);
  });

  it("should update macro without code file successfully", async () => {
    const macroData: CreateMacroDto = {
      name: "Simple Macro",
      description: "Simple description",
      language: "javascript",
      code: "amF2YXNjcmlwdCBjb2Rl",
    };

    const createResult = await macroRepository.create(macroData, testUserId);
    assertSuccess(createResult);
    const createdMacro = createResult.value[0];

    const updateData = {
      name: "Simply Updated Macro",
      description: "Simply updated description",
    };

    const result = await useCase.execute(createdMacro.id, updateData, testUserId);

    expect(result.isSuccess()).toBe(true);
    assertSuccess(result);
    expect(result.value).toMatchObject({
      id: createdMacro.id,
      name: updateData.name,
      description: updateData.description,
      language: macroData.language,
      createdBy: testUserId,
    });
  });

  it("should handle partial updates", async () => {
    const macroData: CreateMacroDto = {
      name: "Partial Update Macro",
      description: "Original description",
      language: "python",
      code: "cHl0aG9uIGNvZGU=",
    };

    const createResult = await macroRepository.create(macroData, testUserId);
    assertSuccess(createResult);
    const createdMacro = createResult.value[0];

    const updateData = {
      description: "Only description updated",
    };

    const result = await useCase.execute(createdMacro.id, updateData, testUserId);

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

  it("should return failure when findById fails", async () => {
    vi.spyOn(macroRepository, "findById").mockResolvedValue(
      failure({
        message: "Database connection lost",
        code: "INTERNAL_ERROR",
        statusCode: 500,
        name: "",
      }),
    );

    const result = await useCase.execute("any-id", { name: "New Name" }, testUserId);

    assertFailure(result);
    expect(result.error.message).toBe("Database connection lost");
  });

  it("should return failure when update operation fails", async () => {
    const macroData: CreateMacroDto = {
      name: "Failure Update Macro",
      description: "Will fail on update",
      language: "python",
      code: "cHl0aG9uIGNvZGU=",
    };

    const createResult = await macroRepository.create(macroData, testUserId);
    assertSuccess(createResult);
    const createdMacro = createResult.value[0];

    vi.spyOn(macroRepository, "update").mockResolvedValue(
      failure({
        message: "Update query failed",
        code: "INTERNAL_ERROR",
        statusCode: 500,
        name: "",
      }),
    );

    const result = await useCase.execute(createdMacro.id, { name: "New Name" }, testUserId);

    assertFailure(result);
    expect(result.error.message).toBe("Update query failed");
  });

  it("should return failure when update returns empty array", async () => {
    const macroData: CreateMacroDto = {
      name: "Empty Update Macro",
      description: "Update returns nothing",
      language: "python",
      code: "cHl0aG9uIGNvZGU=",
    };

    const createResult = await macroRepository.create(macroData, testUserId);
    assertSuccess(createResult);
    const createdMacro = createResult.value[0];

    vi.spyOn(macroRepository, "update").mockResolvedValue(success([]));

    const result = await useCase.execute(createdMacro.id, { name: "New Name" }, testUserId);

    assertFailure(result);
    expect(result.error.message).toBe("Failed to update macro");
  });

  it("should return forbidden error when user is not the creator", async () => {
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

    const updateData = {
      name: "Trying to Update",
      description: "This should fail",
    };

    const result = await useCase.execute(createdMacro.id, updateData, anotherUserId);

    expect(result.isSuccess()).toBe(false);
    assertFailure(result);
    expect(result.error.statusCode).toBe(403);
    expect(result.error.message).toBe("Only the macro creator can update this macro");
  });
});
