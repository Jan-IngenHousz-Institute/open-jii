import { describe, it, expect } from "vitest";

import { toHex, fromHex } from "./hex";

describe("hex utilities", () => {
  describe("toHex", () => {
    it("should convert ASCII string to hex", () => {
      expect(toHex("Hello")).toBe("48656C6C6F");
    });

    it("should convert empty string to empty string", () => {
      expect(toHex("")).toBe("");
    });

    it("should convert single character", () => {
      expect(toHex("A")).toBe("41");
    });

    it("should pad single-digit hex values with leading zero", () => {
      // newline is 0x0A
      expect(toHex("\n")).toBe("0A");
    });

    it("should convert special characters", () => {
      expect(toHex("\r\n")).toBe("0D0A");
    });
  });

  describe("fromHex", () => {
    it("should convert hex string to ASCII", () => {
      expect(fromHex("48656C6C6F")).toBe("Hello");
    });

    it("should convert empty string to empty string", () => {
      expect(fromHex("")).toBe("");
    });

    it("should convert single byte", () => {
      expect(fromHex("41")).toBe("A");
    });

    it("should handle lowercase hex", () => {
      expect(fromHex("48656c6c6f")).toBe("Hello");
    });

    it("should throw on odd-length hex string", () => {
      expect(() => fromHex("ABC")).toThrow("Invalid hex string: length must be even");
    });
  });

  describe("roundtrip", () => {
    it("should roundtrip ASCII text", () => {
      const original = "Hello, World!";
      expect(fromHex(toHex(original))).toBe(original);
    });

    it("should roundtrip command strings", () => {
      const command = '{"command":"RUN"}\r\n';
      expect(fromHex(toHex(command))).toBe(command);
    });
  });
});
