import { createHash } from "crypto";
import { describe, expect, it } from "vitest";

import { deriveMacroFilename } from "./derive-macro-filename";

// The backend stores filename = "macro_" + sha256(id).hex.slice(0,12)
// (generateHashedFilename). This must match byte-for-byte or the measurement's
// macro routing key (sample.macros) would point at the wrong table.
function backendFilename(macroId: string): string {
  return `macro_${createHash("sha256").update(macroId).digest("hex").substring(0, 12)}`;
}

describe("deriveMacroFilename", () => {
  it.each([
    "11111111-2222-3333-4444-555555555555",
    "a3f9c2e1-0000-4abc-9def-0123456789ab",
    "00000000-0000-0000-0000-000000000000",
  ])("matches the backend generateHashedFilename for %s", (id) => {
    expect(deriveMacroFilename(id)).toBe(backendFilename(id));
  });

  it("is deterministic and prefixed", () => {
    const id = "deadbeef-dead-beef-dead-beefdeadbeef";
    expect(deriveMacroFilename(id)).toBe(deriveMacroFilename(id));
    expect(deriveMacroFilename(id)).toMatch(/^macro_[0-9a-f]{12}$/);
  });
});
