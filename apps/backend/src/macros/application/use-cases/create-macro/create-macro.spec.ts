import { assertFailure, assertSuccess } from "../../../../common/utils/fp-utils";
import { TestHarness } from "../../../../test/test-harness";
import { DatabricksPort } from "../../../core/ports/databricks.port";
import { MacroRepository } from "../../../core/repositories/macro.repository";
import { CreateMacroUseCase } from "./create-macro";
import type { CreateMacroRequest } from "./create-macro";

describe("CreateMacroUseCase", () => {
  const testApp = TestHarness.App;
  let testUserId: string;
  let useCase: CreateMacroUseCase;
  let macroRepository: MacroRepository;
  let databricksPort: DatabricksPort;

  beforeAll(async () => {
    await testApp.setup();
  });

  beforeEach(async () => {
    await testApp.beforeEach();
    testUserId = await testApp.createTestUser({});
    useCase = testApp.module.get(CreateMacroUseCase);
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

  describe("execute", () => {
    const mockRequest: CreateMacroRequest = {
      name: "Test Macro",
      description: "A test macro",
      language: "python",
      codeFile: "cHl0aG9uIGNvZGU=", // base64 encoded "python code"
    };

    it("should successfully create a macro", async () => {
      // Arrange
      const processMacroCodeSpy = vi.spyOn(databricksPort, "processMacroCode").mockResolvedValue({
        success: true,
        message: "Code processed successfully",
        databricksJobId: "job-123",
      });

      // Act
      const result = await useCase.execute(mockRequest, testUserId);

      // Assert
      expect(result.isSuccess()).toBe(true);
      assertSuccess(result);
      expect(result.value).toMatchObject({
        name: mockRequest.name,
        description: mockRequest.description,
        language: mockRequest.language,
        codeFile: mockRequest.codeFile,
        createdBy: testUserId,
      });

      expect(processMacroCodeSpy).toHaveBeenCalledWith({
        content: mockRequest.codeFile,
        language: mockRequest.language,
        macroId: result.value.id,
      });
    });

    it("should clean up macro and return error when Databricks fails", async () => {
      // Arrange
      vi.spyOn(databricksPort, "processMacroCode").mockResolvedValue({
        success: false,
        message: "Databricks processing failed",
      });

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
      vi.spyOn(databricksPort, "processMacroCode").mockResolvedValue({
        success: true,
        message: "Code processed successfully",
        databricksJobId: "job-123",
      });

      await useCase.execute(mockRequest, testUserId);

      // Act - Try to create another macro with the same name
      const result = await useCase.execute(mockRequest, testUserId);

      // Assert
      expect(result.isSuccess()).toBe(false);
      assertFailure(result);
    });
  });
});
