import { describe, expect, it } from "vitest";

import { contributorDisplayName } from "./contributor-cells";

describe("contributorDisplayName", () => {
  it("extracts the trimmed name from a contributor struct JSON string", () => {
    const raw = JSON.stringify({ id: "abc", name: "  Ada Lovelace  ", avatar: null });
    expect(contributorDisplayName(raw)).toBe("Ada Lovelace");
  });

  it("falls back to Unknown when the name is empty", () => {
    expect(contributorDisplayName(JSON.stringify({ id: "abc", name: "", avatar: null }))).toBe(
      "Unknown",
    );
  });

  it("falls back to Unknown for a non-string cell", () => {
    expect(contributorDisplayName(null)).toBe("Unknown");
    expect(contributorDisplayName(undefined)).toBe("Unknown");
    expect(contributorDisplayName(42)).toBe("Unknown");
  });

  it("falls back to Unknown for unparseable JSON", () => {
    expect(contributorDisplayName("not json")).toBe("Unknown");
  });
});
