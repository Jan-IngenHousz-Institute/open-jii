import { describe, expect, it } from "vitest";

import { sanitizeQuestionLabel, stripSpecialCharacters } from "./label-sanitization";

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

  it("returns an empty string for empty input", () => {
    expect(stripSpecialCharacters("")).toBe("");
  });
});

describe("sanitizeQuestionLabel", () => {
  it("canonicalizes a stripped name to a stable column key", () => {
    expect(sanitizeQuestionLabel("Soil moisture")).toBe("soil_moisture");
    expect(sanitizeQuestionLabel("weather1")).toBe("weather1");
  });

  it("returns question_empty for an empty label", () => {
    expect(sanitizeQuestionLabel("")).toBe("question_empty");
  });

  it("collapses runs of disallowed characters to a single underscore", () => {
    expect(sanitizeQuestionLabel("Plant Height (cm)")).toBe("plant_height_cm");
    expect(sanitizeQuestionLabel("a---b   c")).toBe("a_b_c");
  });

  it("trims leading and trailing underscores", () => {
    expect(sanitizeQuestionLabel("  hello  ")).toBe("hello");
    expect(sanitizeQuestionLabel("__weird__")).toBe("weird");
  });

  it("prefixes labels that would start with a digit", () => {
    expect(sanitizeQuestionLabel("123abc")).toBe("question_123abc");
  });

  it("prefixes when every character is disallowed and collapses away", () => {
    expect(sanitizeQuestionLabel("!!!")).toBe("question_");
    expect(sanitizeQuestionLabel("çé·")).toBe("question_");
  });
});
