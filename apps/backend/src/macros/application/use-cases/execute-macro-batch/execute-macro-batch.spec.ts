import { faker } from "@faker-js/faker";
import { Logger } from "@nestjs/common";

import {
  assertSuccess,
  assertFailure,
  success,
  failure,
  AppError,
} from "../../../../common/utils/fp-utils";
import { TestHarness } from "../../../../test/test-harness";
import type { LambdaExecutionPayload } from "../../../core/models/macro-execution.model";
import type { CreateMacroDto } from "../../../core/models/macro.model";
import type { LambdaPort } from "../../../core/ports/lambda.port";
import { LAMBDA_PORT } from "../../../core/ports/lambda.port";
import {
  macroSnapshotKey,
  MacroSnapshotRepository,
} from "../../../core/repositories/macro-snapshot.repository";
import { MacroRepository } from "../../../core/repositories/macro.repository";
import { ExecuteMacroBatchUseCase } from "./execute-macro-batch";

describe("ExecuteMacroBatchUseCase", () => {
  const testApp = TestHarness.App;
  let testUserId: string;
  let useCase: ExecuteMacroBatchUseCase;
  let macroRepository: MacroRepository;
  let macroSnapshotRepository: MacroSnapshotRepository;
  let lambdaPort: LambdaPort;

  beforeAll(async () => {
    await testApp.setup({ mock: { AnalyticsAdapter: true } });
  });

  beforeEach(async () => {
    await testApp.beforeEach();
    testUserId = await testApp.createTestUser({});
    useCase = testApp.module.get(ExecuteMacroBatchUseCase);
    macroRepository = testApp.module.get(MacroRepository);
    macroSnapshotRepository = testApp.module.get(MacroSnapshotRepository);
    lambdaPort = testApp.module.get(LAMBDA_PORT);
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
        return `test-macro-sandbox-${lang}`;
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

    it("passes each item's workbook context to the sandbox", async () => {
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

      const context = { baseline: { value: 3 } };
      await useCase.execute({
        items: [{ id: "item-1", macro_id: macro.id, data: {}, context }],
      });

      expect(invokeSpy).toHaveBeenCalledWith(
        "test-fn",
        expect.objectContaining({
          items: [{ id: "item-1", data: {}, context }],
        }),
      );
    });

    it("uses the published snapshot and separates versions of the same macro", async () => {
      const macroId = faker.string.uuid();
      const version1 = faker.string.uuid();
      const version2 = faker.string.uuid();
      vi.spyOn(macroSnapshotRepository, "findScriptsByVersionIds").mockResolvedValue(
        success(
          new Map([
            [
              macroSnapshotKey(version1, macroId),
              { id: macroId, name: "Pinned v1", language: "python", code: "code-v1" },
            ],
            [
              macroSnapshotKey(version2, macroId),
              { id: macroId, name: "Pinned v2", language: "javascript", code: "code-v2" },
            ],
          ]),
        ),
      );
      const liveSpy = vi.spyOn(macroRepository, "findScriptsByIds");
      const invokeSpy = vi
        .spyOn(lambdaPort, "invokeLambda")
        .mockImplementation((_name, payload) => {
          const items = (payload as LambdaExecutionPayload).items;
          return Promise.resolve(
            success({
              statusCode: 200,
              payload: {
                status: "success",
                results: items.map((item) => ({
                  id: item.id,
                  success: true,
                  output: {},
                })),
              },
            }),
          );
        });
      vi.spyOn(lambdaPort, "getFunctionNameForLanguage").mockImplementation(
        (language) => `sandbox-${language}`,
      );

      const result = await useCase.execute({
        items: [
          { id: "item-1", macro_id: macroId, workbook_version_id: version1, data: {} },
          { id: "item-2", macro_id: macroId, workbook_version_id: version2, data: {} },
        ],
      });

      assertSuccess(result);
      expect(liveSpy).toHaveBeenCalledWith([]);
      expect(invokeSpy).toHaveBeenCalledTimes(2);
      expect(invokeSpy).toHaveBeenCalledWith(
        "sandbox-python",
        expect.objectContaining({ script: "code-v1" }),
      );
      expect(invokeSpy).toHaveBeenCalledWith(
        "sandbox-javascript",
        expect.objectContaining({ script: "code-v2" }),
      );
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

      // First call: should hit repository (which handles caching internally)
      await useCase.execute({
        items: [{ id: "item-1", macro_id: macro.id, data: {} }],
        timeout: 10,
      });

      expect(findScriptsSpy).toHaveBeenCalledTimes(1);

      // Second call: repository called again, but internal cache serves the data
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

  describe("canonical input normalization", () => {
    // Mirror the Ticket 02 handler contract: one result per valid item, in
    // request order, echoing each request ID, with a distinguishable output.
    function mockEchoLambda() {
      return vi.spyOn(lambdaPort, "invokeLambda").mockImplementation((_fn, payload) => {
        const items = (payload as LambdaExecutionPayload).items;
        return Promise.resolve(
          success({
            statusCode: 200,
            payload: {
              status: "success",
              results: items.map((it) => ({
                id: it.id,
                success: true,
                output: { echo: (it.data as { phi2: number }).phi2 },
              })),
            },
          }),
        );
      });
    }

    it("normalizes a mixed valid/empty/wrapped batch, runs only valid siblings, and preserves order", async () => {
      const macro = await createTestMacro();
      const invokeSpy = mockEchoLambda();
      vi.spyOn(lambdaPort, "getFunctionNameForLanguage").mockReturnValue("test-fn");

      const result = await useCase.execute({
        items: [
          { id: "item-a", macro_id: macro.id, data: { sample: [{ phi2: 0.1 }] } },
          { id: "item-b", macro_id: macro.id, data: { sample: [] } },
          { id: "item-c", macro_id: macro.id, data: { phi2: 0.3 } },
          { id: "item-d", macro_id: macro.id, data: [{ phi2: 0.4 }] },
          { id: "item-e", macro_id: macro.id, data: [] },
        ],
      });

      // Lambda invoked once with only the three valid items, marked canonical.
      expect(invokeSpy).toHaveBeenCalledTimes(1);
      const payload = invokeSpy.mock.calls[0][1] as LambdaExecutionPayload;
      expect(payload.input_contract).toBe("canonical-measurement-v1");
      expect(payload.items).toEqual([
        expect.objectContaining({ id: "item-a", data: { phi2: 0.1 } }),
        expect.objectContaining({ id: "item-c", data: { phi2: 0.3 } }),
        expect.objectContaining({ id: "item-d", data: { phi2: 0.4 } }),
      ]);

      assertSuccess(result);
      expect(result.value.results.map((r) => r.id)).toEqual([
        "item-a",
        "item-b",
        "item-c",
        "item-d",
        "item-e",
      ]);
      const [a, b, c, d, e] = result.value.results;
      expect(a).toMatchObject({ id: "item-a", success: true, output: { echo: 0.1 } });
      expect(b.success).toBe(false);
      expect(b.error).toContain("empty-envelope");
      expect(c).toMatchObject({ id: "item-c", success: true, output: { echo: 0.3 } });
      expect(d).toMatchObject({ id: "item-d", success: true, output: { echo: 0.4 } });
      expect(e.success).toBe(false);
      expect(e.error).toContain("empty-envelope");
      // A per-item empty envelope must not surface as a group-wide error.
      expect(result.value.errors).toBeUndefined();
    });

    it("merges results by original position when item IDs are duplicated or empty", async () => {
      const macro = await createTestMacro();
      mockEchoLambda();
      vi.spyOn(lambdaPort, "getFunctionNameForLanguage").mockReturnValue("test-fn");

      const result = await useCase.execute({
        items: [
          { id: "dup", macro_id: macro.id, data: { phi2: 1 } },
          { id: "dup", macro_id: macro.id, data: { phi2: 2 } },
          { id: "", macro_id: macro.id, data: { phi2: 3 } },
        ],
      });

      assertSuccess(result);
      expect(result.value.results).toHaveLength(3);
      // Position is authoritative: duplicate and empty IDs still resolve to the
      // correct per-position output even though ID cannot disambiguate them.
      expect(result.value.results[0]).toMatchObject({ id: "dup", output: { echo: 1 } });
      expect(result.value.results[1]).toMatchObject({ id: "dup", output: { echo: 2 } });
      expect(result.value.results[2]).toMatchObject({ id: "", output: { echo: 3 } });
    });

    it("restores exact global order across interleaved live, snapshot, and failing groups", async () => {
      const liveMacro = await createTestMacro({ language: "python" });
      const snapshotMacroId = faker.string.uuid();
      const versionId = faker.string.uuid();
      const missingMacroId = faker.string.uuid();

      vi.spyOn(macroSnapshotRepository, "findScriptsByVersionIds").mockResolvedValue(
        success(
          new Map([
            [
              macroSnapshotKey(versionId, snapshotMacroId),
              { id: snapshotMacroId, name: "Pinned", language: "javascript", code: "snap-code" },
            ],
          ]),
        ),
      );
      mockEchoLambda();
      vi.spyOn(lambdaPort, "getFunctionNameForLanguage").mockImplementation(
        (language) => `fn-${language}`,
      );

      // Interleave three groups so Promise.all group-array order cannot equal
      // request order unless a positional global reassembly is performed.
      const result = await useCase.execute({
        items: [
          { id: "A1", macro_id: liveMacro.id, data: { phi2: 1 } },
          {
            id: "S1",
            macro_id: snapshotMacroId,
            workbook_version_id: versionId,
            data: { phi2: 2 },
          },
          { id: "A2", macro_id: liveMacro.id, data: { phi2: 3 } },
          { id: "M1", macro_id: missingMacroId, data: { phi2: 4 } },
          {
            id: "S2",
            macro_id: snapshotMacroId,
            workbook_version_id: versionId,
            data: { phi2: 5 },
          },
        ],
      });

      assertSuccess(result);
      expect(result.value.results.map((r) => r.id)).toEqual(["A1", "S1", "A2", "M1", "S2"]);
      expect(result.value.results[0]).toMatchObject({
        id: "A1",
        success: true,
        output: { echo: 1 },
      });
      expect(result.value.results[1]).toMatchObject({
        id: "S1",
        success: true,
        output: { echo: 2 },
      });
      expect(result.value.results[2]).toMatchObject({
        id: "A2",
        success: true,
        output: { echo: 3 },
      });
      expect(result.value.results[3].success).toBe(false);
      expect(result.value.results[3].error).toContain("Macro not found");
      expect(result.value.results[4]).toMatchObject({
        id: "S2",
        success: true,
        output: { echo: 5 },
      });
    });

    it("calls neither Lambda nor function-name resolution when every item is empty", async () => {
      const macro = await createTestMacro();
      const invokeSpy = mockEchoLambda();
      const getFnSpy = vi
        .spyOn(lambdaPort, "getFunctionNameForLanguage")
        .mockReturnValue("test-fn");

      const result = await useCase.execute({
        items: [
          { id: "e1", macro_id: macro.id, data: { sample: [] } },
          { id: "e2", macro_id: macro.id, data: [] },
        ],
      });

      expect(invokeSpy).not.toHaveBeenCalled();
      expect(getFnSpy).not.toHaveBeenCalled();
      assertSuccess(result);
      expect(result.value.results).toHaveLength(2);
      expect(result.value.results.every((r) => !r.success)).toBe(true);
      expect(result.value.results.every((r) => r.error?.includes("empty-envelope"))).toBe(true);
      expect(result.value.errors).toBeUndefined();
    });

    it("fails the whole group safely when Lambda returns too few results", async () => {
      const macro = await createTestMacro();
      vi.spyOn(lambdaPort, "invokeLambda").mockResolvedValue(
        success({
          statusCode: 200,
          payload: {
            status: "success",
            // Only one result for two valid items (missing trailing/middle).
            results: [{ id: "v1", success: true, output: { echo: 1 } }],
          },
        }),
      );
      vi.spyOn(lambdaPort, "getFunctionNameForLanguage").mockReturnValue("test-fn");

      const result = await useCase.execute({
        items: [
          { id: "v1", macro_id: macro.id, data: { phi2: 1 } },
          { id: "v2", macro_id: macro.id, data: { phi2: 2 } },
        ],
      });

      assertSuccess(result);
      expect(result.value.results).toHaveLength(2);
      expect(result.value.results.every((r) => !r.success)).toBe(true);
      expect(result.value.results.every((r) => r.error?.includes("did not match"))).toBe(true);
      expect(result.value.errors?.[0]).toContain("did not match");
    });

    it("fails the whole group safely when Lambda returns extra results", async () => {
      const macro = await createTestMacro();
      vi.spyOn(lambdaPort, "invokeLambda").mockResolvedValue(
        success({
          statusCode: 200,
          payload: {
            status: "success",
            results: [
              { id: "v1", success: true, output: { echo: 1 } },
              { id: "v2", success: true, output: { echo: 2 } },
            ],
          },
        }),
      );
      vi.spyOn(lambdaPort, "getFunctionNameForLanguage").mockReturnValue("test-fn");

      const result = await useCase.execute({
        items: [{ id: "v1", macro_id: macro.id, data: { phi2: 1 } }],
      });

      assertSuccess(result);
      expect(result.value.results).toHaveLength(1);
      expect(result.value.results[0].success).toBe(false);
      expect(result.value.results[0].error).toContain("did not match");
      expect(result.value.errors?.[0]).toContain("did not match");
    });

    it("fails the whole group safely when Lambda reorders unique results", async () => {
      const macro = await createTestMacro();
      vi.spyOn(lambdaPort, "invokeLambda").mockResolvedValue(
        success({
          statusCode: 200,
          payload: {
            status: "success",
            // Same count, unique IDs swapped: per-position identity check must
            // catch this rather than shift outputs onto the wrong measurement.
            results: [
              { id: "v2", success: true, output: { echo: 2 } },
              { id: "v1", success: true, output: { echo: 1 } },
            ],
          },
        }),
      );
      vi.spyOn(lambdaPort, "getFunctionNameForLanguage").mockReturnValue("test-fn");

      const result = await useCase.execute({
        items: [
          { id: "v1", macro_id: macro.id, data: { phi2: 1 } },
          { id: "v2", macro_id: macro.id, data: { phi2: 2 } },
        ],
      });

      assertSuccess(result);
      expect(result.value.results).toHaveLength(2);
      expect(result.value.results.every((r) => !r.success)).toBe(true);
      expect(result.value.results.every((r) => r.error?.includes("did not match"))).toBe(true);
      expect(result.value.errors?.[0]).toContain("did not match");
    });

    it("logs a content-free per-item warning when additional entries are discarded", async () => {
      const macro = await createTestMacro();
      const warnSpy = vi.spyOn(Logger.prototype, "warn").mockImplementation(() => undefined);
      mockEchoLambda();
      vi.spyOn(lambdaPort, "getFunctionNameForLanguage").mockReturnValue("test-fn");

      const result = await useCase.execute({
        items: [
          {
            id: "multi",
            macro_id: macro.id,
            data: { sample: [{ phi2: 0.9, secretField: "do-not-log" }, { phi2: 0.1 }] },
          },
        ],
      });

      assertSuccess(result);
      // First entry is used for execution.
      expect(result.value.results[0]).toMatchObject({ id: "multi", output: { echo: 0.9 } });

      const warnCall = warnSpy.mock.calls.find(
        ([arg]) =>
          typeof arg === "object" &&
          arg !== null &&
          (arg as { warning?: string }).warning === "additional-items-discarded",
      );
      expect(warnCall).toBeDefined();
      expect(warnCall?.[0]).toMatchObject({
        warning: "additional-items-discarded",
        source: "sample-envelope",
        sourceCount: 2,
        discardedCount: 1,
        itemId: "multi",
        macroId: macro.id,
      });

      const serialized = JSON.stringify(warnSpy.mock.calls);
      expect(serialized).not.toContain("secretField");
      expect(serialized).not.toContain("phi2");
    });

    it("keeps published-snapshot resolution unchanged while marking the event canonical", async () => {
      const macroId = faker.string.uuid();
      const versionId = faker.string.uuid();
      vi.spyOn(macroSnapshotRepository, "findScriptsByVersionIds").mockResolvedValue(
        success(
          new Map([
            [
              macroSnapshotKey(versionId, macroId),
              { id: macroId, name: "Pinned", language: "python", code: "snapshot-code" },
            ],
          ]),
        ),
      );
      const invokeSpy = mockEchoLambda();
      vi.spyOn(lambdaPort, "getFunctionNameForLanguage").mockReturnValue("test-fn");

      const result = await useCase.execute({
        items: [
          {
            id: "snap-1",
            macro_id: macroId,
            workbook_version_id: versionId,
            data: { sample: [{ phi2: 0.6 }] },
          },
        ],
      });

      assertSuccess(result);
      expect(invokeSpy).toHaveBeenCalledWith(
        "test-fn",
        expect.objectContaining({
          input_contract: "canonical-measurement-v1",
          script: "snapshot-code",
          items: [expect.objectContaining({ id: "snap-1", data: { phi2: 0.6 } })],
        }),
      );
    });
  });
});
