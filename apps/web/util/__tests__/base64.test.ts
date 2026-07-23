import { describe, it, expect, vi } from "vitest";

import { decodeBase64, encodeBase64 } from "../base64";

describe("base64 utilities", () => {
  describe("decodeBase64", () => {
    it("should decode valid base64 content", () => {
      const originalContent = "Hello, World!";
      const base64Content = btoa(originalContent);

      const result = decodeBase64(base64Content);

      expect(result).toBe(originalContent);
    });

    it("should return empty string for null content", () => {
      const result = decodeBase64(null);

      expect(result).toBe("");
    });

    it("should return empty string for empty content", () => {
      const result = decodeBase64("");

      expect(result).toBe("");
    });

    it("should handle invalid base64 content", () => {
      const result = decodeBase64("invalid-base64!");

      expect(result).toBe("Error decoding content");
    });

    it("should handle Python code content", () => {
      const pythonCode = `# Macro for data evaluation
output = {}
return output`;
      const base64Content = btoa(pythonCode);

      const result = decodeBase64(base64Content);

      expect(result).toBe(pythonCode);
    });
  });

  describe("encodeBase64", () => {
    it("should encode content to base64", () => {
      const originalContent = "Hello, World!";
      const expectedBase64 = btoa(originalContent);

      const result = encodeBase64(originalContent);

      expect(result).toBe(expectedBase64);
    });

    it("should handle empty string", () => {
      const result = encodeBase64("");

      expect(result).toBe("");
    });

    it("should fall back to empty string when the underlying btoa throws", () => {
      const originalBtoa = global.btoa;
      global.btoa = vi.fn(() => {
        throw new Error("Encoding failed");
      });

      try {
        expect(encodeBase64("test content")).toBe("");
      } finally {
        global.btoa = originalBtoa;
      }
    });
  });

  // Regression: macros containing any non-Latin1 character used to be silently
  // saved as "" because `btoa` throws outside Latin1 and the catch swallowed it.
  // These are exactly the characters that arrive when a long macro is pasted
  // from a doc/PDF/web page (curly quotes, Greek symbols, arrows, emoji, CJK).
  describe("unicode round-trips", () => {
    const samples: [string, string][] = [
      ["curly quotes", "print(“hello”)"],
      ["greek mu + superscripts", "flux = 1.0  # μmol·m⁻²·s⁻¹"],
      ["arrow", "a → b"],
      ["emoji", "rocket = 1  # \u{1F680}"],
      ["CJK", "変数 = 42"],
      ["degree (latin1)", "temp = 25°C"],
    ];

    it.each(samples)("encodes and decodes %s losslessly", (_label, code) => {
      const encoded = encodeBase64(code);

      expect(encoded).not.toBe("");
      expect(decodeBase64(encoded)).toBe(code);
    });
  });

  describe("long content", () => {
    it("round-trips a large macro with unicode without truncation or stack overflow", () => {
      const code = "# π\n" + "output = compute()  # → value\n".repeat(20000);

      const encoded = encodeBase64(code);

      expect(encoded).not.toBe("");
      expect(decodeBase64(encoded)).toBe(code);
    });
  });

  describe("backward compatibility with the old Latin1 btoa path", () => {
    it("decodes ASCII content saved before the fix", () => {
      expect(decodeBase64(btoa("output = {}"))).toBe("output = {}");
    });

    it("decodes Latin1 content saved before the fix", () => {
      // The old path stored `°` as the single byte 0xB0; the decoder must still
      // recover it rather than mojibake or error.
      expect(decodeBase64(btoa("temp = 25°C"))).toBe("temp = 25°C");
    });
  });
});
