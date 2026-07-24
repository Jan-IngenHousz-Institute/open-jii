import { ORPCError } from "@orpc/client";
import { describe, it, expect } from "vitest";

import { parseStructuralValidationError } from "./publish-error";

const CODE = "WORKBOOK_STRUCTURAL_VALIDATION_FAILED";

// A well-formed issue plus a per-issue sentinel extra that must never survive.
function issue(overrides: Record<string, unknown> = {}) {
  return {
    code: "DYNAMIC_COMMAND_SOURCE_MISSING",
    commandCellId: "cmd-1",
    field: "toDevice",
    index: 2,
    sourceCellId: "gone",
    secretLeak: "TOP-SECRET",
    nested: { token: "should-not-appear" },
    ...overrides,
  };
}

// Build the app-level oRPC error envelope with a top-level sentinel extra too.
function envelope(issues: unknown[], dataExtra: Record<string, unknown> = {}) {
  return { data: { code: CODE, secretTopLevel: "TOP-SECRET", details: { issues }, ...dataExtra } };
}

describe("parseStructuralValidationError", () => {
  it("projects only the allowlisted fields and leaks no extras", () => {
    const result = parseStructuralValidationError(envelope([issue()]));
    expect(result).toEqual([
      {
        code: "DYNAMIC_COMMAND_SOURCE_MISSING",
        commandCellId: "cmd-1",
        field: "toDevice",
        index: 2,
        sourceCellId: "gone",
      },
    ]);
    // No sentinel from the issue or the envelope reaches the projection.
    expect(JSON.stringify(result)).not.toContain("TOP-SECRET");
    expect(JSON.stringify(result)).not.toContain("should-not-appear");
  });

  it("omits the optional sourceCellId when absent rather than inventing it", () => {
    const result = parseStructuralValidationError(envelope([issue({ sourceCellId: undefined })]));
    expect(result?.[0]).not.toHaveProperty("sourceCellId");
  });

  it("reads a real ORPCError instance the same way", () => {
    const error = new ORPCError(CODE, { data: { code: CODE, details: { issues: [issue()] } } });
    const result = parseStructuralValidationError(error);
    expect(result).toHaveLength(1);
    expect(result?.[0].commandCellId).toBe("cmd-1");
  });

  it("drops unknown issue codes; all-unknown yields null (generic path)", () => {
    expect(
      parseStructuralValidationError(envelope([issue({ code: "NOT_A_REAL_CODE" })])),
    ).toBeNull();
  });

  it("keeps valid issues while dropping malformed siblings", () => {
    const result = parseStructuralValidationError(
      envelope([
        issue(),
        issue({ commandCellId: "" }), // empty id -> dropped
        issue({ index: 1.5 }), // non-integer -> dropped
        issue({ field: 42 }), // wrong type -> dropped
        { garbage: true }, // no code -> dropped
      ]),
    );
    expect(result).toHaveLength(1);
    expect(result?.[0].commandCellId).toBe("cmd-1");
  });

  it("returns null for a non-structural code", () => {
    expect(
      parseStructuralValidationError({
        data: { code: "SOMETHING_ELSE", details: { issues: [issue()] } },
      }),
    ).toBeNull();
  });

  it("returns null when details.issues is missing or not an array", () => {
    expect(parseStructuralValidationError({ data: { code: CODE } })).toBeNull();
    expect(
      parseStructuralValidationError({ data: { code: CODE, details: { issues: "nope" } } }),
    ).toBeNull();
  });

  it("returns null for arbitrary errors", () => {
    expect(parseStructuralValidationError(new Error("network"))).toBeNull();
    expect(parseStructuralValidationError(null)).toBeNull();
    expect(parseStructuralValidationError("boom")).toBeNull();
  });

  describe("adversarial / hostile inputs (total, own-property-safe)", () => {
    it("rejects an issue whose required fields live on the prototype (inherited carrier)", () => {
      const inherited = Object.create({
        code: "DYNAMIC_COMMAND_SOURCE_MISSING",
        commandCellId: "INHERITED_SENTINEL",
        field: "toDevice",
        index: 1,
      }) as Record<string, unknown>;
      const result = parseStructuralValidationError(envelope([inherited]));
      expect(result).toBeNull();
      expect(JSON.stringify(result)).not.toContain("INHERITED_SENTINEL");
    });

    it("rejects an envelope whose data is an inherited carrier", () => {
      const data = Object.create({
        code: CODE,
        details: { issues: [issue()] },
      }) as Record<string, unknown>;
      expect(parseStructuralValidationError({ data })).toBeNull();
    });

    it("does not throw and returns null when a required field is a throwing getter", () => {
      const hostile: Record<string, unknown> = {
        commandCellId: "cmd-1",
        field: "toDevice",
        index: 1,
      };
      Object.defineProperty(hostile, "code", {
        enumerable: true,
        configurable: true,
        get() {
          throw new Error("getter boom");
        },
      });
      expect(() => parseStructuralValidationError(envelope([hostile]))).not.toThrow();
      expect(parseStructuralValidationError(envelope([hostile]))).toBeNull();
    });

    it("does not throw when the top-level error is a proxy with throwing traps", () => {
      const proxy = new Proxy(
        {},
        {
          get() {
            throw new Error("get boom");
          },
          getOwnPropertyDescriptor() {
            throw new Error("descriptor boom");
          },
        },
      );
      expect(() => parseStructuralValidationError(proxy)).not.toThrow();
      expect(parseStructuralValidationError(proxy)).toBeNull();
    });

    it("does not throw when an issue is a proxy with throwing traps", () => {
      const proxyIssue = new Proxy(
        {},
        {
          getOwnPropertyDescriptor() {
            throw new Error("descriptor boom");
          },
        },
      );
      expect(() => parseStructuralValidationError(envelope([proxyIssue]))).not.toThrow();
      expect(parseStructuralValidationError(envelope([proxyIssue]))).toBeNull();
    });

    it("rejects a null-prototype issue object", () => {
      const nullProto = Object.assign(Object.create(null) as Record<string, unknown>, {
        code: "DYNAMIC_COMMAND_SOURCE_MISSING",
        commandCellId: "cmd-1",
        field: "toDevice",
        index: 1,
      });
      expect(parseStructuralValidationError(envelope([nullProto]))).toBeNull();
    });

    it("rejects arrays supplied where objects are expected (data/details/issue)", () => {
      expect(parseStructuralValidationError({ data: [] })).toBeNull();
      expect(parseStructuralValidationError({ data: { code: CODE, details: [] } })).toBeNull();
      expect(parseStructuralValidationError(envelope([[issue()]]))).toBeNull();
    });

    it("rejects an issue whose sourceCellId is a hostile accessor rather than reading it", () => {
      const hostile: Record<string, unknown> = {
        code: "DYNAMIC_COMMAND_SOURCE_MISSING",
        commandCellId: "cmd-1",
        field: "toDevice",
        index: 1,
      };
      Object.defineProperty(hostile, "sourceCellId", {
        enumerable: true,
        configurable: true,
        get() {
          throw new Error("source getter boom");
        },
      });
      // The accessor is treated as absent (never invoked); the issue is still
      // valid and simply carries no sourceCellId.
      const result = parseStructuralValidationError(envelope([hostile]));
      expect(result).toHaveLength(1);
      expect(result?.[0]).not.toHaveProperty("sourceCellId");
    });
  });
});
