import { describe, it, expect } from "vitest";

import {
  stringifyIfObject,
  tryParseJson,
  extractChecksum,
  addLineEnding,
  removeLineEnding,
} from "./framing";

describe("framing utilities", () => {
  describe("stringifyIfObject", () => {
    it("should return string as-is", () => {
      expect(stringifyIfObject("hello")).toBe("hello");
    });

    it("should stringify an object to JSON", () => {
      expect(stringifyIfObject({ command: "RUN" })).toBe('{"command":"RUN"}');
    });

    it("should stringify nested objects", () => {
      const obj = { a: { b: 1 } };
      expect(stringifyIfObject(obj)).toBe(JSON.stringify(obj));
    });

    it("should stringify arrays", () => {
      expect(stringifyIfObject([1, 2, 3] as unknown as object)).toBe("[1,2,3]");
    });
  });

  describe("tryParseJson", () => {
    it("should parse valid JSON", () => {
      expect(tryParseJson('{"key":"value"}')).toEqual({ key: "value" });
    });

    it("should return original string on invalid JSON", () => {
      expect(tryParseJson("not json")).toBe("not json");
    });

    it("should parse JSON arrays", () => {
      expect(tryParseJson("[1,2,3]")).toEqual([1, 2, 3]);
    });

    it("should parse JSON numbers", () => {
      expect(tryParseJson("42")).toBe(42);
    });

    it("should return empty string unchanged", () => {
      expect(tryParseJson("")).toBe("");
    });
  });

  describe("extractChecksum", () => {
    it("should extract checksum from end of data", () => {
      const result = extractChecksum("hello12345678", 8);
      expect(result).toEqual({ data: "hello", checksum: "12345678" });
    });

    it("should return empty checksum when data is shorter than checksum length", () => {
      const result = extractChecksum("short", 8);
      expect(result).toEqual({ data: "short", checksum: "" });
    });

    it("should return empty checksum for empty string", () => {
      const result = extractChecksum("", 8);
      expect(result).toEqual({ data: "", checksum: "" });
    });

    it("should handle data exactly equal to checksum length", () => {
      const result = extractChecksum("12345678", 8);
      expect(result).toEqual({ data: "", checksum: "12345678" });
    });

    it("should extract checksum of different lengths", () => {
      const result = extractChecksum("dataABCD", 4);
      expect(result).toEqual({ data: "data", checksum: "ABCD" });
    });
  });

  describe("addLineEnding", () => {
    it("should add default CRLF ending", () => {
      expect(addLineEnding("command")).toBe("command\r\n");
    });

    it("should add custom line ending", () => {
      expect(addLineEnding("command", "\n")).toBe("command\n");
    });

    it("should work with empty string", () => {
      expect(addLineEnding("")).toBe("\r\n");
    });
  });

  describe("removeLineEnding", () => {
    it("should remove CRLF ending", () => {
      expect(removeLineEnding("data\r\n")).toBe("data");
    });

    it("should remove LF ending", () => {
      expect(removeLineEnding("data\n")).toBe("data");
    });

    it("should leave data without line ending unchanged", () => {
      expect(removeLineEnding("data")).toBe("data");
    });

    it("should only remove trailing line ending", () => {
      expect(removeLineEnding("line1\nline2\n")).toBe("line1\nline2");
    });
  });
});
