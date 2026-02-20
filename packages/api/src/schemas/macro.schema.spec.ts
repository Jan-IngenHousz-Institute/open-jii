import { describe, it, expect } from "vitest";

import {
  zMacroLanguage,
  zMacro,
  zMacroList,
  zMacroFilterQuery,
  zMacroIdPathParam,
  zCreateMacroRequestBody,
  zUpdateMacroRequestBody,
  zMacroErrorResponse,
  zMacroExecutionRequestBody,
  zMacroExecutionResponse,
  zMacroBatchExecutionItem,
  zMacroBatchExecutionRequestBody,
  zMacroBatchExecutionResultItem,
  zMacroBatchExecutionResponse,
  zMacroBatchWebhookErrorResponse,
} from "./macro.schema";

// Reusable fixtures
const uuidA = "11111111-1111-1111-1111-111111111111";
const uuidB = "22222222-2222-2222-2222-222222222222";
const iso = "2024-01-15T10:00:00Z";
const iso2 = "2024-01-15T12:00:00Z";

describe("Macro Schema", () => {
  // --- Enum ---
  describe("zMacroLanguage", () => {
    it("accepts valid enum values", () => {
      expect(zMacroLanguage.parse("python")).toBe("python");
      expect(zMacroLanguage.parse("r")).toBe("r");
      expect(zMacroLanguage.parse("javascript")).toBe("javascript");
    });

    it("rejects invalid enum values", () => {
      expect(() => zMacroLanguage.parse("unknown")).toThrow();
    });
  });

  // --- Macro object & list ---
  describe("zMacro & zMacroList", () => {
    const validCodeString = "def hello():\n    print('Hello')";

    it("valid macro parses", () => {
      const m = {
        id: uuidA,
        name: "Plot Temperature",
        filename: "plot_temp.py",
        description: "Visualize temperature data",
        language: "python",
        code: validCodeString,
        sortOrder: 1,
        createdBy: uuidB,
        createdByName: "Alice",
        createdAt: iso,
        updatedAt: iso2,
      };
      expect(zMacro.parse(m)).toEqual(m);
    });

    it("createdByName is optional", () => {
      const m = {
        id: uuidA,
        name: "Statistical Analysis",
        filename: "stats.r",
        description: null,
        language: "r",
        code: validCodeString,
        sortOrder: 2,
        createdBy: uuidB,
        createdAt: iso,
        updatedAt: iso2,
      };
      expect(zMacro.parse(m)).toEqual(m);
    });

    it("rejects invalid datetime", () => {
      const bad = {
        id: uuidA,
        name: "Bad Time",
        filename: "bad.js",
        description: null,
        language: "javascript",
        code: validCodeString,
        sortOrder: null,
        createdBy: uuidB,
        createdAt: "not-a-date",
        updatedAt: iso2,
      } as unknown;
      expect(() => zMacro.parse(bad)).toThrow();
    });

    it("rejects non-string code", () => {
      const bad = {
        id: uuidA,
        name: "Not String",
        filename: "not.py",
        description: null,
        language: "python",
        code: { step: 1 }, // should be string
        sortOrder: null,
        createdBy: uuidB,
        createdAt: iso,
        updatedAt: iso2,
      } as unknown;
      expect(() => zMacro.parse(bad)).toThrow();
    });

    it("accepts null sortOrder", () => {
      const m = {
        id: uuidA,
        name: "Null Sort",
        filename: "null.py",
        description: null,
        language: "python",
        code: validCodeString,
        sortOrder: null,
        createdBy: uuidB,
        createdAt: iso,
        updatedAt: iso2,
      };
      expect(zMacro.parse(m)).toEqual(m);
    });

    it("zMacroList accepts array of valid macros", () => {
      const m1 = {
        id: uuidA,
        name: "M1",
        filename: "m1.py",
        description: null,
        language: "python",
        code: validCodeString,
        sortOrder: 1,
        createdBy: uuidB,
        createdAt: iso,
        updatedAt: iso2,
      };
      const m2 = {
        ...m1,
        id: "33333333-3333-3333-3333-333333333333",
        name: "M2",
        filename: "m2.r",
        sortOrder: 2,
        language: "r" as const,
      };
      expect(zMacroList.parse([m1, m2])).toEqual([m1, m2]);
    });
  });

  // --- Filter query ---
  describe("zMacroFilterQuery", () => {
    it("parses empty object", () => {
      expect(zMacroFilterQuery.parse({})).toEqual({});
    });

    it("accepts search string", () => {
      const q = { search: "temperature" };
      expect(zMacroFilterQuery.parse(q)).toEqual(q);
    });

    it("accepts language filter", () => {
      const q = { language: "python" };
      expect(zMacroFilterQuery.parse(q)).toEqual(q);
    });

    it("accepts both search and language", () => {
      const q = { search: "plot", language: "r" };
      expect(zMacroFilterQuery.parse(q)).toEqual(q);
    });

    it("rejects non-string search", () => {
      expect(() => zMacroFilterQuery.parse({ search: 123 })).toThrow();
    });

    it("rejects invalid language", () => {
      expect(() => zMacroFilterQuery.parse({ language: "java" })).toThrow();
    });
  });

  // --- Path params ---
  describe("zMacroIdPathParam", () => {
    it("valid id", () => {
      const p = { id: uuidA };
      expect(zMacroIdPathParam.parse(p)).toEqual(p);
    });

    it("rejects invalid uuid", () => {
      expect(() => zMacroIdPathParam.parse({ id: "not-uuid" })).toThrow();
    });
  });

  // --- Create body ---
  describe("zCreateMacroRequestBody", () => {
    const codeStr = "print('Hello')";

    it("minimal valid body", () => {
      const b = {
        name: "My Macro",
        code: codeStr,
        language: "python",
      };
      expect(zCreateMacroRequestBody.parse(b)).toEqual({
        ...b,
        // description is optional (omitted)
      });
    });

    it("full valid body", () => {
      const b = {
        name: "  Data Plotter  ",
        description: "Trimmed name allowed; not auto-trimmed in output",
        code: codeStr,
        language: "r",
      };
      const parsed = zCreateMacroRequestBody.parse(b);
      // `trim()` in zod is applied for validation; output preserves the trimmed version
      expect(parsed.name).toBe("Data Plotter");
      expect(parsed.description).toBe("Trimmed name allowed; not auto-trimmed in output");
      expect(parsed.language).toBe("r");
      expect(parsed.code).toBe(codeStr);
    });

    it("rejects empty/whitespace name", () => {
      expect(() =>
        zCreateMacroRequestBody.parse({ name: "   ", code: codeStr, language: "python" }),
      ).toThrow();
    });

    it("rejects empty code", () => {
      const bad = { name: "X", code: "", language: "python" };
      expect(() => zCreateMacroRequestBody.parse(bad)).toThrow();
    });

    it("rejects invalid language", () => {
      const bad = { name: "X", code: codeStr, language: "weird" };
      expect(() => zCreateMacroRequestBody.parse(bad)).toThrow();
    });
  });

  // --- Update body ---
  describe("zUpdateMacroRequestBody", () => {
    it("allows partial updates", () => {
      const b = { description: "New desc" };
      expect(zUpdateMacroRequestBody.parse(b)).toEqual(b);
    });

    it("trims name when provided", () => {
      const b = { name: "  New Name  " };
      const parsed = zUpdateMacroRequestBody.parse(b);
      expect(parsed.name).toBe("New Name");
    });

    it("rejects empty trimmed name", () => {
      expect(() => zUpdateMacroRequestBody.parse({ name: "   " })).toThrow();
    });

    it("accepts code & language together", () => {
      const b = {
        code: "console.log('hello');",
        language: "javascript" as const,
      };
      expect(zUpdateMacroRequestBody.parse(b)).toEqual(b);
    });

    it("rejects invalid language", () => {
      expect(() => zUpdateMacroRequestBody.parse({ language: "nope" })).toThrow();
    });
  });

  // --- Error response ---
  describe("zMacroErrorResponse", () => {
    it("valid error response", () => {
      const err = { message: "Bad Request", statusCode: 400 };
      expect(zMacroErrorResponse.parse(err)).toEqual(err);
    });

    it("rejects missing fields", () => {
      expect(() => zMacroErrorResponse.parse({ message: "x" })).toThrow();
      expect(() => zMacroErrorResponse.parse({ statusCode: 500 })).toThrow();
    });
  });

  // --- Single Execution ---
  describe("zMacroExecutionRequestBody", () => {
    it("valid body with data and timeout", () => {
      const b = { data: { trace: [1, 2, 3] }, timeout: 30 };
      expect(zMacroExecutionRequestBody.parse(b)).toEqual(b);
    });

    it("timeout is optional", () => {
      const b = { data: {} };
      expect(zMacroExecutionRequestBody.parse(b)).toEqual(b);
    });

    it("rejects timeout below 1", () => {
      expect(() => zMacroExecutionRequestBody.parse({ data: {}, timeout: 0 })).toThrow();
    });

    it("rejects timeout above 60", () => {
      expect(() => zMacroExecutionRequestBody.parse({ data: {}, timeout: 61 })).toThrow();
    });

    it("rejects non-integer timeout", () => {
      expect(() => zMacroExecutionRequestBody.parse({ data: {}, timeout: 1.5 })).toThrow();
    });

    it("rejects missing data", () => {
      expect(() => zMacroExecutionRequestBody.parse({})).toThrow();
    });

    it("accepts data as a JSON string (Databricks serialisation)", () => {
      const b = { data: JSON.stringify({ trace: [1, 2, 3] }), timeout: 5 };
      const parsed = zMacroExecutionRequestBody.parse(b);
      expect(parsed.data).toEqual({ trace: [1, 2, 3] });
    });

    it("rejects data that is an invalid JSON string", () => {
      expect(() => zMacroExecutionRequestBody.parse({ data: "{bad json" })).toThrow();
    });
  });

  describe("zMacroExecutionResponse", () => {
    it("valid success response", () => {
      const r = { macro_id: uuidA, success: true, output: { result: 42 } };
      expect(zMacroExecutionResponse.parse(r)).toEqual(r);
    });

    it("valid failure response", () => {
      const r = { macro_id: uuidA, success: false, error: "Script failed" };
      expect(zMacroExecutionResponse.parse(r)).toEqual(r);
    });

    it("output and error are optional", () => {
      const r = { macro_id: uuidA, success: true };
      expect(zMacroExecutionResponse.parse(r)).toEqual(r);
    });
  });

  // --- Batch Execution ---
  describe("zMacroBatchExecutionItem", () => {
    it("valid item", () => {
      const item = { id: "measurement-1", macro_id: uuidA, data: { trace: [1] } };
      expect(zMacroBatchExecutionItem.parse(item)).toEqual(item);
    });

    it("rejects non-uuid macro_id", () => {
      expect(() =>
        zMacroBatchExecutionItem.parse({ id: "m1", macro_id: "bad", data: {} }),
      ).toThrow();
    });

    it("rejects missing data", () => {
      expect(() => zMacroBatchExecutionItem.parse({ id: "m1", macro_id: uuidA })).toThrow();
    });

    it("accepts data as a JSON string (Databricks serialisation)", () => {
      const item = { id: "m1", macro_id: uuidA, data: JSON.stringify({ trace: [1] }) };
      const parsed = zMacroBatchExecutionItem.parse(item);
      expect(parsed.data).toEqual({ trace: [1] });
    });
  });

  describe("zMacroBatchExecutionRequestBody", () => {
    const validItem = { id: "m1", macro_id: uuidA, data: {} };

    it("valid request with items", () => {
      const b = { items: [validItem], timeout: 10 };
      expect(zMacroBatchExecutionRequestBody.parse(b)).toEqual(b);
    });

    it("timeout is optional", () => {
      const b = { items: [validItem] };
      expect(zMacroBatchExecutionRequestBody.parse(b)).toEqual(b);
    });

    it("rejects empty items array", () => {
      expect(() => zMacroBatchExecutionRequestBody.parse({ items: [] })).toThrow();
    });

    it("rejects items array exceeding 5000", () => {
      const tooMany = Array.from({ length: 5001 }, (_, i) => ({
        id: `m${i}`,
        macro_id: uuidA,
        data: {},
      }));
      expect(() => zMacroBatchExecutionRequestBody.parse({ items: tooMany })).toThrow();
    });

    it("accepts items as a JSON string (Databricks serialisation)", () => {
      const items = [{ id: "m1", macro_id: uuidA, data: { x: 1 } }];
      const b = { items: JSON.stringify(items), timeout: 10 };
      const parsed = zMacroBatchExecutionRequestBody.parse(b);
      expect(parsed.items).toEqual(items);
    });

    it("accepts items as JSON string with stringified data inside", () => {
      const items = [{ id: "m1", macro_id: uuidA, data: JSON.stringify({ trace: [1, 2] }) }];
      const b = { items: JSON.stringify(items), timeout: 5 };
      const parsed = zMacroBatchExecutionRequestBody.parse(b);
      expect(parsed.items[0].data).toEqual({ trace: [1, 2] });
    });

    it("rejects items that is an invalid JSON string", () => {
      expect(() => zMacroBatchExecutionRequestBody.parse({ items: "not valid json" })).toThrow();
    });
  });

  describe("zMacroBatchExecutionResultItem", () => {
    it("valid success result", () => {
      const r = { id: "m1", macro_id: uuidA, success: true, output: { x: 1 } };
      expect(zMacroBatchExecutionResultItem.parse(r)).toEqual(r);
    });

    it("valid failure result", () => {
      const r = { id: "m1", macro_id: uuidA, success: false, error: "not found" };
      expect(zMacroBatchExecutionResultItem.parse(r)).toEqual(r);
    });
  });

  describe("zMacroBatchExecutionResponse", () => {
    it("valid response with results", () => {
      const res = {
        results: [{ id: "m1", macro_id: uuidA, success: true }],
      };
      expect(zMacroBatchExecutionResponse.parse(res)).toEqual(res);
    });

    it("valid response with errors array", () => {
      const res = {
        results: [{ id: "m1", macro_id: uuidA, success: false, error: "fail" }],
        errors: ["Macro not found: abc"],
      };
      expect(zMacroBatchExecutionResponse.parse(res)).toEqual(res);
    });

    it("errors is optional", () => {
      const res = { results: [] };
      expect(zMacroBatchExecutionResponse.parse(res)).toEqual(res);
    });
  });

  describe("zMacroBatchWebhookErrorResponse", () => {
    it("valid error response", () => {
      const err = { error: "VALIDATION_ERROR", message: "Invalid body", statusCode: 400 };
      expect(zMacroBatchWebhookErrorResponse.parse(err)).toEqual(err);
    });

    it("rejects missing error field", () => {
      expect(() =>
        zMacroBatchWebhookErrorResponse.parse({ message: "x", statusCode: 400 }),
      ).toThrow();
    });
  });
});
