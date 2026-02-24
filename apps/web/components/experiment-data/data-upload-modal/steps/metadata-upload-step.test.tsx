import "@testing-library/jest-dom";
import { render, screen } from "@testing-library/react";
import React from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import type { MetadataContextValue, MetadataTableState } from "@/components/metadata-table";

globalThis.React = React;

// --- Controllable mock state ---
const baseMockState: MetadataTableState = {
  columns: [],
  rows: [],
  isDirty: false,
  identifierColumnId: null,
  experimentQuestionId: null,
};

let mockContextValue: MetadataContextValue;

function buildMockContext(stateOverrides: Partial<MetadataTableState> = {}): MetadataContextValue {
  return {
    state: { ...baseMockState, ...stateOverrides },
    setData: vi.fn(),
    updateCell: vi.fn(),
    addRow: vi.fn(),
    deleteRow: vi.fn(),
    addColumn: vi.fn(),
    deleteColumn: vi.fn(),
    renameColumn: vi.fn(),
    setIdentifierColumnId: vi.fn(),
    setExperimentQuestionId: vi.fn(),
    importFromClipboard: vi.fn(),
    importFromFile: vi.fn(),
    mergeConfig: null,
    setMergeConfig: vi.fn(),
    save: vi.fn(),
    isSaving: false,
    isEditingCell: false,
    setIsEditingCell: vi.fn(),
  };
}

// Mock the metadata-table module so we control context values
vi.mock("@/components/metadata-table", () => ({
  MetadataProvider: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  useMetadata: () => mockContextValue,
  MetadataTable: () => <div data-testid="metadata-table">Table</div>,
}));

vi.mock("@/components/metadata-table/utils/parse-data", () => ({
  parseClipboardText: vi.fn(),
}));

vi.mock("@/hooks/experiment/useExperimentFlow/useExperimentFlow", () => ({
  useExperimentFlow: () => ({ data: null, isLoading: false, error: null }),
}));

// Mock translation – return the key so we can assert on it
vi.mock("@repo/i18n/client", () => ({
  useTranslation: () => ({
    t: (key: string) => key,
  }),
}));

// Minimal UI component mocks
vi.mock("@repo/ui/components", () => ({
  Button: ({
    children,
    disabled,
    onClick,
  }: {
    children: React.ReactNode;
    disabled?: boolean;
    onClick?: () => void;
  }) => (
    <button disabled={disabled} onClick={onClick}>
      {children}
    </button>
  ),
  Label: ({ children, ...props }: { children: React.ReactNode; htmlFor?: string }) => (
    <label {...props}>{children}</label>
  ),
  Select: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  SelectContent: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  SelectItem: ({ children }: { children: React.ReactNode; value: string }) => <div>{children}</div>,
  SelectTrigger: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  SelectValue: ({ placeholder }: { placeholder?: string }) => <span>{placeholder}</span>,
}));

vi.mock("@repo/ui/lib/utils", () => ({
  cn: (...args: unknown[]) => args.filter(Boolean).join(" "),
}));

vi.mock("lucide-react", () => ({
  ArrowLeft: () => <span />,
  ClipboardPaste: () => <span />,
  FileSpreadsheet: () => <span />,
  Trash2: () => <span />,
  Upload: () => <span />,
}));

// Import the component under test *after* mocks are set up
import { MetadataUploadStep } from "./metadata-upload-step";

const sampleColumns = [
  { id: "col_1", name: "ID", type: "string" as const },
  { id: "col_2", name: "Location", type: "string" as const },
];

const sampleRows = [
  { _id: "row_1", col_1: "1", col_2: "GH 8.3" },
  { _id: "row_2", col_1: "2", col_2: "GH 8.3" },
];

describe("MetadataUploadStep – Save Metadata button", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  const renderStep = () =>
    render(
      <MetadataUploadStep
        experimentId="test-experiment"
        onBack={vi.fn()}
        onUploadSuccess={vi.fn()}
      />
    );

  const getSaveButton = () =>
    screen.getByText("uploadModal.metadata.saveMetadata").closest("button")!;

  it("is disabled when no data is loaded", () => {
    mockContextValue = buildMockContext();
    renderStep();
    expect(getSaveButton()).toBeDisabled();
  });

  it("is disabled when data is loaded but no identifier column is set", () => {
    mockContextValue = buildMockContext({
      columns: sampleColumns,
      rows: sampleRows,
      identifierColumnId: null,
    });
    renderStep();
    expect(getSaveButton()).toBeDisabled();
  });

  it("is disabled when identifier column is set but no experiment question is selected", () => {
    mockContextValue = buildMockContext({
      columns: sampleColumns,
      rows: sampleRows,
      identifierColumnId: "col_1",
      experimentQuestionId: null,
    });
    renderStep();
    expect(getSaveButton()).toBeDisabled();
  });

  it("is enabled when data is loaded, identifier column and experiment question are set", () => {
    mockContextValue = buildMockContext({
      columns: sampleColumns,
      rows: sampleRows,
      identifierColumnId: "col_1",
      experimentQuestionId: "q_1",
    });
    renderStep();
    expect(getSaveButton()).toBeEnabled();
  });

  it("is disabled while saving is in progress", () => {
    mockContextValue = {
      ...buildMockContext({
        columns: sampleColumns,
        rows: sampleRows,
        identifierColumnId: "col_1",
        experimentQuestionId: "q_1",
      }),
      isSaving: true,
    };
    renderStep();
    // When saving, the button text changes to the uploading key
    const saveButton = screen.getByText("uploadModal.fileUpload.uploading").closest("button")!;
    expect(saveButton).toBeDisabled();
  });
});
