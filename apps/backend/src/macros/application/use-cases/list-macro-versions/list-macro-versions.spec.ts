import { DatabricksAdapter } from "../../../../common/modules/databricks/databricks.adapter";
import { assertFailure, assertSuccess, failure, success } from "../../../../common/utils/fp-utils";
import { TestHarness } from "../../../../test/test-harness";
import { MacroRepository } from "../../../core/repositories/macro.repository";
import { UpdateMacroUseCase } from "../update-macro/update-macro";
import { ListMacroVersionsUseCase } from "./list-macro-versions";

describe("ListMacroVersionsUseCase", () => {
  const testApp = TestHarness.App;
  let testUserId: string;
  let useCase: ListMacroVersionsUseCase;
  let updateUseCase: UpdateMacroUseCase;
  let macroRepository: MacroRepository;
  let databricksAdapter: DatabricksAdapter;

  beforeAll(async () => {
    await testApp.setup();
  });

  beforeEach(async () => {
    await testApp.beforeEach();
    testUserId = await testApp.createTestUser({});
    useCase = testApp.module.get(ListMacroVersionsUseCase);
    updateUseCase = testApp.module.get(UpdateMacroUseCase);
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

  it("should return all versions of a macro ordered by version descending", async () => {
    // Arrange — create a macro then update it twice
    const createResult = await macroRepository.create(
      {
        name: "Versioned Macro",
        description: "v1",
        language: "python",
        code: "cHl0aG9uIGNvZGU=",
      },
      testUserId,
    );
    assertSuccess(createResult);
    const v1 = createResult.value[0];

    vi.spyOn(databricksAdapter, "uploadMacroCode").mockResolvedValue(success({}));

    const v2Result = await updateUseCase.execute(v1.id, { description: "v2" }, testUserId);
    assertSuccess(v2Result);
    expect(v2Result.value.version).toBe(2);
    expect(v2Result.value.id).toBe(v1.id); // same UUID

    const v3Result = await updateUseCase.execute(v1.id, { description: "v3" }, testUserId);
    assertSuccess(v3Result);
    expect(v3Result.value.version).toBe(3);

    // Act — list versions
    const result = await useCase.execute(v1.id);

    // Assert
    assertSuccess(result);
    expect(result.value).toHaveLength(3);
    expect(result.value[0].version).toBe(3);
    expect(result.value[1].version).toBe(2);
    expect(result.value[2].version).toBe(1);

    // All share the same UUID and name
    expect(result.value.every((v) => v.id === v1.id)).toBe(true);
    expect(result.value.every((v) => v.name === "Versioned Macro")).toBe(true);
  });

  it("should return single version for a macro with no updates", async () => {
    // Arrange
    const createResult = await macroRepository.create(
      {
        name: "Single Version Macro",
        description: "Only v1",
        language: "python",
        code: "cHl0aG9uIGNvZGU=",
      },
      testUserId,
    );
    assertSuccess(createResult);
    const v1 = createResult.value[0];

    // Act
    const result = await useCase.execute(v1.id);

    // Assert
    assertSuccess(result);
    expect(result.value).toHaveLength(1);
    expect(result.value[0].version).toBe(1);
    expect(result.value[0].id).toBe(v1.id);
  });

  it("should return not found for non-existent macro", async () => {
    const result = await useCase.execute("00000000-0000-0000-0000-000000000000");

    expect(result.isSuccess()).toBe(false);
    assertFailure(result);
    expect(result.error.statusCode).toBe(404);
  });

  it("should not mix versions from different macros", async () => {
    // Arrange — two different macros
    const result1 = await macroRepository.create(
      { name: "Macro A", language: "python", code: "YQ==" },
      testUserId,
    );
    assertSuccess(result1);
    const macroA = result1.value[0];

    const result2 = await macroRepository.create(
      { name: "Macro B", language: "python", code: "Yg==" },
      testUserId,
    );
    assertSuccess(result2);

    vi.spyOn(databricksAdapter, "uploadMacroCode").mockResolvedValue(success({}));

    // Update Macro A
    await updateUseCase.execute(macroA.id, { description: "A v2" }, testUserId);

    // Act — list versions of Macro A
    const versionsA = await useCase.execute(macroA.id);
    assertSuccess(versionsA);

    // Assert — should only see Macro A versions, not Macro B
    expect(versionsA.value).toHaveLength(2);
    expect(versionsA.value.every((v) => v.name === "Macro A")).toBe(true);
  });

  it("should return failure when findById has a database error", async () => {
    // Arrange
    const createResult = await macroRepository.create(
      { name: "DB Error Macro", language: "python", code: "YQ==" },
      testUserId,
    );
    assertSuccess(createResult);
    const macro = createResult.value[0];

    vi.spyOn(macroRepository, "findById").mockResolvedValue(
      failure({ message: "Connection lost", code: "INTERNAL", statusCode: 500, name: "" }),
    );

    // Act
    const result = await useCase.execute(macro.id);

    // Assert
    expect(result.isSuccess()).toBe(false);
    assertFailure(result);
    expect(result.error.message).toBe("Connection lost");
  });
});
