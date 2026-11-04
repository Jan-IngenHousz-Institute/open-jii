import { describe, expect, it } from "vitest";

import vectors from "../../fixtures/number-answers.json";
import { isNumberAnswer } from "./number-answer";

describe("number answers", () => {
  it.each(vectors)("validates $input", ({ input, value }) => {
    expect(isNumberAnswer(input)).toBe(value !== null);
  });
});
