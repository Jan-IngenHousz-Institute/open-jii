import { act, fireEvent, render, screen, userEvent, waitFor } from "@/test/test-utils";
import React from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { MetadataUploadStep } from "./metadata-upload-step";

const mockParseClipboard = vi.fn();
const mockParseClipboardText = vi.fn();
const mockParseFile = vi.fn();
const mockMutateAsync = vi.fn();
const mockUpdateMutateAsync = vi.fn();
const mockDeleteMutateAsync = vi.fn();
let mockExistingMetadata: unknown[] = [];

vi.mock("@/components/metadata-table", () => ({
  MetadataTable: (props: {
    columns: unknown[];
    rows: unknown[];
    identifierColumnId: string | null;
    onUpdateCell: (rowId: string, columnId: string, value: string | number | null) => void;
    onDeleteRow: (rowId: string) => void;
    onDeleteColumn: (columnId: string) => void;
    onRenameColumn: (columnId: string, newName: string) => void;
    onSetIdentifierColumn: (columnId: string | null) => void;
  }) => (
    <div data-testid="metadata-table">
      <span data-testid="table-col-count">{props.columns.length}</span>
      <span data-testid="table-row-count">{props.rows.length}</span>
      <button
        data-testid="update-cell"
        onClick={() => props.onUpdateCell("row_0", "col_0", "new")}
      />
      <button data-testid="delete-row" onClick={() => props.onDeleteRow("row_0")} />
      <button data-testid="delete-column" onClick={() => props.onDeleteColumn("col_0")} />
      <button
        data-testid="rename-column"
        onClick={() => props.onRenameColumn("col_0", "Renamed")}
      />
      <button data-testid="set-identifier" onClick={() => props.onSetIdentifierColumn("col_0")} />
    </div>
  ),
}));

vi.mock("@/components/metadata-table/utils/parse-metadata-import", () => ({
  parseClipboard: (...args: unknown[]) => mockParseClipboard(...args) as unknown,
  parseClipboardText: (...args: unknown[]) => mockParseClipboardText(...args) as unknown,
  parseFile: (...args: unknown[]) => mockParseFile(...args) as unknown,
}));

let mockFlowData: unknown = null;
vi.mock("@/hooks/experiment/useExperimentFlow/useExperimentFlow", () => ({
  useExperimentFlow: () => ({ data: mockFlowData, isLoading: false, error: null }),
}));

vi.mock("@/hooks/experiment/useExperimentMetadataCreate/useExperimentMetadataCreate", () => ({
  useExperimentMetadataCreate: () => ({ mutateAsync: mockMutateAsync, isPending: false }),
}));

vi.mock("@/hooks/experiment/useExperimentMetadataUpdate/useExperimentMetadataUpdate", () => ({
  useExperimentMetadataUpdate: () => ({ mutateAsync: mockUpdateMutateAsync, isPending: false }),
}));

vi.mock("@/hooks/experiment/useExperimentMetadataDelete/useExperimentMetadataDelete", () => ({
  useExperimentMetadataDelete: () => ({ mutateAsync: mockDeleteMutateAsync, isPending: false }),
}));

vi.mock("@/hooks/experiment/useExperimentMetadata/useExperimentMetadata", () => ({
  useExperimentMetadata: () => ({
    data: { body: mockExistingMetadata },
    isLoading: false,
    error: null,
  }),
}));

// Stub UI components - this test validates data flow via data-testid callbacks
// on mocked MetadataTable, so Radix Select/Input must be simplified.
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
  DialogFooter: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  Input: ({
    id,
    value,
    onChange,
    placeholder,
  }: {
    id?: string;
    value?: string;
    onChange?: (e: React.ChangeEvent<HTMLInputElement>) => void;
    placeholder?: string;
  }) => (
    <input id={id} value={value} onChange={onChange} placeholder={placeholder} data-testid={id} />
  ),
  Label: ({ children, ...props }: { children: React.ReactNode; htmlFor?: string }) => (
    <label {...props}>{children}</label>
  ),
  Select: ({
    children,
    onValueChange,
    value,
  }: {
    children: React.ReactNode;
    onValueChange?: (v: string) => void;
    value?: string;
    disabled?: boolean;
  }) => (
    <div data-testid="select" data-value={value}>
      {children}
      {onValueChange && (
        <button
          data-testid="select-trigger-action"
          onClick={() => onValueChange("test_question")}
        />
      )}
    </div>
  ),
  SelectContent: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  SelectItem: ({ children, value }: { children: React.ReactNode; value: string }) => (
    <div data-value={value}>{children}</div>
  ),
  SelectTrigger: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  SelectValue: ({ placeholder }: { placeholder?: string }) => <span>{placeholder}</span>,
  ScrollArea: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}));

vi.mock("@repo/ui/lib/utils", () => ({
  cn: (...args: unknown[]) => args.filter(Boolean).join(" "),
}));

const sampleData = {
  columns: [
    { id: "col_0", name: "ID", type: "number" as const },
    { id: "col_1", name: "Name", type: "string" as const },
  ],
  rows: [
    { _id: "row_0", col_0: 1, col_1: "Test" },
    { _id: "row_1", col_0: 2, col_1: "Test2" },
  ],
};

describe("MetadataUploadStep", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockFlowData = null;
    mockExistingMetadata = [];
  });

  const renderStep = (props?: Partial<{ onClose: () => void }>) =>
    render(
      <MetadataUploadStep experimentId="test-experiment" onClose={props?.onClose ?? vi.fn()} />,
    );

  /** Click "Add new" to go from list view to edit view */
  function goToEditView() {
    fireEvent.click(getButton("uploadModal.metadata.addNew"));
  }

  /** Query a button by its text content, throwing if not found. */
  function getButton(text: string): HTMLButtonElement {
    const btn = screen.getByText(text).closest("button");
    if (!btn) throw new Error(`Button not found: ${text}`);
    return btn;
  }

  function getFileInput(): HTMLInputElement {
    const input = document.querySelector('input[type="file"]');
    if (!input) throw new Error("File input not found");
    return input as HTMLInputElement;
  }

  function getDropZone(): HTMLElement {
    const prompt = screen.getByText("uploadModal.metadata.importPrompt").closest("div");
    const zone = prompt?.parentElement;
    if (!zone) throw new Error("Drop zone not found");
    return zone;
  }

  const getSaveButton = () => getButton("uploadModal.metadata.saveMetadata");

  it("is disabled when no data is loaded (empty state)", () => {
    renderStep();
    goToEditView();
    expect(getSaveButton()).toBeDisabled();
  });

  it("renders the import prompt when no data is loaded", () => {
    renderStep();
    goToEditView();
    expect(screen.getByText("uploadModal.metadata.importPrompt")).toBeInTheDocument();
  });

  it("calls onClose when back button is clicked in list view", () => {
    const onClose = vi.fn();
    renderStep({ onClose });
    fireEvent.click(getButton("uploadModal.fileUpload.back"));
    expect(onClose).toHaveBeenCalled();
  });

  describe("file import", () => {
    it("imports data from a file via file input", async () => {
      mockParseFile.mockResolvedValue(sampleData);
      renderStep();
      goToEditView();

      const file = new File(["ID,Name\n1,Test"], "test.csv", { type: "text/csv" });
      fireEvent.change(getFileInput(), { target: { files: [file] } });

      await waitFor(() => {
        expect(mockParseFile).toHaveBeenCalledWith(file);
      });
      expect(screen.getByTestId("metadata-table")).toBeInTheDocument();
    });

    it("auto-fills metadata name from filename", async () => {
      mockParseFile.mockResolvedValue(sampleData);
      renderStep();
      goToEditView();

      const file = new File(["ID,Name\n1,Test"], "Winter Wheat Plots.csv", { type: "text/csv" });
      fireEvent.change(getFileInput(), { target: { files: [file] } });

      await waitFor(() => {
        expect(screen.getByTestId("metadata-table")).toBeInTheDocument();
      });
      const nameInput = screen.getByTestId("metadata-name");
      expect(nameInput).toHaveValue("Winter Wheat Plots");
    });

    it("shows error when file import fails", async () => {
      mockParseFile.mockRejectedValue(new Error("Unsupported file type"));
      renderStep();
      goToEditView();

      const file = new File(["data"], "test.pdf", { type: "application/pdf" });
      fireEvent.change(getFileInput(), { target: { files: [file] } });

      await waitFor(() => {
        expect(screen.getByText("Unsupported file type")).toBeInTheDocument();
      });
    });

    it("shows generic error when file import throws non-Error", async () => {
      mockParseFile.mockRejectedValue("unknown error");
      renderStep();
      goToEditView();

      const file = new File(["data"], "test.csv", { type: "text/csv" });
      fireEvent.change(getFileInput(), { target: { files: [file] } });

      await waitFor(() => {
        expect(screen.getByText("Failed to import file")).toBeInTheDocument();
      });
    });

    it("does nothing when no file is selected", () => {
      renderStep();
      goToEditView();
      fireEvent.change(getFileInput(), { target: { files: [] } });
      expect(mockParseFile).not.toHaveBeenCalled();
    });
  });

  describe("clipboard paste", () => {
    it("imports data from clipboard via paste button", async () => {
      mockParseClipboard.mockResolvedValue(sampleData);
      renderStep();
      goToEditView();

      fireEvent.click(getButton("uploadModal.metadata.pasteClipboard"));

      await waitFor(() => {
        expect(mockParseClipboard).toHaveBeenCalled();
      });
      expect(screen.getByTestId("metadata-table")).toBeInTheDocument();
    });

    it("shows error when clipboard paste fails", async () => {
      mockParseClipboard.mockRejectedValue(new Error("Clipboard access denied"));
      renderStep();
      goToEditView();

      fireEvent.click(getButton("uploadModal.metadata.pasteClipboard"));

      await waitFor(() => {
        expect(screen.getByText("Clipboard access denied")).toBeInTheDocument();
      });
    });

    it("shows generic error when clipboard paste throws non-Error", async () => {
      mockParseClipboard.mockRejectedValue("unknown");
      renderStep();
      goToEditView();

      fireEvent.click(getButton("uploadModal.metadata.pasteClipboard"));

      await waitFor(() => {
        expect(screen.getByText("Failed to paste from clipboard")).toBeInTheDocument();
      });
    });

    it("handles paste event on document when no data loaded", () => {
      mockParseClipboardText.mockReturnValue(sampleData);
      renderStep();
      goToEditView();

      const event = new Event("paste", { bubbles: true }) as unknown as ClipboardEvent;
      Object.defineProperty(event, "clipboardData", {
        value: { getData: () => "ID,Name\n1,Test" },
      });
      Object.defineProperty(event, "preventDefault", { value: vi.fn() });
      act(() => {
        document.dispatchEvent(event);
      });

      expect(mockParseClipboardText).toHaveBeenCalledWith("ID,Name\n1,Test");
      expect(screen.getByTestId("metadata-table")).toBeInTheDocument();
    });

    it("shows error when paste event parsing fails", () => {
      mockParseClipboardText.mockImplementation(() => {
        throw new Error("Parse failed");
      });
      renderStep();
      goToEditView();

      const event = new Event("paste", { bubbles: true }) as unknown as ClipboardEvent;
      Object.defineProperty(event, "clipboardData", {
        value: { getData: () => "bad data" },
      });
      act(() => {
        document.dispatchEvent(event);
      });

      expect(screen.getByText("Parse failed")).toBeInTheDocument();
    });
  });

  describe("drag and drop", () => {
    it("handles file drop", async () => {
      mockParseFile.mockResolvedValue(sampleData);
      renderStep();
      goToEditView();

      const dropZone = getDropZone();
      fireEvent.dragOver(dropZone, { dataTransfer: { files: [] } });

      const file = new File(["data"], "test.csv", { type: "text/csv" });
      fireEvent.drop(dropZone, { dataTransfer: { files: [file] } });

      await waitFor(() => {
        expect(mockParseFile).toHaveBeenCalledWith(file);
      });
    });

    it("handles dragLeave", () => {
      renderStep();
      goToEditView();
      fireEvent.dragLeave(getDropZone(), { dataTransfer: { files: [] } });
      expect(screen.getByText("uploadModal.metadata.importPrompt")).toBeInTheDocument();
    });
  });

  describe("data loaded state", () => {
    const loadData = async () => {
      mockParseClipboard.mockResolvedValue(sampleData);
      renderStep();
      goToEditView();
      fireEvent.click(getButton("uploadModal.metadata.pasteClipboard"));
      await screen.findByTestId("metadata-table");
    };

    it("shows metadata table after data import", async () => {
      await loadData();
      expect(screen.getByTestId("metadata-table")).toBeInTheDocument();
      expect(screen.queryByText("uploadModal.metadata.importPrompt")).not.toBeInTheDocument();
    });

    it("shows row count after import", async () => {
      await loadData();
      expect(screen.getByText("uploadModal.metadata.rowCount")).toBeInTheDocument();
    });

    it("clears data when clear button is clicked", async () => {
      await loadData();
      fireEvent.click(getButton("uploadModal.metadata.clearData"));
      expect(screen.getByText("uploadModal.metadata.importPrompt")).toBeInTheDocument();
    });

    it("handles cell update", async () => {
      await loadData();
      fireEvent.click(screen.getByTestId("update-cell"));
    });

    it("handles row deletion", async () => {
      await loadData();
      fireEvent.click(screen.getByTestId("delete-row"));
      expect(screen.getByTestId("table-row-count").textContent).toBe("1");
    });

    it("handles column deletion", async () => {
      await loadData();
      fireEvent.click(screen.getByTestId("delete-column"));
      expect(screen.getByTestId("table-col-count").textContent).toBe("1");
    });

    it("handles column rename", async () => {
      await loadData();
      fireEvent.click(screen.getByTestId("rename-column"));
    });

    it("handles identifier column setting", async () => {
      await loadData();
      fireEvent.click(screen.getByTestId("set-identifier"));
    });
  });

  describe("save metadata", () => {
    const loadDataAndSave = async (
      options: {
        onClose?: () => void;
        mutateError?: Error | string;
      } = {},
    ): Promise<{ onClose: () => void }> => {
      mockParseClipboard.mockResolvedValue(sampleData);
      mockMutateAsync.mockImplementation(
        options.mutateError
          ? () => Promise.reject(options.mutateError as Error)
          : () => Promise.resolve({}),
      );

      const onClose = options.onClose ?? vi.fn();
      renderStep({ onClose });
      goToEditView();

      fireEvent.click(getButton("uploadModal.metadata.pasteClipboard"));
      await screen.findByTestId("metadata-table");

      // Fill in required metadata name
      const nameInput = screen.getByTestId("metadata-name");
      fireEvent.change(nameInput, { target: { value: "Test Metadata" } });

      fireEvent.click(screen.getByTestId("set-identifier"));
      fireEvent.click(screen.getByTestId("select-trigger-action"));

      return { onClose };
    };

    it("saves metadata with name and remapped columns", async () => {
      await loadDataAndSave();

      fireEvent.click(getSaveButton());

      await waitFor(() => {
        expect(mockMutateAsync).toHaveBeenCalledWith({
          params: { id: "test-experiment" },
          body: {
            metadata: {
              name: "Test Metadata",
              columns: [
                { id: "ID", name: "ID", type: "number" },
                { id: "Name", name: "Name", type: "string" },
              ],
              rows: [
                { _id: "row_0", ID: 1, Name: "Test" },
                { _id: "row_1", ID: 2, Name: "Test2" },
              ],
              identifierColumnId: "ID",
              experimentQuestionId: "test_question",
            },
          },
        });
      });
    });

    it("shows error when save fails with Error", async () => {
      await loadDataAndSave({ mutateError: new Error("Server error") });

      fireEvent.click(getSaveButton());

      await waitFor(() => {
        expect(screen.getByText("Server error")).toBeInTheDocument();
      });
    });

    it("shows generic error when save fails with non-Error", async () => {
      await loadDataAndSave({ mutateError: "unknown" as unknown as Error });

      fireEvent.click(getSaveButton());

      await waitFor(() => {
        expect(screen.getByText("Failed to save metadata")).toBeInTheDocument();
      });
    });
  });

  describe("experiment question options", () => {
    it("renders question options when flow data is available", async () => {
      mockFlowData = {
        body: {
          graph: {
            nodes: [
              { id: "1", type: "question", name: "Plot Number" },
              { id: "2", type: "sensor", name: "Temperature" },
              { id: "3", type: "question", name: "Location ID" },
            ],
          },
        },
      };

      mockParseClipboard.mockResolvedValue(sampleData);
      renderStep();
      goToEditView();

      fireEvent.click(getButton("uploadModal.metadata.pasteClipboard"));
      await screen.findByTestId("metadata-table");

      expect(screen.getByText("Plot Number")).toBeInTheDocument();
      expect(screen.getByText("Location ID")).toBeInTheDocument();
      expect(screen.queryByText("Temperature")).not.toBeInTheDocument();
    });
  });
});
