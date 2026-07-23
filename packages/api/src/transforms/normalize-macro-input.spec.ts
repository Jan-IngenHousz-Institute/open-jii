import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

import {
  MACRO_INPUT_ERROR_CODES,
  MACRO_INPUT_SOURCES,
  MACRO_INPUT_WARNING_CODES,
  normalizeMacroInput,
} from "./normalize-macro-input";
import type { NormalizeMacroInputResult } from "./normalize-macro-input";

interface NormalizationFixture {
  fixtureVersion: number;
  vocabulary: {
    sources: string[];
    warnings: string[];
    errors: string[];
  };
  cases: {
    name: string;
    input: unknown;
    expected: NormalizeMacroInputResult;
  }[];
}

const fixtures = JSON.parse(
  readFileSync(resolve(__dirname, "../../fixtures/macro-input-normalization.json"), "utf8"),
) as NormalizationFixture;

describe("normalizeMacroInput", () => {
  it.each(fixtures.cases)("normalizes $name", ({ input, expected }) => {
    expect(normalizeMacroInput(input)).toEqual(expected);
  });

  it("keeps the serialized fixture vocabulary aligned with exported constants", () => {
    expect(fixtures.fixtureVersion).toBe(1);
    expect(fixtures.vocabulary).toEqual({
      sources: MACRO_INPUT_SOURCES,
      warnings: MACRO_INPUT_WARNING_CODES,
      errors: MACRO_INPUT_ERROR_CODES,
    });
  });

  it("uses only an own sample property", () => {
    const inheritedSample = [{ value: "inherited" }];
    const target = Object.create({ sample: inheritedSample }) as Record<string, unknown>;
    target.value = "direct";
    const input = new Proxy(target, {
      getPrototypeOf: () => Object.prototype,
    });

    expect(Object.getPrototypeOf(input)).toBe(Object.prototype);
    expect(Object.getOwnPropertyDescriptor(input, "sample")).toBeUndefined();
    expect(input.sample).toBe(inheritedSample);
    expect(Object.prototype.hasOwnProperty.call(input, "sample")).toBe(false);

    const result = normalizeMacroInput(input);

    expect(result).toEqual({ ok: true, value: input, source: "direct", discardedCount: 0 });
  });

  it("recognizes a plain JSON object with a null prototype", () => {
    const measurement = { value: 16 };
    const envelope = Object.create(null) as Record<string, unknown>;
    envelope.sample = measurement;

    expect(normalizeMacroInput(envelope)).toEqual({
      ok: true,
      value: measurement,
      source: "sample-envelope",
      sourceCount: 1,
      discardedCount: 0,
    });
  });

  it("does not treat a class instance as a plain JSON envelope", () => {
    class EnvelopeLookalike {
      sample = [{ value: 17 }];
    }
    const input = new EnvelopeLookalike();

    expect(normalizeMacroInput(input)).toEqual({
      ok: true,
      value: input,
      source: "direct",
      discardedCount: 0,
    });
  });

  it("does not mutate or clone a direct value", () => {
    const input = Object.freeze({ nested: Object.freeze({ value: 18 }) });
    const before = JSON.stringify(input);
    const result = normalizeMacroInput(input);

    expect(result.ok).toBe(true);
    if (!result.ok) throw new Error("expected a successful direct result");
    expect(result.value).toBe(input);
    expect(JSON.stringify(input)).toBe(before);
  });

  it("does not mutate or clone the selected envelope value", () => {
    const first = Object.freeze({ value: 19 });
    const second = Object.freeze({ value: 20 });
    const input = Object.freeze({ sample: Object.freeze([first, second]) });
    const before = JSON.stringify(input);
    const result = normalizeMacroInput(input);

    expect(result.ok).toBe(true);
    if (!result.ok) throw new Error("expected a successful envelope result");
    expect(result.value).toBe(first);
    expect(JSON.stringify(input)).toBe(before);
  });
});
