import { describe, it, expect } from "vitest";

import { macroContract } from "./macro.contract";

describe("Macro Contract", () => {
  describe("listMacros", () => {
    it("should have the correct method and path", () => {
      expect(macroContract.listMacros.method).toBe("GET");
      expect(macroContract.listMacros.path).toBe("/api/v1/macros");
    });

    it("should define 200 and 400 responses", () => {
      expect(macroContract.listMacros.responses).toHaveProperty("200");
      expect(macroContract.listMacros.responses).toHaveProperty("400");
    });
  });

  describe("getMacro", () => {
    it("should have the correct method and path", () => {
      expect(macroContract.getMacro.method).toBe("GET");
      expect(macroContract.getMacro.path).toBe("/api/v1/macros/:id");
    });

    it("should define 200 and 404 responses", () => {
      expect(macroContract.getMacro.responses).toHaveProperty("200");
      expect(macroContract.getMacro.responses).toHaveProperty("404");
    });
  });

  describe("createMacro", () => {
    it("should have the correct method and path", () => {
      expect(macroContract.createMacro.method).toBe("POST");
      expect(macroContract.createMacro.path).toBe("/api/v1/macros");
    });

    it("should define 201 and 400 responses", () => {
      expect(macroContract.createMacro.responses).toHaveProperty("201");
      expect(macroContract.createMacro.responses).toHaveProperty("400");
    });
  });

  describe("updateMacro", () => {
    it("should have the correct method and path", () => {
      expect(macroContract.updateMacro.method).toBe("PUT");
      expect(macroContract.updateMacro.path).toBe("/api/v1/macros/:id");
    });

    it("should define 200, 400, and 404 responses", () => {
      expect(macroContract.updateMacro.responses).toHaveProperty("200");
      expect(macroContract.updateMacro.responses).toHaveProperty("400");
      expect(macroContract.updateMacro.responses).toHaveProperty("404");
    });
  });

  describe("deleteMacro", () => {
    it("should have the correct method and path", () => {
      expect(macroContract.deleteMacro.method).toBe("DELETE");
      expect(macroContract.deleteMacro.path).toBe("/api/v1/macros/:id");
    });

    it("should define 204 and 404 responses", () => {
      expect(macroContract.deleteMacro.responses).toHaveProperty("204");
      expect(macroContract.deleteMacro.responses).toHaveProperty("404");
    });
  });

  describe("executeMacro", () => {
    it("should have the correct method and path", () => {
      expect(macroContract.executeMacro.method).toBe("POST");
      expect(macroContract.executeMacro.path).toBe("/api/v1/macros/:id/execute");
    });

    it("should define 200, 400, and 404 responses", () => {
      expect(macroContract.executeMacro.responses).toHaveProperty("200");
      expect(macroContract.executeMacro.responses).toHaveProperty("400");
      expect(macroContract.executeMacro.responses).toHaveProperty("404");
    });
  });

  describe("executeMacroBatch", () => {
    it("should have the correct method and path", () => {
      expect(macroContract.executeMacroBatch.method).toBe("POST");
      expect(macroContract.executeMacroBatch.path).toBe("/api/v1/macros/execute-batch");
    });

    it("should define 200, 400, and 401 responses", () => {
      expect(macroContract.executeMacroBatch.responses).toHaveProperty("200");
      expect(macroContract.executeMacroBatch.responses).toHaveProperty("400");
      expect(macroContract.executeMacroBatch.responses).toHaveProperty("401");
    });

    it("should require webhook auth headers", () => {
      expect(macroContract.executeMacroBatch.headers).toBeDefined();
    });
  });
});
