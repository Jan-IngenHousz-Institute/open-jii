import { renderHook, act } from "@testing-library/react";
import React from "react";
import { describe, it, expect, vi, beforeEach } from "vitest";

import { MetadataProvider, useMetadata } from "./metadata-context";

globalThis.React = React;

/* --------------------------------- Mocks --------------------------------- */

const mockParseClipboard = vi.fn();
const mockParseFile = vi.fn();

vi.mock("./utils/parse-metadata-import", () => ({
  parseClipboard: (...args: unknown[]): unknown => mockParseClipboard(...args),
  parseFile: (...args: unknown[]): unknown => mockParseFile(...args),
}));

/* -------------------------------- Helpers -------------------------------- */

function createWrapper(props?: {
  onSave?: (
    columns: unknown[],
    rows: unknown[],
    identifierColumnId: string | null,
    experimentQuestionId: string | null,
  ) => Promise<void>;
}) {
  return function Wrapper({ children }: { children: React.ReactNode }) {
    return (
      <MetadataProvider experimentId="test-exp" onSave={props?.onSave}>
        {children}
      </MetadataProvider>
    );
  };
}

/* --------------------------------- Tests --------------------------------- */

describe("MetadataProvider & useMetadata", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("throws when useMetadata is used outside MetadataProvider", () => {
    // Suppress console.error from React for the expected error
    const spy = vi.spyOn(console, "error").mockImplementation(() => {
      /* noop */
    });
    expect(() => renderHook(() => useMetadata())).toThrow(
      "useMetadata must be used within a MetadataProvider",
    );
    spy.mockRestore();
  });

  it("provides initial state", () => {
    const { result } = renderHook(() => useMetadata(), {
      wrapper: createWrapper(),
    });

    expect(result.current.state).toEqual({
      columns: [],
      rows: [],
      isDirty: false,
      identifierColumnId: null,
      experimentQuestionId: null,
    });
    expect(result.current.isSaving).toBe(false);
    expect(result.current.isEditingCell).toBe(false);
    expect(result.current.mergeConfig).toBeNull();
  });

  describe("setData", () => {
    it("sets columns and rows, marks dirty, resets identifiers", () => {
      const { result } = renderHook(() => useMetadata(), {
        wrapper: createWrapper(),
      });

      const columns = [{ id: "col1", name: "Name", type: "string" as const }];
      const rows = [{ _id: "row1", col1: "value" }];

      act(() => {
        result.current.setData(columns, rows);
      });

      expect(result.current.state.columns).toEqual(columns);
      expect(result.current.state.rows).toEqual(rows);
      expect(result.current.state.isDirty).toBe(true);
      expect(result.current.state.identifierColumnId).toBeNull();
      expect(result.current.state.experimentQuestionId).toBeNull();
    });
  });

  describe("updateCell", () => {
    it("updates a specific cell value and marks dirty", () => {
      const { result } = renderHook(() => useMetadata(), {
        wrapper: createWrapper(),
      });

      act(() => {
        result.current.setData(
          [{ id: "col1", name: "Name", type: "string" }],
          [{ _id: "row1", col1: "old" }],
        );
      });

      act(() => {
        result.current.updateCell("row1", "col1", "new");
      });

      expect(result.current.state.rows[0].col1).toBe("new");
      expect(result.current.state.isDirty).toBe(true);
    });

    it("does not affect other rows", () => {
      const { result } = renderHook(() => useMetadata(), {
        wrapper: createWrapper(),
      });

      act(() => {
        result.current.setData(
          [{ id: "col1", name: "Name", type: "string" }],
          [
            { _id: "row1", col1: "a" },
            { _id: "row2", col1: "b" },
          ],
        );
      });

      act(() => {
        result.current.updateCell("row1", "col1", "changed");
      });

      expect(result.current.state.rows[0].col1).toBe("changed");
      expect(result.current.state.rows[1].col1).toBe("b");
    });
  });

  describe("addRow", () => {
    it("adds a new row with empty values for all columns", () => {
      const { result } = renderHook(() => useMetadata(), {
        wrapper: createWrapper(),
      });

      act(() => {
        result.current.setData(
          [
            { id: "col1", name: "Name", type: "string" },
            { id: "col2", name: "Value", type: "number" },
          ],
          [],
        );
      });

      act(() => {
        result.current.addRow();
      });

      expect(result.current.state.rows).toHaveLength(1);
      expect(result.current.state.rows[0].col1).toBe("");
      expect(result.current.state.rows[0].col2).toBe("");
      expect(result.current.state.rows[0]._id).toMatch(/^row_/);
    });
  });

  describe("deleteRow", () => {
    it("removes row by id", () => {
      const { result } = renderHook(() => useMetadata(), {
        wrapper: createWrapper(),
      });

      act(() => {
        result.current.setData(
          [{ id: "col1", name: "Name", type: "string" }],
          [
            { _id: "row1", col1: "a" },
            { _id: "row2", col1: "b" },
          ],
        );
      });

      act(() => {
        result.current.deleteRow("row1");
      });

      expect(result.current.state.rows).toHaveLength(1);
      expect(result.current.state.rows[0]._id).toBe("row2");
    });
  });

  describe("addColumn", () => {
    it("adds column and initializes empty values in existing rows", () => {
      const { result } = renderHook(() => useMetadata(), {
        wrapper: createWrapper(),
      });

      act(() => {
        result.current.setData(
          [{ id: "col1", name: "Name", type: "string" }],
          [{ _id: "row1", col1: "a" }],
        );
      });

      act(() => {
        result.current.addColumn({ name: "New Col", type: "number" });
      });

      expect(result.current.state.columns).toHaveLength(2);
      expect(result.current.state.columns[1].name).toBe("New Col");
      expect(result.current.state.columns[1].type).toBe("number");
      expect(result.current.state.columns[1].id).toMatch(/^col_/);

      const newColId = result.current.state.columns[1].id;
      expect(result.current.state.rows[0][newColId]).toBe("");
    });
  });

  describe("deleteColumn", () => {
    it("removes column and its data from rows", () => {
      const { result } = renderHook(() => useMetadata(), {
        wrapper: createWrapper(),
      });

      act(() => {
        result.current.setData(
          [
            { id: "col1", name: "Name", type: "string" },
            { id: "col2", name: "Value", type: "number" },
          ],
          [{ _id: "row1", col1: "a", col2: 42 }],
        );
      });

      act(() => {
        result.current.deleteColumn("col2");
      });

      expect(result.current.state.columns).toHaveLength(1);
      expect(result.current.state.rows[0]).not.toHaveProperty("col2");
    });

    it("clears identifierColumnId when deleting the identifier column", () => {
      const { result } = renderHook(() => useMetadata(), {
        wrapper: createWrapper(),
      });

      act(() => {
        result.current.setData(
          [{ id: "col1", name: "Name", type: "string" }],
          [{ _id: "row1", col1: "a" }],
        );
      });

      act(() => {
        result.current.setIdentifierColumnId("col1");
      });

      expect(result.current.state.identifierColumnId).toBe("col1");

      act(() => {
        result.current.deleteColumn("col1");
      });

      expect(result.current.state.identifierColumnId).toBeNull();
    });

    it("preserves identifierColumnId when deleting a different column", () => {
      const { result } = renderHook(() => useMetadata(), {
        wrapper: createWrapper(),
      });

      act(() => {
        result.current.setData(
          [
            { id: "col1", name: "Name", type: "string" },
            { id: "col2", name: "Value", type: "number" },
          ],
          [{ _id: "row1", col1: "a", col2: 42 }],
        );
      });

      act(() => {
        result.current.setIdentifierColumnId("col1");
      });

      act(() => {
        result.current.deleteColumn("col2");
      });

      expect(result.current.state.identifierColumnId).toBe("col1");
    });
  });

  describe("renameColumn", () => {
    it("renames a column and marks dirty", () => {
      const { result } = renderHook(() => useMetadata(), {
        wrapper: createWrapper(),
      });

      act(() => {
        result.current.setData([{ id: "col1", name: "Name", type: "string" }], []);
      });

      act(() => {
        result.current.renameColumn("col1", "Full Name");
      });

      expect(result.current.state.columns[0].name).toBe("Full Name");
      expect(result.current.state.isDirty).toBe(true);
    });
  });

  describe("setIdentifierColumnId", () => {
    it("sets identifier column and marks dirty", () => {
      const { result } = renderHook(() => useMetadata(), {
        wrapper: createWrapper(),
      });

      act(() => {
        result.current.setIdentifierColumnId("col1");
      });

      expect(result.current.state.identifierColumnId).toBe("col1");
      expect(result.current.state.isDirty).toBe(true);
    });

    it("clears identifier column", () => {
      const { result } = renderHook(() => useMetadata(), {
        wrapper: createWrapper(),
      });

      act(() => {
        result.current.setIdentifierColumnId("col1");
      });

      act(() => {
        result.current.setIdentifierColumnId(null);
      });

      expect(result.current.state.identifierColumnId).toBeNull();
    });
  });

  describe("setExperimentQuestionId", () => {
    it("sets experiment question id and marks dirty", () => {
      const { result } = renderHook(() => useMetadata(), {
        wrapper: createWrapper(),
      });

      act(() => {
        result.current.setExperimentQuestionId("q1");
      });

      expect(result.current.state.experimentQuestionId).toBe("q1");
      expect(result.current.state.isDirty).toBe(true);
    });
  });

  describe("importFromClipboard", () => {
    it("calls parseClipboard and updates data", async () => {
      mockParseClipboard.mockResolvedValue({
        columns: [{ id: "col1", name: "ID", type: "number" }],
        rows: [{ _id: "row1", col1: 1 }],
      });

      const { result } = renderHook(() => useMetadata(), {
        wrapper: createWrapper(),
      });

      await act(async () => {
        await result.current.importFromClipboard();
      });

      expect(mockParseClipboard).toHaveBeenCalled();
      expect(result.current.state.columns).toHaveLength(1);
      expect(result.current.state.rows).toHaveLength(1);
      expect(result.current.state.isDirty).toBe(true);
    });
  });

  describe("importFromFile", () => {
    it("calls parseFile and updates data", async () => {
      mockParseFile.mockResolvedValue({
        columns: [{ id: "col1", name: "ID", type: "number" }],
        rows: [{ _id: "row1", col1: 1 }],
      });

      const { result } = renderHook(() => useMetadata(), {
        wrapper: createWrapper(),
      });
      const file = new File(["test"], "test.csv", { type: "text/csv" });

      await act(async () => {
        await result.current.importFromFile(file);
      });

      expect(mockParseFile).toHaveBeenCalledWith(file);
      expect(result.current.state.columns).toHaveLength(1);
      expect(result.current.state.isDirty).toBe(true);
    });
  });

  describe("save", () => {
    it("calls onSave with current state and clears dirty", async () => {
      const onSave = vi.fn().mockResolvedValue(undefined);
      const { result } = renderHook(() => useMetadata(), {
        wrapper: createWrapper({ onSave }),
      });

      const cols = [{ id: "col1", name: "Name", type: "string" as const }];
      const rows = [{ _id: "row1", col1: "val" }];

      act(() => {
        result.current.setData(cols, rows);
      });

      act(() => {
        result.current.setIdentifierColumnId("col1");
      });

      await act(async () => {
        await result.current.save();
      });

      expect(onSave).toHaveBeenCalledWith(cols, rows, "col1", null);
      expect(result.current.state.isDirty).toBe(false);
    });

    it("does nothing when no onSave provided", async () => {
      const { result } = renderHook(() => useMetadata(), {
        wrapper: createWrapper(),
      });

      await act(async () => {
        await result.current.save();
      });

      expect(result.current.isSaving).toBe(false);
    });

    it("resets isSaving even when onSave throws", async () => {
      const onSave = vi.fn().mockRejectedValue(new Error("Save failed"));
      const { result } = renderHook(() => useMetadata(), {
        wrapper: createWrapper({ onSave }),
      });

      act(() => {
        result.current.setData(
          [{ id: "col1", name: "Name", type: "string" }],
          [{ _id: "row1", col1: "a" }],
        );
      });

      await expect(
        act(async () => {
          await result.current.save();
        }),
      ).rejects.toThrow("Save failed");

      expect(result.current.isSaving).toBe(false);
    });
  });

  describe("isEditingCell", () => {
    it("can be toggled", () => {
      const { result } = renderHook(() => useMetadata(), {
        wrapper: createWrapper(),
      });

      act(() => {
        result.current.setIsEditingCell(true);
      });

      expect(result.current.isEditingCell).toBe(true);

      act(() => {
        result.current.setIsEditingCell(false);
      });

      expect(result.current.isEditingCell).toBe(false);
    });
  });

  describe("mergeConfig", () => {
    it("can be set and cleared", () => {
      const { result } = renderHook(() => useMetadata(), {
        wrapper: createWrapper(),
      });

      act(() => {
        result.current.setMergeConfig({
          identifierColumn: "col1",
          experimentIdentifierColumn: "exp_col1",
        });
      });

      expect(result.current.mergeConfig).toEqual({
        identifierColumn: "col1",
        experimentIdentifierColumn: "exp_col1",
      });

      act(() => {
        result.current.setMergeConfig(null);
      });

      expect(result.current.mergeConfig).toBeNull();
    });
  });
});
