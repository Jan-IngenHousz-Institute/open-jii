import { describe, expect, it } from "vitest";

import { formatList } from "./format-list";

describe("formatList", () => {
  // A rig line reads as one sentence, not a run of names glued with "·".
  it("joins two names with the locale's own word for and", () => {
    expect(formatList("en-US", ["par_raw", "par_ref"])).toBe("par_raw and par_ref");
  });

  it("puts a comma before the last name once there are three or more", () => {
    expect(formatList("en-US", ["par", "par_raw", "spec_raw"])).toBe("par, par_raw, and spec_raw");
  });

  it("is just the name for a list of one", () => {
    expect(formatList("en-US", ["channels"])).toBe("channels");
  });

  it("uses the conjunction the locale asks for", () => {
    expect(formatList("nl-NL", ["par_raw", "par_ref"])).toBe("par_raw en par_ref");
  });
});
