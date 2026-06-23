import { describe, it, expect } from "vitest";

import { resolveInlineCommand, validateInlineCommand } from "./command-payload";

describe("resolveInlineCommand", () => {
  it("returns a raw string unchanged", () => {
    expect(resolveInlineCommand({ format: "string", content: "battery" })).toBe("battery");
  });

  it("parses json content into an object/array", () => {
    expect(resolveInlineCommand({ format: "json", content: '[{"c":1}]' })).toEqual([{ c: 1 }]);
  });

  it("parses yaml content into an object/array", () => {
    expect(resolveInlineCommand({ format: "yaml", content: "- c: 1\n- c: 2" })).toEqual([
      { c: 1 },
      { c: 2 },
    ]);
  });

  it("throws on malformed json", () => {
    expect(() => resolveInlineCommand({ format: "json", content: "{not json" })).toThrow();
  });
});

describe("validateInlineCommand", () => {
  it("flags empty content", () => {
    const result = validateInlineCommand({ format: "string", content: "   " });
    expect(result.ok).toBe(false);
  });

  it("returns the resolved value for valid yaml", () => {
    const result = validateInlineCommand({ format: "yaml", content: "a: 1" });
    expect(result).toEqual({ ok: true, value: { a: 1 } });
  });

  it("returns an error message for invalid json instead of throwing", () => {
    const result = validateInlineCommand({ format: "json", content: "[" });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(typeof result.error).toBe("string");
  });
});
