import type { ColumnDef } from "@tanstack/react-table";

export interface MetadataColumn {
  id: string;
  name: string;
  type: "string" | "number" | "date";
}

export interface MetadataRow {
  _id: string;
  [key: string]: unknown;
}

export interface MetadataTableState {
  columns: MetadataColumn[];
  rows: MetadataRow[];
  isDirty: boolean;
  identifierColumnId: string | null;
  experimentQuestionId: string | null;
}

export interface MetadataImportConfig {
  identifierColumn: string;
  experimentIdentifierColumn: string;
}

export interface MetadataContextValue {
  // State
  state: MetadataTableState;
  
  // Data manipulation
  setData: (columns: MetadataColumn[], rows: MetadataRow[]) => void;
  updateCell: (rowId: string, columnId: string, value: unknown) => void;
  addRow: () => void;
  deleteRow: (rowId: string) => void;
  addColumn: (column: Omit<MetadataColumn, "id">) => void;
  deleteColumn: (columnId: string) => void;
  renameColumn: (columnId: string, newName: string) => void;
  
  // Identifier column
  setIdentifierColumnId: (columnId: string | null) => void;
  
  // Experiment question identifier
  setExperimentQuestionId: (questionId: string | null) => void;
  
  // Import
  importFromClipboard: () => Promise<void>;
  importFromFile: (file: File) => Promise<void>;
  
  // Merge config
  mergeConfig: MetadataImportConfig | null;
  setMergeConfig: (config: MetadataImportConfig | null) => void;
  
  // Save
  save: () => Promise<void>;
  isSaving: boolean;
  
  // Cell editing state
  isEditingCell: boolean;
  setIsEditingCell: (editing: boolean) => void;
}

export type MetadataColumnDef = ColumnDef<MetadataRow, unknown>;
