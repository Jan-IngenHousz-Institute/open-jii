import { describe, it, expect } from "vitest";

import {
  zSensorFamily,
  zCommand,
  zCommandList,
  zCommandFilterQuery,
  zCommandIdPathParam,
  zCreateCommandRequestBody,
  zUpdateCommandRequestBody,
  zCommandErrorResponse,
} from "./command.schema";

// Reusable fixtures
const uuidA = "11111111-1111-1111-1111-111111111111";
const uuidB = "22222222-2222-2222-2222-222222222222";
const iso = "2024-01-15T10:00:00Z";
const iso2 = "2024-01-15T12:00:00Z";

describe("Command Schema", () => {
  // --- Enum ---
  describe("zSensorFamily", () => {
    it("accepts valid enum values", () => {
      expect(zSensorFamily.parse("multispeq")).toBe("multispeq");
      expect(zSensorFamily.parse("ambyte")).toBe("ambyte");
      expect(zSensorFamily.parse("generic")).toBe("generic");
    });

    it("rejects invalid enum values", () => {
      expect(() => zSensorFamily.parse("unknown")).toThrow();
    });
  });

  // --- Command object & list ---
  describe("zCommand & zCommandList", () => {
    const validCodeArray = [{ step: 1 }, { nested: { x: 42 } }];

    it("valid command parses", () => {
      const p = {
        id: uuidA,
        name: "Fv/FM Baseline",
        description: "Dark adaptation",
        code: validCodeArray,
        family: "multispeq",
        sortOrder: 1,
        createdBy: uuidB,
        createdByName: "Alice",
        createdAt: iso,
        updatedAt: iso2,
      };
      expect(zCommand.parse(p)).toEqual(p);
    });

    it("createdByName is optional", () => {
      const p = {
        id: uuidA,
        name: "Ambient Light",
        description: null,
        code: validCodeArray,
        family: "multispeq",
        sortOrder: 2,
        createdBy: uuidB,
        createdAt: iso,
        updatedAt: iso2,
      };
      expect(zCommand.parse(p)).toEqual(p);
    });

    it("rejects invalid datetime", () => {
      const bad = {
        id: uuidA,
        name: "Bad Time",
        description: null,
        code: validCodeArray,
        family: "multispeq",
        createdBy: uuidB,
        createdAt: "not-a-date",
        updatedAt: iso2,
      } as unknown;
      expect(() => zCommand.parse(bad)).toThrow();
    });

    it("rejects non-array code", () => {
      const bad = {
        id: uuidA,
        name: "Not Array",
        description: null,
        code: { step: 1 }, // should be array of records
        family: "multispeq",
        createdBy: uuidB,
        createdAt: iso,
        updatedAt: iso2,
      } as unknown;
      expect(() => zCommand.parse(bad)).toThrow();
    });

    it("rejects array with non-record element in code", () => {
      const bad = {
        id: uuidA,
        name: "Mixed Bad",
        description: null,
        code: [{ ok: true }, "nope"],
        family: "multispeq",
        createdBy: uuidB,
        createdAt: iso,
        updatedAt: iso2,
      } as unknown;
      expect(() => zCommand.parse(bad)).toThrow();
    });

    it("zCommandList accepts array of valid commands", () => {
      const p1 = {
        id: uuidA,
        name: "P1",
        description: null,
        code: validCodeArray,
        family: "multispeq",
        sortOrder: 1,
        createdBy: uuidB,
        createdAt: iso,
        updatedAt: iso2,
      };
      const p2 = {
        ...p1,
        id: "33333333-3333-3333-3333-333333333333",
        name: "P2",
        sortOrder: 2,
        family: "multispeq" as const,
      };
      expect(zCommandList.parse([p1, p2])).toEqual([p1, p2]);
    });
  });

  // --- Filter query ---
  describe("zCommandFilterQuery", () => {
    it("parses empty object", () => {
      expect(zCommandFilterQuery.parse({})).toEqual({});
    });

    it("accepts search string", () => {
      const q = { search: "fvfm" };
      expect(zCommandFilterQuery.parse(q)).toEqual(q);
    });

    it("rejects non-string search", () => {
      expect(() => zCommandFilterQuery.parse({ search: 123 })).toThrow();
    });
  });

  // --- Path params ---
  describe("zCommandIdPathParam", () => {
    it("valid id", () => {
      const p = { id: uuidA };
      expect(zCommandIdPathParam.parse(p)).toEqual(p);
    });

    it("rejects invalid uuid", () => {
      expect(() => zCommandIdPathParam.parse({ id: "not-uuid" })).toThrow();
    });
  });

  // --- Create body ---
  describe("zCreateCommandRequestBody", () => {
    const codeArr = [{ step: "init" }];

    it("minimal valid body", () => {
      const b = {
        name: "My Command",
        code: codeArr,
        family: "multispeq",
      };
      expect(zCreateCommandRequestBody.parse(b)).toEqual({
        ...b,
        // description is optional (omitted)
      });
    });

    it("full valid body", () => {
      const b = {
        name: "  Ambient Command  ",
        description: "Trimmed name allowed; not auto-trimmed in output",
        code: [{ a: 1 }, { b: 2 }],
        family: "multispeq",
      };
      const parsed = zCreateCommandRequestBody.parse(b);
      // `trim()` in zod is applied for validation; output preserves the trimmed version
      expect(parsed.name).toBe("Ambient Command");
      expect(parsed.description).toBe("Trimmed name allowed; not auto-trimmed in output");
      expect(parsed.family).toBe("multispeq");
      expect(parsed.code.length).toBe(2);
    });

    it("rejects empty/whitespace name", () => {
      expect(() =>
        zCreateCommandRequestBody.parse({ name: "   ", code: [], family: "multispeq" }),
      ).toThrow();
    });

    it("rejects code not array", () => {
      const bad = { name: "X", code: { step: 1 }, family: "multispeq" };
      expect(() => zCreateCommandRequestBody.parse(bad)).toThrow();
    });

    it("rejects invalid family", () => {
      const bad = { name: "X", code: [], family: "weird" };
      expect(() => zCreateCommandRequestBody.parse(bad)).toThrow();
    });
  });

  // --- Update body ---
  describe("zUpdateCommandRequestBody", () => {
    it("allows partial updates", () => {
      const b = { description: "New desc" };
      expect(zUpdateCommandRequestBody.parse(b)).toEqual(b);
    });

    it("trims name when provided", () => {
      const b = { name: "  New Name  " };
      const parsed = zUpdateCommandRequestBody.parse(b);
      expect(parsed.name).toBe("New Name");
    });

    it("rejects empty trimmed name", () => {
      expect(() => zUpdateCommandRequestBody.parse({ name: "   " })).toThrow();
    });

    it("accepts code array & family together", () => {
      const b = {
        code: [{ step: 1 }, { step: 2 }],
        family: "multispeq" as const,
      };
      expect(zUpdateCommandRequestBody.parse(b)).toEqual(b);
    });

    it("rejects non-array code", () => {
      expect(() => zUpdateCommandRequestBody.parse({ code: {} })).toThrow();
    });

    it("rejects invalid family", () => {
      expect(() => zUpdateCommandRequestBody.parse({ family: "nope" })).toThrow();
    });
  });

  // --- Error response ---
  describe("zCommandErrorResponse", () => {
    it("valid error response", () => {
      const err = { message: "Bad Request", statusCode: 400 };
      expect(zCommandErrorResponse.parse(err)).toEqual(err);
    });

    it("rejects missing fields", () => {
      expect(() => zCommandErrorResponse.parse({ message: "x" })).toThrow();
      expect(() => zCommandErrorResponse.parse({ statusCode: 500 })).toThrow();
    });
  });
});
