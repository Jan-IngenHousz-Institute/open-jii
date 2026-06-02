import { describe, expect, it } from "vitest";

import { sanitizeQuestionLabel, stripSpecialCharacters } from "./experiment.schema";

describe("stripSpecialCharacters", () => {
  it("keeps letters, digits, underscores and spaces", () => {
    expect(stripSpecialCharacters("Soil moisture_2")).toBe("Soil moisture_2");
  });

  it("removes characters outside the allowlist", () => {
    expect(stripSpecialCharacters("weather1ç")).toBe("weather1");
    expect(stripSpecialCharacters("Plant Height (cm)")).toBe("Plant Height cm");
    expect(stripSpecialCharacters("a—b·c")).toBe("abc");
  });

  it("returns an empty string when every character is stripped", () => {
    expect(stripSpecialCharacters("çé—·")).toBe("");
  });
});

describe("sanitizeQuestionLabel", () => {
  it("canonicalizes a stripped name to a stable column key", () => {
    // After stripSpecialCharacters the displayed name maps predictably here.
    expect(sanitizeQuestionLabel("Soil moisture")).toBe("soil_moisture");
    expect(sanitizeQuestionLabel("weather1")).toBe("weather1");
  });
});
