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

    it("should handle encoding errors gracefully", () => {
      // Mock btoa to throw an error
      const originalBtoa = global.btoa;
      global.btoa = vi.fn(() => {
        throw new Error("Encoding failed");
      });

      const result = encodeBase64("test content");

      expect(result).toBe("");

      // Restore original functions
      global.btoa = originalBtoa;
    });
  });
});
