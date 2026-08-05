import { describe, it, expect } from "vitest";

import { parseMacroArtifact } from "./macro-artifact";

describe("parseMacroArtifact", () => {
  it("parses valid command and protocol artifacts", () => {
    expect(parseMacroArtifact({ __ojArtifact: "command", version: 1, content: "battery" })).toEqual(
      { __ojArtifact: "command", version: 1, content: "battery" },
    );
    const protocol = parseMacroArtifact({
      __ojArtifact: "protocol",
      version: 1,
      code: [{ _protocol_set_: [] }],
    });
    expect(protocol?.__ojArtifact).toBe("protocol");
  });

  it("returns null for plain data, non-objects, unknown versions, extra keys, empty protocols", () => {
    const rejected: unknown[] = [
      { fvfm: 0.8, value: 1 }, // plain data record (existing macros)
      null,
      "battery",
      42,
      { __ojArtifact: "command", version: 2, content: "x" },
      { __ojArtifact: "command", version: 1, content: "x", evil: true }, // strict: extra keys
      { __ojArtifact: "protocol", version: 1, code: [] },
    ];
    for (const value of rejected) expect(parseMacroArtifact(value)).toBeNull();
  });
});
