import { describe, it, expect } from "vitest";

import {
  zProtocolCell,
  zMacroCell,
  zQuestionCell,
  zBranchCell,
  zOutputCell,
  zMarkdownCell,
  zWorkbookCell,
  zWorkbookCellArray,
} from "./workbook-cells.schema";

// -------- Helpers --------
const uuidA = "11111111-1111-1111-1111-111111111111";
const _uuidB = "22222222-2222-2222-2222-222222222222";

describe("Workbook Cells Schema", () => {
  // ----- Protocol Cell -----
  describe("zProtocolCell", () => {
    it("accepts ref payload", () => {
      const cell = {
        id: "p1",
        type: "protocol",
        payload: { protocolId: uuidA, version: 1 },
      };
      const parsed = zProtocolCell.parse(cell);
      expect(parsed).toEqual({ ...cell, isCollapsed: false });
    });

    it("accepts optional name", () => {
      const cell = {
        id: "p2",
        type: "protocol",
        payload: { protocolId: uuidA, version: 1, name: "My protocol" },
      };
      expect(zProtocolCell.parse(cell)).toEqual({ ...cell, isCollapsed: false });
    });

    it("rejects invalid protocolId", () => {
      const cell = {
        id: "p4",
        type: "protocol",
        payload: { protocolId: "not-uuid", version: 1 },
      };
      expect(() => zProtocolCell.parse(cell)).toThrow();
    });

    it("rejects payload with extra keys (strict)", () => {
      const cell = {
        id: "p5",
        type: "protocol",
        payload: { protocolId: uuidA, version: 1, extra: true },
      };
      expect(() => zProtocolCell.parse(cell)).toThrow();
    });

    it("rejects empty id", () => {
      const cell = {
        id: "",
        type: "protocol",
        payload: { protocolId: uuidA, version: 1 },
      };
      expect(() => zProtocolCell.parse(cell)).toThrow();
    });

    it("rejects non-positive version", () => {
      const cell = {
        id: "p7",
        type: "protocol",
        payload: { protocolId: uuidA, version: 0 },
      };
      expect(() => zProtocolCell.parse(cell)).toThrow();
    });
  });

  // ----- Macro Cell -----
  describe("zMacroCell", () => {
    it("accepts macro payload", () => {
      const cell = {
        id: "m1",
        type: "macro",
        payload: { macroId: uuidA, language: "python" },
      };
      expect(zMacroCell.parse(cell)).toEqual({ ...cell, isCollapsed: false });
    });

    it("accepts optional name", () => {
      const cell = {
        id: "m2",
        type: "macro",
        payload: { macroId: uuidA, language: "r", name: "My macro" },
      };
      expect(zMacroCell.parse(cell)).toEqual({ ...cell, isCollapsed: false });
    });

    it("rejects invalid language", () => {
      const cell = {
        id: "m4",
        type: "macro",
        payload: { macroId: uuidA, language: "lua" },
      };
      expect(() => zMacroCell.parse(cell)).toThrow();
    });

    it("rejects payload with extra keys (strict)", () => {
      const cell = {
        id: "m5",
        type: "macro",
        payload: { macroId: uuidA, language: "python", bonus: 42 },
      };
      expect(() => zMacroCell.parse(cell)).toThrow();
    });
  });

  // ----- Question Cell -----
  describe("zQuestionCell", () => {
    it("accepts yes_no question", () => {
      const cell = {
        id: "q1",
        type: "question",
        question: { kind: "yes_no", text: "Is it green?", required: true },
      };
      expect(zQuestionCell.parse(cell)).toEqual({ ...cell, isCollapsed: false, isAnswered: false });
    });

    it("accepts multi_choice question", () => {
      const cell = {
        id: "q2",
        type: "question",
        question: { kind: "multi_choice", text: "Pick color", options: ["red", "blue"] },
      };
      const parsed = zQuestionCell.parse(cell);
      expect(parsed.question.kind).toBe("multi_choice");
    });

    it("rejects question with extra keys (strict)", () => {
      const cell = {
        id: "q3",
        type: "question",
        question: { kind: "yes_no", text: "Ok?", bonus: 1 },
      };
      expect(() => zQuestionCell.parse(cell)).toThrow();
    });
  });

  // ----- Output Cell -----
  describe("zOutputCell", () => {
    it("accepts minimal output cell", () => {
      const cell = { id: "o1", type: "output", producedBy: "p1" };
      expect(zOutputCell.parse(cell)).toEqual({ ...cell, isCollapsed: false });
    });

    it("accepts output cell with optional fields", () => {
      const cell = {
        id: "o2",
        type: "output",
        producedBy: "m1",
        data: { value: 42 },
        executionTime: 150,
        messages: ["done"],
      };
      expect(zOutputCell.parse(cell)).toEqual({ ...cell, isCollapsed: false });
    });

    it("rejects empty producedBy", () => {
      const cell = { id: "o3", type: "output", producedBy: "" };
      expect(() => zOutputCell.parse(cell)).toThrow();
    });

    it("rejects negative executionTime", () => {
      const cell = { id: "o4", type: "output", producedBy: "p1", executionTime: -1 };
      expect(() => zOutputCell.parse(cell)).toThrow();
    });
  });

  // ----- Markdown Cell -----
  describe("zMarkdownCell", () => {
    it("accepts valid markdown cell", () => {
      const cell = { id: "md1", type: "markdown", content: "# Hello" };
      expect(zMarkdownCell.parse(cell)).toEqual({ ...cell, isCollapsed: false });
    });

    it("accepts empty content", () => {
      const cell = { id: "md2", type: "markdown", content: "" };
      expect(zMarkdownCell.parse(cell)).toEqual({ ...cell, isCollapsed: false });
    });
  });

  // ----- Branch Cell -----
  describe("zBranchCell", () => {
    it("accepts branch with a single path", () => {
      const cell = {
        id: "b1",
        type: "branch",
        paths: [
          {
            id: "path1",
            label: "Path 1",
            color: "#10b981",
            conditions: [
              { id: "c1", sourceCellId: "p1", field: "Fv/Fm", operator: "gt", value: "0.5" },
            ],
          },
        ],
      };
      expect(zBranchCell.parse(cell)).toBeTruthy();
    });

    it("accepts branch with multiple paths and goto", () => {
      const cell = {
        id: "b2",
        type: "branch",
        paths: [
          {
            id: "path1",
            label: "Excellent",
            color: "#10b981",
            conditions: [
              { id: "c1", sourceCellId: "p1", field: "Fv/Fm", operator: "gt", value: "0.7" },
            ],
            gotoCellId: "p1",
          },
          {
            id: "path2",
            label: "Poor",
            color: "#f43f5e",
            conditions: [
              { id: "c2", sourceCellId: "p1", field: "Fv/Fm", operator: "lt", value: "0.3" },
            ],
          },
        ],
        defaultPathId: "path-default",
      };
      expect(zBranchCell.parse(cell)).toBeTruthy();
    });

    it("accepts path with multiple conditions", () => {
      const cell = {
        id: "b3",
        type: "branch",
        paths: [
          {
            id: "path1",
            label: "Combined",
            color: "#0ea5e9",
            conditions: [
              { id: "c1", sourceCellId: "p1", field: "Fv/Fm", operator: "gt", value: "0.5" },
              { id: "c2", sourceCellId: "p1", field: "phi2", operator: "lt", value: "1.0" },
            ],
          },
        ],
      };
      expect(zBranchCell.parse(cell)).toBeTruthy();
    });

    it("rejects invalid operator", () => {
      const cell = {
        id: "b4",
        type: "branch",
        paths: [
          {
            id: "path1",
            label: "Bad",
            color: "#f00",
            conditions: [
              { id: "c1", sourceCellId: "p1", field: "x", operator: "contains", value: "y" },
            ],
          },
        ],
      };
      expect(() => zBranchCell.parse(cell)).toThrow();
    });

    it("rejects empty paths array", () => {
      const cell = {
        id: "b5",
        type: "branch",
        paths: [],
      };
      expect(() => zBranchCell.parse(cell)).toThrow();
    });

    it("rejects path with missing id", () => {
      const cell = {
        id: "b6",
        type: "branch",
        paths: [
          {
            id: "",
            label: "Bad",
            color: "#f00",
            conditions: [],
          },
        ],
      };
      expect(() => zBranchCell.parse(cell)).toThrow();
    });
  });

  // ----- Discriminated Union & Array -----
  describe("zWorkbookCell & zWorkbookCellArray", () => {
    it("accepts each cell type via the union", () => {
      const cells = [
        {
          id: "p1",
          type: "protocol",
          payload: { protocolId: uuidA, version: 1 },
        },
        {
          id: "m1",
          type: "macro",
          payload: { macroId: uuidA, language: "python" },
        },
        {
          id: "q1",
          type: "question",
          question: { kind: "open_ended", text: "Why?" },
        },
        { id: "md1", type: "markdown", content: "# Note" },
        { id: "o1", type: "output", producedBy: "p1" },
      ];
      const parsed = zWorkbookCellArray.parse(cells);
      expect(parsed).toHaveLength(5);
    });

    it("rejects unknown cell type", () => {
      const cells = [{ id: "x1", type: "unknown", content: "bad" }];
      expect(() => zWorkbookCellArray.parse(cells)).toThrow();
    });

    it("accepts empty array", () => {
      expect(zWorkbookCellArray.parse([])).toEqual([]);
    });

    it("rejects non-array input", () => {
      expect(() => zWorkbookCellArray.parse("not-array")).toThrow();
    });

    it("defaults isCollapsed to false", () => {
      const cell = { id: "md1", type: "markdown", content: "hi" };
      const parsed = zWorkbookCell.parse(cell);
      expect(parsed.isCollapsed).toBe(false);
    });

    it("preserves isCollapsed when set", () => {
      const cell = { id: "md1", type: "markdown", content: "hi", isCollapsed: true };
      const parsed = zWorkbookCell.parse(cell);
      expect(parsed.isCollapsed).toBe(true);
    });
  });
});
