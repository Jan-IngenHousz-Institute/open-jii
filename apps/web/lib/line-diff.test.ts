import { describe, it, expect } from "vitest";

import { lineDiff, hasChanges } from "./line-diff";

describe("lineDiff", () => {
  it("marks identical text as unchanged", () => {
    const result = lineDiff("a\nb\nc", "a\nb\nc");
    expect(result.every((l) => l.type === "same")).toBe(true);
    expect(hasChanges(result)).toBe(false);
  });

  it("detects an inserted line", () => {
    const result = lineDiff("a\nc", "a\nb\nc");
    expect(result).toEqual([
      { type: "same", text: "a" },
      { type: "add", text: "b" },
      { type: "same", text: "c" },
    ]);
    expect(hasChanges(result)).toBe(true);
  });

  it("detects a removed line", () => {
    const result = lineDiff("a\nb\nc", "a\nc");
    expect(result).toEqual([
      { type: "same", text: "a" },
      { type: "del", text: "b" },
      { type: "same", text: "c" },
    ]);
  });

  it("represents an edit as a delete + add", () => {
    const result = lineDiff("hello", "world");
    expect(result).toEqual([
      { type: "del", text: "hello" },
      { type: "add", text: "world" },
    ]);
  });

  it("treats empty text as zero lines", () => {
    expect(lineDiff("", "a")).toEqual([{ type: "add", text: "a" }]);
    expect(lineDiff("a", "")).toEqual([{ type: "del", text: "a" }]);
    expect(lineDiff("", "")).toEqual([]);
  });
});
