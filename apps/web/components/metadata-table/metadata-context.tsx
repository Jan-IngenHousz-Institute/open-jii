"use client";

import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import type {
  MetadataColumn,
  MetadataContextValue,
  MetadataImportConfig,
  MetadataRow,
  MetadataTableState,
} from "./types";
import { parseClipboard, parseFile } from "./utils/parse-data";

const MetadataContext = createContext<MetadataContextValue | null>(null);

interface MetadataProviderProps {
  children: ReactNode;
  experimentId: string;
  onSave?: (columns: MetadataColumn[], rows: MetadataRow[]) => Promise<void>;
}

export function MetadataProvider({
  children,
  experimentId,
  onSave,
}: MetadataProviderProps) {
  const [state, setState] = useState<MetadataTableState>({
    columns: [],
    rows: [],
    isDirty: false,
  });
  const [mergeConfig, setMergeConfig] = useState<MetadataImportConfig | null>(
    null
  );
  const [isSaving, setIsSaving] = useState(false);
  const [isEditingCell, setIsEditingCell] = useState(false);

  const setData = useCallback(
    (columns: MetadataColumn[], rows: MetadataRow[]) => {
      setState({ columns, rows, isDirty: true });
    },
    []
  );

  const updateCell = useCallback(
    (rowId: string, columnId: string, value: unknown) => {
      setState((prev) => ({
        ...prev,
        isDirty: true,
        rows: prev.rows.map((row) =>
          row._id === rowId ? { ...row, [columnId]: value } : row
        ),
      }));
    },
    []
  );

  const addRow = useCallback(() => {
    setState((prev) => {
      const newRow: MetadataRow = { _id: `row_${Date.now()}` };
      prev.columns.forEach((col) => {
        newRow[col.id] = "";
      });
      return {
        ...prev,
        isDirty: true,
        rows: [...prev.rows, newRow],
      };
    });
  }, []);

  const deleteRow = useCallback((rowId: string) => {
    setState((prev) => ({
      ...prev,
      isDirty: true,
      rows: prev.rows.filter((row) => row._id !== rowId),
    }));
  }, []);

  const addColumn = useCallback((column: Omit<MetadataColumn, "id">) => {
    setState((prev) => {
      const newColumn: MetadataColumn = {
        ...column,
        id: `col_${Date.now()}`,
      };
      return {
        ...prev,
        isDirty: true,
        columns: [...prev.columns, newColumn],
        rows: prev.rows.map((row) => ({ ...row, [newColumn.id]: "" })),
      };
    });
  }, []);

  const deleteColumn = useCallback((columnId: string) => {
    setState((prev) => ({
      ...prev,
      isDirty: true,
      columns: prev.columns.filter((col) => col.id !== columnId),
      rows: prev.rows.map((row) => {
        const { [columnId]: _, ...rest } = row;
        return rest as MetadataRow;
      }),
    }));
  }, []);

  const renameColumn = useCallback((columnId: string, newName: string) => {
    setState((prev) => ({
      ...prev,
      isDirty: true,
      columns: prev.columns.map((col) =>
        col.id === columnId ? { ...col, name: newName } : col
      ),
    }));
  }, []);

  const importFromClipboard = useCallback(async () => {
    const { columns, rows } = await parseClipboard();
    setData(columns, rows);
  }, [setData]);

  const importFromFile = useCallback(
    async (file: File) => {
      const { columns, rows } = await parseFile(file);
      setData(columns, rows);
    },
    [setData]
  );

  const save = useCallback(async () => {
    if (!onSave) return;
    setIsSaving(true);
    try {
      await onSave(state.columns, state.rows);
      setState((prev) => ({ ...prev, isDirty: false }));
    } finally {
      setIsSaving(false);
    }
  }, [onSave, state.columns, state.rows]);

  const value = useMemo<MetadataContextValue>(
    () => ({
      state,
      setData,
      updateCell,
      addRow,
      deleteRow,
      addColumn,
      deleteColumn,
      renameColumn,
      importFromClipboard,
      importFromFile,
      mergeConfig,
      setMergeConfig,
      save,
      isSaving,
      isEditingCell,
      setIsEditingCell,
    }),
    [
      state,
      setData,
      updateCell,
      addRow,
      deleteRow,
      addColumn,
      deleteColumn,
      renameColumn,
      importFromClipboard,
      importFromFile,
      mergeConfig,
      setMergeConfig,
      save,
      isSaving,
      isEditingCell,
    ]
  );

  return (
    <MetadataContext.Provider value={value}>
      {children}
    </MetadataContext.Provider>
  );
}

export function useMetadata() {
  const context = useContext(MetadataContext);
  if (!context) {
    throw new Error("useMetadata must be used within a MetadataProvider");
  }
  return context;
}
