import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { LogEntry } from "~/shared/observability/logger";
import { addLogSink, getMinLogLevel, setMinLogLevel } from "~/shared/observability/logger";

import { applyMacro } from "./process-scan";
import { registerPythonMacroRunner } from "./python-macro-runner";

// The raw `.txt` import is resolved by the Metro asset system at runtime;
// in Node/Vitest it has no loader, so stub it with an opaque module handle.
vi.mock("./math.lib.js.txt", () => ({
  default: "mock-math-lib-asset",
}));

// `Asset.fromModule(...).downloadAsync()` + `new File(path).text()` together
// load `math.lib.js.txt` into `mathLibSourcePromise`. For these tests we don't
// exercise math-lib helpers, so resolve with an empty string.
vi.mock("expo-asset", () => ({
  Asset: {
    fromModule: vi.fn(() => ({
      downloadAsync: vi.fn(() => Promise.resolve()),
      localUri: "/mock/math.lib.js.txt",
      uri: "/mock/math.lib.js.txt",
    })),
  },
}));

// `new File(path)` is invoked with `new`. Arrow functions aren't constructible,
// so we declare a class.
vi.mock("expo-file-system", () => ({
  File: class {
    text() {
      return Promise.resolve("");
    }
  },
}));

const encode = (code: string) => Buffer.from(code, "utf8").toString("base64");

afterEach(() => {
  registerPythonMacroRunner(null);
});

describe("applyMacro: input isolation (OJD-1463)", () => {
  describe("JavaScript macros", () => {
    it("does not mutate top-level scalar properties on the original sample", async () => {
      const sample = { meta: "original", phi2: 0.5 };
      const result = { sample };

      const code = encode(`
        json.meta = "mutated";
        json.phi2 = -1;
        return { ok: true };
      `);

      const [out] = await applyMacro(result, { code, language: "javascript" });

      // Macro saw its own copy and was free to mutate it.
      expect(out).toEqual({ ok: true });
      // Original is untouched.
      expect(sample).toEqual({ meta: "original", phi2: 0.5 });
    });

    it("does not mutate array elements on the original sample", async () => {
      const sample = { data_raw: [1, 2, 3, 4, 5] };
      const result = { sample };

      const code = encode(`
        for (var i = 0; i < json.data_raw.length; i++) {
          json.data_raw[i] = -json.data_raw[i];
        }
        json.data_raw.push(999);
        return { ok: true };
      `);

      await applyMacro(result, { code, language: "javascript" });

      expect(sample.data_raw).toEqual([1, 2, 3, 4, 5]);
    });

    it("does not mutate nested objects on the original sample", async () => {
      const sample = {
        nested: { phi2: 0.5, deep: { value: 42 } },
      };
      const result = { sample };

      const code = encode(`
        json.nested.phi2 = -1;
        json.nested.deep.value = 0;
        delete json.nested.deep;
        return { ok: true };
      `);

      await applyMacro(result, { code, language: "javascript" });

      expect(sample.nested.phi2).toBe(0.5);
      expect(sample.nested.deep).toEqual({ value: 42 });
    });

    it("runs once for a multi-entry envelope and leaves both source entries isolated", async () => {
      const sample1 = { data_raw: [1, 2, 3] };
      const sample2 = { data_raw: [4, 5, 6] };
      const result = { sample: [sample1, sample2] };

      const code = encode(`
        json.data_raw[0] = 999;
        return { first: json.data_raw[0] };
      `);

      const outputs = await applyMacro(result, { code, language: "javascript" });

      expect(outputs).toEqual([{ first: 999 }]);
      expect(sample1.data_raw).toEqual([1, 2, 3]);
      expect(sample2.data_raw).toEqual([4, 5, 6]);
    });

    it("gives the macro a different object reference than the original sample", async () => {
      const sample = { marker: { tag: "original" } };
      const result = { sample };

      // Smuggle the `json` reference out of the macro so we can assert on it.
      let macroSawReference: unknown = null;
      const code = encode(`
        json.__capturedBy = "macro";
        return { capturedRef: json };
      `);

      const [out] = await applyMacro(result, { code, language: "javascript" });
      macroSawReference = (out as { capturedRef: unknown }).capturedRef;

      expect(macroSawReference).not.toBe(sample);
      expect(sample).toEqual({ marker: { tag: "original" } });
    });
  });

  describe("Python macros", () => {
    beforeEach(() => {
      registerPythonMacroRunner(null);
    });

    it("does not mutate the original sample even if the Python runner mutates its arg", async () => {
      const sample = { meta: "original", data_raw: [1, 2, 3] };
      const result = { sample };

      let receivedRef: unknown = null;
      registerPythonMacroRunner((_code, json) => {
        receivedRef = json;
        (json as { meta: string }).meta = "mutated-by-python";
        (json as { data_raw: number[] }).data_raw[0] = 999;
        return Promise.resolve({ ok: true });
      });

      await applyMacro(result, {
        code: encode("# python body irrelevant; runner is mocked"),
        language: "python",
      });

      // The runner must have received a clone, not the caller's reference.
      expect(receivedRef).not.toBe(sample);
      // Original must still be intact.
      expect(sample).toEqual({ meta: "original", data_raw: [1, 2, 3] });
    });

    it("runs once for a multi-entry envelope and leaves both source entries isolated", async () => {
      const sample1 = { data_raw: [1, 2, 3] };
      const sample2 = { data_raw: [4, 5, 6] };
      const result = { sample: [sample1, sample2] };

      const runner = vi.fn((_code: string, json: unknown) => {
        (json as { data_raw: number[] }).data_raw[0] = 999;
        return Promise.resolve({ ok: true });
      });
      registerPythonMacroRunner(runner);

      await applyMacro(result, {
        code: encode("# irrelevant"),
        language: "python",
      });

      expect(runner).toHaveBeenCalledTimes(1);
      expect(sample1.data_raw).toEqual([1, 2, 3]);
      expect(sample2.data_raw).toEqual([4, 5, 6]);
    });
  });
});

describe("applyMacro: canonical once-per-measurement execution", () => {
  const jsRunnerCode = encode(`
    globalThis.__mobileMacroRunnerCalls = (globalThis.__mobileMacroRunnerCalls || 0) + 1;
    return { received: json };
  `);

  beforeEach(() => {
    (globalThis as Record<string, unknown>).__mobileMacroRunnerCalls = 0;
  });

  afterEach(() => {
    delete (globalThis as Record<string, unknown>).__mobileMacroRunnerCalls;
  });

  it.each([
    ["an empty direct object", {}, {}],
    ["a direct measurement", { phi2: 0.8 }, { phi2: 0.8 }],
    ["a sample object", { sample: { phi2: 0.7 } }, { phi2: 0.7 }],
    ["a sample array", { sample: [{ phi2: 0.6 }] }, { phi2: 0.6 }],
    ["an empty top-level array", [], []],
    ["a single-item top-level array", [{ phi2: 0.5 }], [{ phi2: 0.5 }]],
    [
      "a multi-item top-level array",
      [{ phi2: 0.5 }, { phi2: 0.2 }],
      [{ phi2: 0.5 }, { phi2: 0.2 }],
    ],
    ["a nested top-level array", [[{ phi2: 0.8 }]], [[{ phi2: 0.8 }]]],
    [
      "a nested sample-array value",
      { sample: [{ sample: [{ phi2: 0.8 }] }] },
      { sample: [{ phi2: 0.8 }] },
    ],
    [
      "a nested sample-object value",
      { sample: { sample: { phi2: 0.8 } } },
      { sample: { phi2: 0.8 } },
    ],
  ])("invokes JavaScript once for %s", async (_label, input, expected) => {
    const outputs = await applyMacro(input, { code: jsRunnerCode, language: "javascript" });

    expect(outputs).toEqual([{ received: expected }]);
    expect((globalThis as Record<string, unknown>).__mobileMacroRunnerCalls).toBe(1);
  });

  it("selects only the first entry and emits content-free warning metadata", async () => {
    const entries: LogEntry[] = [];
    const previousLevel = getMinLogLevel();
    setMinLogLevel("warn");
    const removeSink = addLogSink({ write: (entry) => entries.push(entry) });

    try {
      const outputs = await applyMacro(
        { sample: [{ phi2: 0.8, secret: "must-not-be-logged" }, { phi2: 0.2 }] },
        { code: jsRunnerCode, language: "javascript" },
      );

      expect(outputs).toEqual([{ received: { phi2: 0.8, secret: "must-not-be-logged" } }]);
      expect((globalThis as Record<string, unknown>).__mobileMacroRunnerCalls).toBe(1);
      expect(entries).toContainEqual(
        expect.objectContaining({
          level: "warn",
          ns: "macro",
          msg: "input normalization warning",
          fields: {
            warning: "additional-items-discarded",
            source: "sample-envelope",
            sourceCount: 2,
            discardedCount: 1,
          },
        }),
      );
      expect(JSON.stringify(entries.map((entry) => entry.fields))).not.toContain(
        "must-not-be-logged",
      );
    } finally {
      removeSink();
      setMinLogLevel(previousLevel);
    }
  });

  it("fails an empty sample envelope once without invoking JavaScript", async () => {
    await expect(
      applyMacro({ sample: [] }, { code: jsRunnerCode, language: "javascript" }),
    ).rejects.toMatchObject({
      name: "MacroInputNormalizationError",
      code: "empty-envelope",
    });
    expect((globalThis as Record<string, unknown>).__mobileMacroRunnerCalls).toBe(0);
  });

  it.each([
    ["an empty direct object", {}, {}],
    ["a direct measurement", { phi2: 0.8 }, { phi2: 0.8 }],
    ["a sample object", { sample: { phi2: 0.7 } }, { phi2: 0.7 }],
    ["a non-empty sample array", { sample: [{ phi2: 0.6 }] }, { phi2: 0.6 }],
    ["an empty top-level array", [], []],
    ["a single-item top-level array", [{ phi2: 0.5 }], [{ phi2: 0.5 }]],
    [
      "a multi-item top-level array",
      [{ phi2: 0.5 }, { phi2: 0.2 }],
      [{ phi2: 0.5 }, { phi2: 0.2 }],
    ],
    ["a nested top-level array", [[{ phi2: 0.8 }]], [[{ phi2: 0.8 }]]],
    [
      "a nested sample-array value",
      { sample: [{ sample: [{ phi2: 0.8 }] }] },
      { sample: [{ phi2: 0.8 }] },
    ],
    [
      "a nested sample-object value",
      { sample: { sample: { phi2: 0.8 } } },
      { sample: { phi2: 0.8 } },
    ],
  ])("invokes Python once with canonical data for %s", async (_label, input, expected) => {
    const runner = vi.fn((_code: string, json: unknown) => {
      return Promise.resolve({ received: json });
    });
    registerPythonMacroRunner(runner);

    const outputs = await applyMacro(input, { code: encode("# irrelevant"), language: "python" });

    expect(outputs).toEqual([{ received: expected }]);
    expect(runner).toHaveBeenCalledTimes(1);
  });

  it("does not invoke Python for an empty sample envelope", async () => {
    const runner = vi.fn(() => Promise.resolve({ unexpected: true }));
    registerPythonMacroRunner(runner);

    await expect(
      applyMacro({ sample: [] }, { code: encode("# irrelevant"), language: "python" }),
    ).rejects.toMatchObject({ code: "empty-envelope" });
    expect(runner).not.toHaveBeenCalled();
  });
});

describe("applyMacro: ctx namespace", () => {
  it("exposes upstream ctx to a JS macro", async () => {
    const result = { sample: { phi2: 0.5 } };
    const code = encode(`return { sum: ctx.baseline.value + ctx.stress.value };`);
    const [out] = await applyMacro(
      result,
      { code, language: "javascript" },
      { baseline: { value: 10 }, stress: { value: 4 } },
    );
    expect(out).toEqual({ sum: 14 });
  });

  it("defaults ctx to an empty object", async () => {
    const result = { sample: { phi2: 0.5 } };
    const code = encode(`return { empty: Object.keys(ctx).length === 0 };`);
    const [out] = await applyMacro(result, { code, language: "javascript" });
    expect(out).toEqual({ empty: true });
  });

  it("freezes ctx so a JS macro cannot mutate upstream state", async () => {
    const result = { sample: { phi2: 0.5 } };
    const code = encode(`
      try { ctx.baseline.value = 999; } catch (e) {}
      return { v: ctx.baseline.value };
    `);
    const [out] = await applyMacro(
      result,
      { code, language: "javascript" },
      { baseline: { value: 10 } },
    );
    expect(out).toEqual({ v: 10 });
  });

  it("passes ctx through to the Python runner", async () => {
    let receivedCtx: unknown = null;
    registerPythonMacroRunner((_code, _json, ctx) => {
      receivedCtx = ctx;
      return Promise.resolve({ ok: true });
    });
    await applyMacro(
      { sample: { phi2: 0.5 } },
      { code: encode("# irrelevant"), language: "python" },
      { baseline: { value: 7 } },
    );
    registerPythonMacroRunner(null);
    expect(receivedCtx).toEqual({ baseline: { value: 7 } });
  });
});
