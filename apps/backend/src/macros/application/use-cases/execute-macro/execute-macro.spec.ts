import { faker } from "@faker-js/faker";

import {
  assertFailure,
  assertSuccess,
  success,
  failure,
  AppError,
} from "../../../../common/utils/fp-utils";
import { TestHarness } from "../../../../test/test-harness";
import type { CreateMacroDto } from "../../../core/models/macro.model";
import type { LambdaPort } from "../../../core/ports/lambda.port";
import { LAMBDA_PORT } from "../../../core/ports/lambda.port";
import { MacroRepository } from "../../../core/repositories/macro.repository";
import { ExecuteMacroUseCase } from "./execute-macro";

describe("ExecuteMacroUseCase", () => {
  const testApp = TestHarness.App;
  let testUserId: string;
  let useCase: ExecuteMacroUseCase;
  let macroRepository: MacroRepository;
  let lambdaPort: LambdaPort;

  beforeAll(async () => {
    await testApp.setup({ mock: { AnalyticsAdapter: true } });
  });

  beforeEach(async () => {
    await testApp.beforeEach();
    testUserId = await testApp.createTestUser({});
    useCase = testApp.module.get(ExecuteMacroUseCase);
    macroRepository = testApp.module.get(MacroRepository);
    lambdaPort = testApp.module.get(LAMBDA_PORT);

    vi.restoreAllMocks();
  });

  afterEach(() => {
    testApp.afterEach();
  });

  afterAll(async () => {
    await testApp.teardown();
  });

  async function createTestMacro(
    overrides: Partial<CreateMacroDto> = {},
  ): Promise<{ id: string; name: string; language: "python" | "r" | "javascript" }> {
    const macroData: CreateMacroDto = {
      name: overrides.name ?? `Macro_${faker.string.alphanumeric(8)}`,
      description: "Test macro",
      language: overrides.language ?? "python",
      code: "b3V0cHV0WyJyZXN1bHQiXSA9IDE=", // base64 encoded script
      ...overrides,
    };
    const result = await macroRepository.create(macroData, testUserId);
    assertSuccess(result);
    const macro = result.value[0];
    return { id: macro.id, name: macro.name, language: macro.language };
  }

  describe("successful execution", () => {
    it("should execute a macro with a single data point and return the result", async () => {
      const macro = await createTestMacro({ language: "python" });

      vi.spyOn(lambdaPort, "invokeLambda").mockResolvedValue(
        success({
          statusCode: 200,
          payload: {
            status: "success",
            results: [{ id: "single", success: true, output: { result: 42 } }],
          },
        }),
      );
      vi.spyOn(lambdaPort, "getFunctionNameForLanguage").mockReturnValue(
        "test-macro-sandbox-python",
      );

      const result = await useCase.execute(macro.id, {
        data: { trace_1: [1, 2, 3] },
      });

      assertSuccess(result);
      expect(result.value).toMatchObject({
        macro_id: macro.id,
        success: true,
        output: { result: 42 },
      });
    });

    it("should pass timeout to Lambda payload", async () => {
      const macro = await createTestMacro();

      const invokeSpy = vi.spyOn(lambdaPort, "invokeLambda").mockResolvedValue(
        success({
          statusCode: 200,
          payload: {
            status: "success",
            results: [{ id: "single", success: true, output: {} }],
          },
        }),
      );
      vi.spyOn(lambdaPort, "getFunctionNameForLanguage").mockReturnValue("test-fn");

      await useCase.execute(macro.id, {
        data: { x: 1 },
        timeout: 15,
      });

      expect(invokeSpy).toHaveBeenCalledWith("test-fn", expect.objectContaining({ timeout: 15 }));
    });

    it("should use default timeout of 30 when not specified", async () => {
      const macro = await createTestMacro();

      const invokeSpy = vi.spyOn(lambdaPort, "invokeLambda").mockResolvedValue(
        success({
          statusCode: 200,
          payload: {
            status: "success",
            results: [{ id: "single", success: true, output: {} }],
          },
        }),
      );
      vi.spyOn(lambdaPort, "getFunctionNameForLanguage").mockReturnValue("test-fn");

      await useCase.execute(macro.id, { data: {} });

      expect(invokeSpy).toHaveBeenCalledWith("test-fn", expect.objectContaining({ timeout: 30 }));
    });

    it("should resolve the correct Lambda function for the macro language", async () => {
      const macro = await createTestMacro({ language: "javascript" });

      vi.spyOn(lambdaPort, "invokeLambda").mockResolvedValue(
        success({
          statusCode: 200,
          payload: {
            status: "success",
            results: [{ id: "single", success: true, output: {} }],
          },
        }),
      );
      const getFnSpy = vi
        .spyOn(lambdaPort, "getFunctionNameForLanguage")
        .mockReturnValue("test-macro-sandbox-javascript");

      await useCase.execute(macro.id, { data: { x: 1 } });

      expect(getFnSpy).toHaveBeenCalledWith("javascript");
    });
  });

  describe("macro not found", () => {
    it("should return failure when macro_id does not exist", async () => {
      const fakeMacroId = faker.string.uuid();

      const result = await useCase.execute(fakeMacroId, {
        data: { x: 1 },
      });

      assertFailure(result);
      expect(result.error.message).toContain("Macro not found");
    });

    it("should return failure when findScriptById fails", async () => {
      vi.spyOn(macroRepository, "findScriptById").mockResolvedValue(
        failure(AppError.internal("Database connection lost")),
      );

      const result = await useCase.execute(faker.string.uuid(), { data: {} });

      assertFailure(result);
      expect(result.error.message).toBe("Failed to fetch macro script");
    });
  });

  describe("Lambda errors", () => {
    it("should return success with error details when Lambda invocation fails", async () => {
      const macro = await createTestMacro();

      vi.spyOn(lambdaPort, "invokeLambda").mockResolvedValue(
        success({
          statusCode: 200,
          payload: {
            status: "error",
            results: [],
            errors: ["Script compilation failed"],
          },
        }),
      );
      vi.spyOn(lambdaPort, "getFunctionNameForLanguage").mockReturnValue("test-fn");

      const result = await useCase.execute(macro.id, {
        data: { x: 1 },
      });

      assertSuccess(result);
      expect(result.value.success).toBe(false);
      expect(result.value.error).toContain("Script compilation failed");
    });

    it("should use fallback error message when Lambda error status has no errors array", async () => {
      const macro = await createTestMacro();

      vi.spyOn(lambdaPort, "invokeLambda").mockResolvedValue(
        success({
          statusCode: 200,
          payload: {
            status: "error",
            results: [],
          },
        }),
      );
      vi.spyOn(lambdaPort, "getFunctionNameForLanguage").mockReturnValue("test-fn");

      const result = await useCase.execute(macro.id, { data: {} });

      assertSuccess(result);
      expect(result.value.success).toBe(false);
      expect(result.value.error).toBe("Lambda execution failed");
    });

    it("should return success with error message when invokeLambda returns a failure Result", async () => {
      const macro = await createTestMacro();

      vi.spyOn(lambdaPort, "invokeLambda").mockResolvedValue(
        failure(AppError.internal("Lambda connection timeout")),
      );
      vi.spyOn(lambdaPort, "getFunctionNameForLanguage").mockReturnValue("test-fn");

      const result = await useCase.execute(macro.id, { data: { x: 1 } });

      assertSuccess(result);
      expect(result.value.success).toBe(false);
      expect(result.value.error).toBe("Lambda connection timeout");
    });

    it("should return success with error when Lambda returns empty results array", async () => {
      const macro = await createTestMacro();

      vi.spyOn(lambdaPort, "invokeLambda").mockResolvedValue(
        success({
          statusCode: 200,
          payload: {
            status: "success",
            results: [],
          },
        }),
      );
      vi.spyOn(lambdaPort, "getFunctionNameForLanguage").mockReturnValue("test-fn");

      const result = await useCase.execute(macro.id, { data: {} });

      assertSuccess(result);
      expect(result.value.success).toBe(false);
      expect(result.value.error).toBe("No result returned from Lambda");
    });
  });

  describe("caching", () => {
    it("should cache macro script after first fetch", async () => {
      const macro = await createTestMacro();

      vi.spyOn(lambdaPort, "invokeLambda").mockResolvedValue(
        success({
          statusCode: 200,
          payload: {
            status: "success",
            results: [{ id: "single", success: true, output: {} }],
          },
        }),
      );
      vi.spyOn(lambdaPort, "getFunctionNameForLanguage").mockReturnValue("test-fn");

      const findScriptSpy = vi.spyOn(macroRepository, "findScriptById");

      // First call — should hit repository (which handles caching internally)
      await useCase.execute(macro.id, { data: {} });
      expect(findScriptSpy).toHaveBeenCalledTimes(1);

      // Second call — repository called again, but internal cache serves the data
      await useCase.execute(macro.id, { data: {} });
      expect(findScriptSpy).toHaveBeenCalledTimes(2);
    });

    it("should fetch from database when cache is empty", async () => {
      const macro = await createTestMacro();

      vi.spyOn(lambdaPort, "invokeLambda").mockResolvedValue(
        success({
          statusCode: 200,
          payload: {
            status: "success",
            results: [{ id: "single", success: true, output: {} }],
          },
        }),
      );
      vi.spyOn(lambdaPort, "getFunctionNameForLanguage").mockReturnValue("test-fn");

      // Invalidate cache for this macro
      await macroRepository.invalidateCache(macro.id);

      const findScriptSpy = vi.spyOn(macroRepository, "findScriptById");

      await useCase.execute(macro.id, { data: {} });

      expect(findScriptSpy).toHaveBeenCalledWith(macro.id);
    });
  });
});
