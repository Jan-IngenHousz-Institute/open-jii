import "@testing-library/jest-dom";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import React from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { DataExportModal } from "../data-export-modal";

globalThis.React = React;

// Mock the hooks
const mockInitiateExport = vi.fn();
const mockIsPending = vi.fn(() => false);

vi.mock("~/hooks/experiment/useInitiateExport/useInitiateExport", () => ({
  useInitiateExport: (options: { onSuccess?: () => void } = {}) => {
    return {
      mutate: mockInitiateExport,
      isPending: mockIsPending(),
      onSuccess: options.onSuccess,
    };
  },
}));

// Mock the step components
vi.mock("../steps/export-list-step", () => ({
  ExportListStep: ({
    onCreateNew,
    onClose,
  }: {
    experimentId: string;
    tableName: string;
    onCreateNew: () => void;
    onClose: () => void;
  }) => (
    <div data-testid="export-list-step">
      <button onClick={onCreateNew} data-testid="create-button">
        Create New Export
      </button>
      <button onClick={onClose} data-testid="close-button">
        Close
      </button>
    </div>
  ),
}));

vi.mock("../steps/format-selection-step", () => ({
  FormatSelectionStep: ({
    onFormatSubmit,
    onBack,
    onClose,
    isCreating,
  }: {
    onFormatSubmit: (format: string) => void;
    onBack: () => void;
    onClose: () => void;
    isCreating?: boolean;
  }) => (
    <div data-testid="format-selection-step">
      <button onClick={() => onFormatSubmit("csv")} data-testid="submit-csv" disabled={isCreating}>
        Submit CSV
      </button>
      <button onClick={onBack} data-testid="back-button">
        Back
      </button>
      <button onClick={onClose} data-testid="close-button">
        Close
      </button>
      {isCreating && <span data-testid="is-creating">Creating...</span>}
    </div>
  ),
}));

// Mock translation
vi.mock("@repo/i18n/client", () => ({
  useTranslation: () => ({
    t: (key: string) => key,
  }),
}));

// Mock UI components
vi.mock("@repo/ui/components", () => ({
  Dialog: ({
    children,
    open,
    onOpenChange,
  }: {
    children: React.ReactNode;
    open: boolean;
    onOpenChange: (open: boolean) => void;
  }) =>
    open ? (
      <div data-testid="dialog" data-onchange={String(!!onOpenChange)}>
        {children}
      </div>
    ) : null,
  DialogContent: ({ children }: { children: React.ReactNode; className?: string }) => (
    <div data-testid="dialog-content">{children}</div>
  ),
  DialogHeader: ({ children }: { children: React.ReactNode }) => (
    <div data-testid="dialog-header">{children}</div>
  ),
  DialogTitle: ({ children }: { children: React.ReactNode; className?: string }) => (
    <div data-testid="dialog-title">{children}</div>
  ),
  DialogDescription: ({ children }: { children: React.ReactNode }) => (
    <div data-testid="dialog-description">{children}</div>
  ),
}));

// Mock lucide-react
vi.mock("lucide-react", () => ({
  Download: () => <span data-testid="download-icon" />,
}));

describe("DataExportModal", () => {
  const mockOnOpenChange = vi.fn();
  const defaultProps = {
    experimentId: "test-experiment-123",
    tableName: "raw_data",
    open: true,
    onOpenChange: mockOnOpenChange,
  };

  beforeEach(() => {
    vi.clearAllMocks();
    mockIsPending.mockReturnValue(false);
  });

  const renderModal = (props = {}) => {
    render(<DataExportModal {...defaultProps} {...props} />);
  };

  it("renders modal when open", () => {
    renderModal();
    expect(screen.getByTestId("dialog")).toBeInTheDocument();
    expect(screen.getByText("experimentData.exportModal.title")).toBeInTheDocument();
  });

  it("does not render modal when closed", () => {
    renderModal({ open: false });
    expect(screen.queryByTestId("dialog")).not.toBeInTheDocument();
  });

  it("starts with export list step", () => {
    renderModal();
    expect(screen.getByTestId("export-list-step")).toBeInTheDocument();
    expect(screen.queryByTestId("format-selection-step")).not.toBeInTheDocument();
  });

  it("transitions to format selection step when create button is clicked", async () => {
    renderModal();

    const createButton = screen.getByTestId("create-button");
    fireEvent.click(createButton);

    await waitFor(() => {
      expect(screen.getByTestId("format-selection-step")).toBeInTheDocument();
      expect(screen.queryByTestId("export-list-step")).not.toBeInTheDocument();
    });
  });

  it("displays create title when on format selection step", async () => {
    renderModal();

    fireEvent.click(screen.getByTestId("create-button"));

    await waitFor(() => {
      expect(screen.getByText("experimentData.exportModal.createTitle")).toBeInTheDocument();
    });
  });

  it("navigates back to list step when back button is clicked", async () => {
    renderModal();

    // Go to format selection
    fireEvent.click(screen.getByTestId("create-button"));

    await waitFor(() => {
      expect(screen.getByTestId("format-selection-step")).toBeInTheDocument();
    });

    // Go back
    fireEvent.click(screen.getByTestId("back-button"));

    await waitFor(() => {
      expect(screen.getByTestId("export-list-step")).toBeInTheDocument();
      expect(screen.queryByTestId("format-selection-step")).not.toBeInTheDocument();
    });
  });

  it("calls initiateExport when format is submitted", async () => {
    renderModal();

    // Go to format selection
    fireEvent.click(screen.getByTestId("create-button"));

    await waitFor(() => {
      expect(screen.getByTestId("format-selection-step")).toBeInTheDocument();
    });

    // Submit format
    fireEvent.click(screen.getByTestId("submit-csv"));

    expect(mockInitiateExport).toHaveBeenCalledWith({
      params: { id: "test-experiment-123" },
      body: {
        tableName: "raw_data",
        format: "csv",
      },
    });
  });

  it("closes modal when close button is clicked from list step", () => {
    renderModal();

    const closeButton = screen.getByTestId("close-button");
    fireEvent.click(closeButton);

    expect(mockOnOpenChange).toHaveBeenCalledWith(false);
  });

  it("closes modal from format selection step", async () => {
    renderModal();

    // Go to format selection
    fireEvent.click(screen.getByTestId("create-button"));

    await waitFor(() => {
      expect(screen.getByTestId("format-selection-step")).toBeInTheDocument();
    });

    // Close modal
    fireEvent.click(screen.getByTestId("close-button"));

    expect(mockOnOpenChange).toHaveBeenCalledWith(false);
  });

  it("resets to list step when modal closes and reopens", () => {
    vi.useFakeTimers();

    const { rerender } = render(<DataExportModal {...defaultProps} open={true} />);

    // Go to format selection (synchronous state update)
    fireEvent.click(screen.getByTestId("create-button"));
    expect(screen.getByTestId("format-selection-step")).toBeInTheDocument();

    // Close modal
    rerender(<DataExportModal {...defaultProps} open={false} />);

    // Fast-forward timer for state reset
    vi.advanceTimersByTime(350);

    // Reopen modal
    rerender(<DataExportModal {...defaultProps} open={true} />);

    // Should be back to list step
    expect(screen.getByTestId("export-list-step")).toBeInTheDocument();
    expect(screen.queryByTestId("format-selection-step")).not.toBeInTheDocument();

    vi.useRealTimers();
  });

  it("passes isPending state to format selection step", () => {
    mockIsPending.mockReturnValue(true);

    renderModal();

    // Go to format selection (synchronous state update)
    fireEvent.click(screen.getByTestId("create-button"));

    expect(screen.getByTestId("format-selection-step")).toBeInTheDocument();
    expect(screen.getByTestId("is-creating")).toBeInTheDocument();
  });

  it("renders dialog header correctly", () => {
    renderModal();

    expect(screen.getByTestId("dialog-header")).toBeInTheDocument();
  });
});
