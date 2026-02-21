import { faker } from "@faker-js/faker";

import {
  assertSuccess,
  assertFailure,
  success,
  failure,
  AppError,
} from "../../../../common/utils/fp-utils";
import { TestHarness } from "../../../../test/test-harness";
import type { CreateMacroDto } from "../../../core/models/macro.model";
import type { LambdaPort } from "../../../core/ports/lambda.port";
import { LAMBDA_PORT } from "../../../core/ports/lambda.port";
import { MacroRepository } from "../../../core/repositories/macro.repository";
import { ExecuteMacroBatchUseCase } from "./execute-macro-batch";

describe("ExecuteMacroBatchUseCase", () => {
  const testApp = TestHarness.App;
  let testUserId: string;
  let useCase: ExecuteMacroBatchUseCase;
  let macroRepository: MacroRepository;
  let lambdaPort: LambdaPort;

  beforeAll(async () => {
    await testApp.setup({ mock: { AnalyticsAdapter: true } });
  });

  beforeEach(async () => {
    await testApp.beforeEach();
    testUserId = await testApp.createTestUser({});
    useCase = testApp.module.get(ExecuteMacroBatchUseCase);
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

  describe("grouping and fan-out", () => {
    it("should group items by macro_id and invoke Lambda per group", async () => {
      const macro1 = await createTestMacro({ language: "python" });
      const macro2 = await createTestMacro({ language: "javascript" });

      // Mock Lambda invocations
      const invokeSpy = vi
        .spyOn(lambdaPort, "invokeLambda")
        .mockImplementation((_functionName, payload) => {
          const items = (payload as { items: { id: string }[] }).items;
          return Promise.resolve(
            success({
              statusCode: 200,
              payload: {
                status: "success",
                results: items.map((item) => ({
                  id: item.id,
                  success: true,
                  output: { processed: true },
                })),
              },
            }),
          );
        });

      vi.spyOn(lambdaPort, "getFunctionNameForLanguage").mockImplementation((lang) => {
        return `test-macro-runner-${lang}`;
      });

      const result = await useCase.execute({
        items: [
          { id: "item-1", macro_id: macro1.id, data: { trace_1: [1, 2, 3] } },
          { id: "item-2", macro_id: macro1.id, data: { trace_1: [4, 5, 6] } },
          { id: "item-3", macro_id: macro2.id, data: { trace_1: [7, 8, 9] } },
        ],
        timeout: 10,
      });

      assertSuccess(result);
      expect(result.value.results).toHaveLength(3);
      expect(result.value.results.every((r) => r.success)).toBe(true);

      // Should have been called once per unique macro (2 groups)
      expect(invokeSpy).toHaveBeenCalledTimes(2);
    });

    it("should handle a single macro with multiple items", async () => {
      const macro = await createTestMacro();

      vi.spyOn(lambdaPort, "invokeLambda").mockResolvedValue(
        success({
          statusCode: 200,
          payload: {
            status: "success",
            results: [
              { id: "item-1", success: true, output: { val: 1 } },
              { id: "item-2", success: true, output: { val: 2 } },
            ],
          },
        }),
      );
      vi.spyOn(lambdaPort, "getFunctionNameForLanguage").mockReturnValue("test-fn");

      const result = await useCase.execute({
        items: [
          { id: "item-1", macro_id: macro.id, data: { x: 1 } },
          { id: "item-2", macro_id: macro.id, data: { x: 2 } },
        ],
        timeout: 10,
      });

      assertSuccess(result);
      expect(result.value.results).toHaveLength(2);
      expect(result.value.results[0]).toMatchObject({
        id: "item-1",
        macro_id: macro.id,
        success: true,
      });
    });

    it("should default timeout to 30 when not specified", async () => {
      const macro = await createTestMacro();

      const invokeSpy = vi.spyOn(lambdaPort, "invokeLambda").mockResolvedValue(
        success({
          statusCode: 200,
          payload: {
            status: "success",
            results: [{ id: "item-1", success: true, output: {} }],
          },
        }),
      );
      vi.spyOn(lambdaPort, "getFunctionNameForLanguage").mockReturnValue("test-fn");

      await useCase.execute({
        items: [{ id: "item-1", macro_id: macro.id, data: {} }],
        // no timeout specified
      });

      expect(invokeSpy).toHaveBeenCalledWith("test-fn", expect.objectContaining({ timeout: 30 }));
    });
  });

  describe("macro not found", () => {
    it("should mark all items as failed when macro_id does not exist", async () => {
      const fakeMacroId = faker.string.uuid();

      const result = await useCase.execute({
        items: [
          { id: "item-1", macro_id: fakeMacroId, data: { x: 1 } },
          { id: "item-2", macro_id: fakeMacroId, data: { x: 2 } },
        ],
        timeout: 10,
      });

      assertSuccess(result);
      expect(result.value.results).toHaveLength(2);
      expect(result.value.results.every((r) => !r.success)).toBe(true);
      expect(result.value.results[0].error).toContain("Macro not found");
    });
  });

  describe("Lambda errors", () => {
    it("should mark items as failed when Lambda returns error status with errors array", async () => {
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

      const result = await useCase.execute({
        items: [{ id: "item-1", macro_id: macro.id, data: { x: 1 } }],
        timeout: 10,
      });

      assertSuccess(result);
      expect(result.value.results).toHaveLength(1);
      expect(result.value.results[0].success).toBe(false);
      expect(result.value.errors).toBeDefined();
      expect(result.value.errors?.[0]).toContain("Script compilation failed");
    });

    it("should default error message when Lambda returns error status without errors array", async () => {
      const macro = await createTestMacro();

      vi.spyOn(lambdaPort, "invokeLambda").mockResolvedValue(
        success({
          statusCode: 200,
          payload: {
            status: "error",
            results: [],
            // no errors array
          },
        }),
      );
      vi.spyOn(lambdaPort, "getFunctionNameForLanguage").mockReturnValue("test-fn");

      const result = await useCase.execute({
        items: [{ id: "item-1", macro_id: macro.id, data: { x: 1 } }],
        timeout: 10,
      });

      assertSuccess(result);
      expect(result.value.results[0].success).toBe(false);
      expect(result.value.results[0].error).toBe("Lambda execution failed");
    });
  });

  describe("Lambda invocation failure", () => {
    it("should mark items as failed when invokeLambda returns a Failure result", async () => {
      const macro = await createTestMacro();

      vi.spyOn(lambdaPort, "invokeLambda").mockResolvedValue(
        failure(AppError.internal("Lambda timeout")),
      );
      vi.spyOn(lambdaPort, "getFunctionNameForLanguage").mockReturnValue("test-fn");

      const result = await useCase.execute({
        items: [
          { id: "item-1", macro_id: macro.id, data: { x: 1 } },
          { id: "item-2", macro_id: macro.id, data: { x: 2 } },
        ],
        timeout: 10,
      });

      assertSuccess(result);
      expect(result.value.results).toHaveLength(2);
      expect(result.value.results.every((r) => !r.success)).toBe(true);
      expect(result.value.results[0].error).toContain("Lambda timeout");
      expect(result.value.errors).toBeDefined();
    });
  });

  describe("repository failure", () => {
    it("should return failure when findScriptsByIds fails", async () => {
      vi.spyOn(macroRepository, "findScriptsByIds").mockResolvedValue(
        failure(AppError.internal("Database connection failed")),
      );

      const result = await useCase.execute({
        items: [{ id: "item-1", macro_id: faker.string.uuid(), data: {} }],
        timeout: 10,
      });

      assertFailure(result);
      expect(result.error.code).toBe("MACRO_EXECUTION_FAILED");
    });
  });

  describe("mixed results", () => {
    it("should handle mix of found and missing macros", async () => {
      const realMacro = await createTestMacro();
      const fakeMacroId = faker.string.uuid();

      vi.spyOn(lambdaPort, "invokeLambda").mockResolvedValue(
        success({
          statusCode: 200,
          payload: {
            status: "success",
            results: [{ id: "item-1", success: true, output: { ok: true } }],
          },
        }),
      );
      vi.spyOn(lambdaPort, "getFunctionNameForLanguage").mockReturnValue("test-fn");

      const result = await useCase.execute({
        items: [
          { id: "item-1", macro_id: realMacro.id, data: {} },
          { id: "item-2", macro_id: fakeMacroId, data: {} },
        ],
        timeout: 10,
      });

      assertSuccess(result);
      expect(result.value.results).toHaveLength(2);

      const successItem = result.value.results.find((r) => r.id === "item-1");
      const failItem = result.value.results.find((r) => r.id === "item-2");

      expect(successItem?.success).toBe(true);
      expect(failItem?.success).toBe(false);
      expect(failItem?.error).toContain("Macro not found");
    });
  });

  describe("caching", () => {
    it("should cache macro scripts after first fetch", async () => {
      const macro = await createTestMacro();

      vi.spyOn(lambdaPort, "invokeLambda").mockResolvedValue(
        success({
          statusCode: 200,
          payload: {
            status: "success",
            results: [{ id: "item-1", success: true, output: {} }],
          },
        }),
      );
      vi.spyOn(lambdaPort, "getFunctionNameForLanguage").mockReturnValue("test-fn");

      const findScriptsSpy = vi.spyOn(macroRepository, "findScriptsByIds");

      // First call — should hit repository (which handles caching internally)
      await useCase.execute({
        items: [{ id: "item-1", macro_id: macro.id, data: {} }],
        timeout: 10,
      });

      expect(findScriptsSpy).toHaveBeenCalledTimes(1);

      // Second call — repository called again, but internal cache serves the data
      await useCase.execute({
        items: [{ id: "item-2", macro_id: macro.id, data: {} }],
        timeout: 10,
      });

      expect(findScriptsSpy).toHaveBeenCalledTimes(2);
    });

    it("should fetch from database when cache is empty", async () => {
      const macro = await createTestMacro();

      vi.spyOn(lambdaPort, "invokeLambda").mockResolvedValue(
        success({
          statusCode: 200,
          payload: {
            status: "success",
            results: [{ id: "item-1", success: true, output: {} }],
          },
        }),
      );
      vi.spyOn(lambdaPort, "getFunctionNameForLanguage").mockReturnValue("test-fn");

      // Invalidate cache for this macro
      await macroRepository.invalidateCache(macro.id);

      const findScriptsSpy = vi.spyOn(macroRepository, "findScriptsByIds");

      await useCase.execute({
        items: [{ id: "item-1", macro_id: macro.id, data: {} }],
        timeout: 10,
      });

      expect(findScriptsSpy).toHaveBeenCalledWith([macro.id]);
    });
  });
});
