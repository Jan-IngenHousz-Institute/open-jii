import { DatabricksAdapter } from "../../../../common/modules/databricks/databricks.adapter";
import { assertFailure, assertSuccess, failure, success } from "../../../../common/utils/fp-utils";
import type { CreateMacroDto } from "../../../../macros/core/models/macro.model";
import { TestHarness } from "../../../../test/test-harness";
import { MacroRepository } from "../../../core/repositories/macro.repository";
import { CreateMacroUseCase } from "./create-macro";

describe("CreateMacroUseCase", () => {
  const testApp = TestHarness.App;
  let testUserId: string;
  let useCase: CreateMacroUseCase;
  let macroRepository: MacroRepository;
  let databricksAdapter: DatabricksAdapter;

  beforeAll(async () => {
    await testApp.setup();
  });

  beforeEach(async () => {
    await testApp.beforeEach();
    testUserId = await testApp.createTestUser({});
    useCase = testApp.module.get(CreateMacroUseCase);
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

  describe("execute", () => {
    const mockRequest: CreateMacroDto = {
      name: "Test Macro",
      description: "A test macro",
      language: "python",
      code: "cHl0aG9uIGNvZGU=",
    };

    it("should successfully create a macro", async () => {
      // Arrange
      const uploadMacroCodeSpy = vi
        .spyOn(databricksAdapter, "uploadMacroCode")
        .mockResolvedValue(success({}));

      // Act
      const result = await useCase.execute(mockRequest, testUserId);

      // Assert
      expect(result.isSuccess()).toBe(true);
      assertSuccess(result);
      expect(result.value).toMatchObject({
        name: mockRequest.name,
        description: mockRequest.description,
        language: mockRequest.language,
        code: mockRequest.code,
        createdBy: testUserId,
      });

      expect(uploadMacroCodeSpy).toHaveBeenCalledWith({
        code: mockRequest.code,
        name: result.value.name,
        language: mockRequest.language,
      });
    });

    it("should clean up macro and return error when Databricks fails", async () => {
      // Arrange
      vi.spyOn(databricksAdapter, "uploadMacroCode").mockResolvedValue(
        failure({
          message: "Databricks processing failed",
          code: "DATABRICKS_ERROR",
          statusCode: 500,
          name: "",
        }),
      );

      // Act
      const result = await useCase.execute(mockRequest, testUserId);

      // Assert
      expect(result.isSuccess()).toBe(false);
      assertFailure(result);
      expect(result.error.message).toBe("Databricks processing failed");

      // Verify macro was not created due to rollback - list all macros should be empty
      const listResult = await macroRepository.findAll();
      assertSuccess(listResult);
      expect(listResult.value).toHaveLength(0);
    });

    it("should handle duplicate macro names", async () => {
      // Arrange - Create a macro with the same name first
      vi.spyOn(databricksAdapter, "uploadMacroCode").mockResolvedValue(success({}));

      await useCase.execute(mockRequest, testUserId);

      // Act - Try to create another macro with the same name
      const result = await useCase.execute(mockRequest, testUserId);

      // Assert
      expect(result.isSuccess()).toBe(false);
      assertFailure(result);
    });
  });
});
