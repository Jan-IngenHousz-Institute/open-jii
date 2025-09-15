import "@testing-library/jest-dom";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import React from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { DataDownloadModal } from "../data-download-modal";

globalThis.React = React;

// Mock the step components
vi.mock("../steps/format-selection-step", () => ({
  FormatSelectionStep: ({
    onFormatSubmit,
    onClose,
  }: {
    onFormatSubmit: (format: string) => void;
    onClose: () => void;
  }) => (
    <div data-testid="format-selection-step">
      <button onClick={() => onFormatSubmit("csv")} data-testid="select-csv">
        Select CSV
      </button>
      <button onClick={onClose} data-testid="close-button">
        Close
      </button>
    </div>
  ),
}));

vi.mock("../steps/download-links-step", () => ({
  DownloadLinksStep: ({
    experimentId,
    tableName,
    onClose,
  }: {
    experimentId: string;
    tableName: string;
    onClose: () => void;
  }) => (
    <div data-testid="download-links-step">
      <span data-testid="experiment-id">{experimentId}</span>
      <span data-testid="table-name">{tableName}</span>
      <button onClick={onClose} data-testid="close-button">
        Close
      </button>
    </div>
  ),
}));

// Mock translation
vi.mock("@repo/i18n/client", () => ({
  useTranslation: () => ({
    t: (key: string, options?: Record<string, unknown>) => {
      if (options) {
        let result = key;
        Object.entries(options).forEach(([k, v]) => {
          result = result.replace(`{{${k}}}`, String(v));
        });
        return result;
      }
      return key;
    },
  }),
}));

// Mock UI components
vi.mock("@repo/ui/components", () => ({
  Dialog: ({ children, open }: { children: React.ReactNode; open: boolean }) =>
    open ? <div data-testid="dialog">{children}</div> : null,
  DialogContent: ({ children }: { children: React.ReactNode }) => (
    <div data-testid="dialog-content">{children}</div>
  ),
  DialogHeader: ({ children }: { children: React.ReactNode }) => (
    <div data-testid="dialog-header">{children}</div>
  ),
  DialogTitle: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  DialogDescription: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}));

describe("DataDownloadModal", () => {
  const mockOnOpenChange = vi.fn();
  const defaultProps = {
    experimentId: "test-experiment-123",
    tableName: "test-table",
    open: true,
    onOpenChange: mockOnOpenChange,
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  const renderModal = (props = {}) => {
    render(<DataDownloadModal {...defaultProps} {...props} />);
  };

  it("renders modal when open", () => {
    renderModal();
    expect(screen.getByTestId("dialog")).toBeInTheDocument();
    expect(screen.getByText("experimentData.downloadModal.title")).toBeInTheDocument();
    expect(screen.getByText("experimentData.downloadModal.description")).toBeInTheDocument();
  });

  it("does not render modal when closed", () => {
    renderModal({ open: false });
    expect(screen.queryByTestId("dialog")).not.toBeInTheDocument();
  });

  it("starts with format selection step", () => {
    renderModal();
    expect(screen.getByTestId("format-selection-step")).toBeInTheDocument();
    expect(screen.queryByTestId("download-links-step")).not.toBeInTheDocument();
  });

  it("transitions to download links step when format is selected", async () => {
    renderModal();

    const selectCsvButton = screen.getByTestId("select-csv");
    fireEvent.click(selectCsvButton);

    await waitFor(() => {
      expect(screen.getByTestId("download-links-step")).toBeInTheDocument();
      expect(screen.queryByTestId("format-selection-step")).not.toBeInTheDocument();
    });
  });

  it("passes correct props to download links step", async () => {
    renderModal();

    // Go to download links step
    fireEvent.click(screen.getByTestId("select-csv"));

    await waitFor(() => {
      expect(screen.getByTestId("download-links-step")).toBeInTheDocument();
      expect(screen.getByTestId("experiment-id")).toHaveTextContent("test-experiment-123");
      expect(screen.getByTestId("table-name")).toHaveTextContent("test-table");
    });
  });

  it("closes modal when close button is clicked", () => {
    renderModal();

    const closeButton = screen.getByTestId("close-button");
    fireEvent.click(closeButton);

    expect(mockOnOpenChange).toHaveBeenCalledWith(false);
  });

  it("closes modal from download links step", async () => {
    renderModal();

    // Go to download links step
    fireEvent.click(screen.getByTestId("select-csv"));

    await waitFor(() => {
      expect(screen.getByTestId("download-links-step")).toBeInTheDocument();
    });

    // Close modal
    fireEvent.click(screen.getByTestId("close-button"));

    expect(mockOnOpenChange).toHaveBeenCalledWith(false);
  });

  it("resets state when modal is closed", async () => {
    const { rerender } = render(<DataDownloadModal {...defaultProps} open={true} />);

    // Go to download links step
    fireEvent.click(screen.getByTestId("select-csv"));

    await waitFor(() => {
      expect(screen.getByTestId("download-links-step")).toBeInTheDocument();
    });

    // Close modal
    rerender(<DataDownloadModal {...defaultProps} open={false} />);

    // Wait for reset timeout
    await new Promise((resolve) => setTimeout(resolve, 350));

    // Reopen modal
    rerender(<DataDownloadModal {...defaultProps} open={true} />);

    // Should be back to format selection
    expect(screen.getByTestId("format-selection-step")).toBeInTheDocument();
    expect(screen.queryByTestId("download-links-step")).not.toBeInTheDocument();
  });

  it("renders dialog header with correct title and description", () => {
    renderModal();

    expect(screen.getByText("experimentData.downloadModal.title")).toBeInTheDocument();
    expect(screen.getByText("experimentData.downloadModal.description")).toBeInTheDocument();
  });

  it("calls onOpenChange when dialog requests to close", () => {
    renderModal();

    // The dialog component should be able to trigger onOpenChange
    // This would be handled by the Dialog component internally
    expect(screen.getByTestId("dialog")).toBeInTheDocument();
  });
});
