import { describe, it, expect } from "vitest";

import { resolveInlineCommand, validateInlineCommand } from "./command-payload";

describe("resolveInlineCommand", () => {
  it("returns strings unchanged, parses json/yaml, and throws on malformed json", () => {
    expect(resolveInlineCommand({ format: "string", content: "battery" })).toBe("battery");
    expect(resolveInlineCommand({ format: "json", content: '[{"c":1}]' })).toEqual([{ c: 1 }]);
    expect(resolveInlineCommand({ format: "yaml", content: "- c: 1\n- c: 2" })).toEqual([
      { c: 1 },
      { c: 2 },
    ]);
    expect(() => resolveInlineCommand({ format: "json", content: "{not json" })).toThrow();
  });
});

describe("validateInlineCommand", () => {
  it("flags empty content and bad json as errors; returns the resolved value otherwise", () => {
    expect(validateInlineCommand({ format: "string", content: "   " }).ok).toBe(false);
    expect(validateInlineCommand({ format: "yaml", content: "a: 1" })).toEqual({
      ok: true,
      value: { a: 1 },
    });
    const invalid = validateInlineCommand({ format: "json", content: "[" });
    expect(invalid.ok).toBe(false);
    if (!invalid.ok) expect(typeof invalid.error).toBe("string");
  });
});
