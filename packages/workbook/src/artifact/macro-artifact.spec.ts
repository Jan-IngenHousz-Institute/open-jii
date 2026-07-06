import { describe, it, expect } from "vitest";

import { parseMacroArtifact } from "./macro-artifact";

describe("parseMacroArtifact", () => {
  it("returns null for a plain data record (existing macros)", () => {
    expect(parseMacroArtifact({ fvfm: 0.8, value: 1 })).toBeNull();
  });

  it("returns null for non-objects", () => {
    expect(parseMacroArtifact(null)).toBeNull();
    expect(parseMacroArtifact("battery")).toBeNull();
    expect(parseMacroArtifact(42)).toBeNull();
  });

  it("parses a valid command artifact", () => {
    const a = parseMacroArtifact({ __ojArtifact: "command", version: 1, content: "battery" });
    expect(a).toEqual({ __ojArtifact: "command", version: 1, content: "battery" });
  });

  it("parses a valid protocol artifact", () => {
    const a = parseMacroArtifact({
      __ojArtifact: "protocol",
      version: 1,
      code: [{ _protocol_set_: [] }],
    });
    expect(a?.__ojArtifact).toBe("protocol");
  });

  it("returns null for an unknown version", () => {
    expect(parseMacroArtifact({ __ojArtifact: "command", version: 2, content: "x" })).toBeNull();
  });

  it("returns null for a tagged value with extra keys (strict)", () => {
    expect(
      parseMacroArtifact({ __ojArtifact: "command", version: 1, content: "x", evil: true }),
    ).toBeNull();
  });

  it("returns null for an empty protocol", () => {
    expect(parseMacroArtifact({ __ojArtifact: "protocol", version: 1, code: [] })).toBeNull();
  });
});
