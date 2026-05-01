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

vi.mock("expo-file-system", () => ({
  File: vi.fn().mockImplementation(() => ({
    text: vi.fn(() => Promise.resolve("")),
  })),
}));

const encode = (code: string) => Buffer.from(code, "utf8").toString("base64");

describe("applyMacro — wrapper contract", () => {
  describe("JavaScript macros", () => {
    it("passes the full wrapper to the macro (json.sample is the array)", async () => {
      const result = {
        device_id: "dev-1",
        sample: [{ set: [{ par: 1234 }] }],
      };

      const code = encode(`
        return {
          device_id: json.device_id,
          par: json.sample[0].set[0].par,
          n_samples: json.sample.length,
        };
      `);

      const out = await applyMacro(result, { code, language: "javascript" });

      expect(out).toEqual({ device_id: "dev-1", par: 1234, n_samples: 1 });
    });

    it("does not mutate the caller's wrapper", async () => {
      const result = {
        sample: [{ data_raw: [1, 2, 3, 4, 5] }],
      };

      const code = encode(`
        json.sample[0].data_raw[0] = 999;
        json.sample.push({ injected: true });
        return { ok: true };
      `);

      await applyMacro(result, { code, language: "javascript" });

      expect(result.sample.length).toBe(1);
      expect(result.sample[0].data_raw).toEqual([1, 2, 3, 4, 5]);
    });

    it("rejects unknown languages instead of silently running them as JS", async () => {
      const result = { sample: [{}] };
      const code = encode("return { ok: true };");

      await expect(applyMacro(result, { code, language: "r" })).rejects.toThrow(
        /Unsupported macro language: r/,
      );
    });
  });

  describe("Python macros", () => {
    beforeEach(() => {
      registerPythonMacroRunner(null);
    });

    it("passes the full wrapper to the Python runner", async () => {
      const result = {
        device_id: "dev-1",
        sample: [{ set: [{ par: 1234 }] }],
      };

      let receivedJson: unknown = null;
      registerPythonMacroRunner((_code, json) => {
        receivedJson = json;
        return Promise.resolve({ ok: true });
      });

      await applyMacro(result, {
        code: encode("# runner is mocked"),
        language: "python",
      });

      expect(receivedJson).toEqual({
        device_id: "dev-1",
        sample: [{ set: [{ par: 1234 }] }],
      });
    });

    it("does not mutate the caller's wrapper even if the runner mutates its arg", async () => {
      const result = {
        device_id: "dev-1",
        sample: [{ data_raw: [1, 2, 3] }],
      };

      registerPythonMacroRunner((_code, json) => {
        (json as { device_id: string }).device_id = "tampered";
        (json as { sample: { data_raw: number[] }[] }).sample[0].data_raw[0] = 999;
        return Promise.resolve({ ok: true });
      });

      await applyMacro(result, {
        code: encode("# irrelevant"),
        language: "python",
      });

      expect(result.device_id).toBe("dev-1");
      expect(result.sample[0].data_raw).toEqual([1, 2, 3]);
    });
  });
});
