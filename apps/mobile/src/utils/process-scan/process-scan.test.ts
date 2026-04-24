import { describe, it, expect, vi, beforeEach } from "vitest";

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

// `new File(path)` is invoked with `new`. Vitest v4 no longer lets an
// arrow function stand in for a constructor, so declare a class.
vi.mock("expo-file-system", () => ({
  File: class {
    text() {
      return Promise.resolve("");
    }
  },
}));

const encode = (code: string) => Buffer.from(code, "utf8").toString("base64");

describe("applyMacro — input isolation (OJD-1463)", () => {
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

    it("isolates mutations between sibling samples in a batch", async () => {
      const sample1 = { data_raw: [1, 2, 3] };
      const sample2 = { data_raw: [4, 5, 6] };
      const result = { sample: [sample1, sample2] };

      const code = encode(`
        json.data_raw[0] = 999;
        return { first: json.data_raw[0] };
      `);

      const outputs = await applyMacro(result, { code, language: "javascript" });

      expect(outputs).toEqual([{ first: 999 }, { first: 999 }]);
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
        code: encode("# python body irrelevant — runner is mocked"),
        language: "python",
      });

      // The runner must have received a clone, not the caller's reference.
      expect(receivedRef).not.toBe(sample);
      // Original must still be intact.
      expect(sample).toEqual({ meta: "original", data_raw: [1, 2, 3] });
    });

    it("isolates mutations between sibling Python samples in a batch", async () => {
      const sample1 = { data_raw: [1, 2, 3] };
      const sample2 = { data_raw: [4, 5, 6] };
      const result = { sample: [sample1, sample2] };

      registerPythonMacroRunner((_code, json) => {
        (json as { data_raw: number[] }).data_raw[0] = 999;
        return Promise.resolve({ ok: true });
      });

      await applyMacro(result, {
        code: encode("# irrelevant"),
        language: "python",
      });

      expect(sample1.data_raw).toEqual([1, 2, 3]);
      expect(sample2.data_raw).toEqual([4, 5, 6]);
    });
  });
});
