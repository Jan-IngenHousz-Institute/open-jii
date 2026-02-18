import "@testing-library/jest-dom";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import React from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { DataExportModal } from "../data-export-modal";

globalThis.React = React;

// Mock the hooks
const mockInitiateExport = vi.fn();
let capturedOnSuccess: (() => void) | undefined;

vi.mock("~/hooks/experiment/useInitiateExport/useInitiateExport", () => ({
  useInitiateExport: (options: { onSuccess?: () => void } = {}) => {
    capturedOnSuccess = options.onSuccess;
    return {
      mutate: mockInitiateExport,
      isPending: false,
    };
  },
}));

vi.mock("~/util/apiError", () => ({
  parseApiError: (error: { body?: { message?: string } }) => error.body,
}));

// Mock the step components
vi.mock("../steps/export-list-step", () => ({
  ExportListStep: ({
    onCreateExport,
    onClose,
  }: {
    experimentId: string;
    tableName: string;
    onCreateExport: (format: string) => void;
    onClose: () => void;
  }) => (
    <div data-testid="export-list-step">
      <button onClick={() => onCreateExport("csv")} data-testid="create-csv-button">
        Create CSV Export
      </button>
      <button onClick={onClose} data-testid="close-button">
        Close
      </button>
    </div>
  ),
}));

vi.mock("../steps/export-creation-step", () => ({
  ExportCreationStep: ({
    format,
    status,
    errorMessage,
    onBackToList,
  }: {
    format: string;
    status: string;
    errorMessage?: string;
    onBackToList: () => void;
  }) => (
    <div data-testid="export-creation-step">
      <span data-testid="creation-format">{format}</span>
      <span data-testid="creation-status">{status}</span>
      {errorMessage && <span data-testid="creation-error">{errorMessage}</span>}
      <button onClick={onBackToList} data-testid="back-to-list-button">
        Back to list
      </button>
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
    capturedOnSuccess = undefined;
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
    expect(screen.queryByTestId("export-creation-step")).not.toBeInTheDocument();
  });

  it("transitions to creation step when format is selected", async () => {
    renderModal();

    fireEvent.click(screen.getByTestId("create-csv-button"));

    await waitFor(() => {
      expect(screen.getByTestId("export-creation-step")).toBeInTheDocument();
      expect(screen.queryByTestId("export-list-step")).not.toBeInTheDocument();
    });
  });

  it("calls initiateExport with correct params when format is selected", () => {
    renderModal();

    fireEvent.click(screen.getByTestId("create-csv-button"));

    expect(mockInitiateExport).toHaveBeenCalledWith(
      {
        params: { id: "test-experiment-123" },
        body: {
          tableName: "raw_data",
          format: "csv",
        },
      },
      expect.objectContaining({
        // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
        onError: expect.any(Function),
      }),
    );
  });

  it("passes selected format to creation step", async () => {
    renderModal();

    fireEvent.click(screen.getByTestId("create-csv-button"));

    await waitFor(() => {
      expect(screen.getByTestId("creation-format")).toHaveTextContent("csv");
    });
  });

  it("shows loading status initially on creation step", async () => {
    renderModal();

    fireEvent.click(screen.getByTestId("create-csv-button"));

    await waitFor(() => {
      expect(screen.getByTestId("creation-status")).toHaveTextContent("loading");
    });
  });

  it("shows success status after successful export creation", async () => {
    renderModal();

    fireEvent.click(screen.getByTestId("create-csv-button"));

    // Simulate success callback
    capturedOnSuccess?.();

    await waitFor(() => {
      expect(screen.getByTestId("creation-status")).toHaveTextContent("success");
    });
  });

  it("shows error status after failed export creation", async () => {
    mockInitiateExport.mockImplementation(
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (_params: unknown, options?: { onError?: (err: any) => void }) => {
        options?.onError?.({ body: { message: "Something went wrong" } });
      },
    );

    renderModal();

    fireEvent.click(screen.getByTestId("create-csv-button"));

    await waitFor(() => {
      expect(screen.getByTestId("creation-status")).toHaveTextContent("error");
    });
  });

  it("navigates back to list step when back button is clicked", async () => {
    renderModal();

    fireEvent.click(screen.getByTestId("create-csv-button"));

    await waitFor(() => {
      expect(screen.getByTestId("export-creation-step")).toBeInTheDocument();
    });

    fireEvent.click(screen.getByTestId("back-to-list-button"));

    await waitFor(() => {
      expect(screen.getByTestId("export-list-step")).toBeInTheDocument();
      expect(screen.queryByTestId("export-creation-step")).not.toBeInTheDocument();
    });
  });

  it("displays create title when on creation step", async () => {
    renderModal();

    fireEvent.click(screen.getByTestId("create-csv-button"));

    await waitFor(() => {
      expect(screen.getByText("experimentData.exportModal.createTitle")).toBeInTheDocument();
    });
  });

  it("closes modal when close button is clicked", () => {
    renderModal();

    fireEvent.click(screen.getByTestId("close-button"));

    expect(mockOnOpenChange).toHaveBeenCalledWith(false);
  });

  it("resets to list step when modal closes and reopens", () => {
    vi.useFakeTimers();

    const { rerender } = render(<DataExportModal {...defaultProps} open={true} />);

    fireEvent.click(screen.getByTestId("create-csv-button"));
    expect(screen.getByTestId("export-creation-step")).toBeInTheDocument();

    rerender(<DataExportModal {...defaultProps} open={false} />);
    vi.advanceTimersByTime(350);

    rerender(<DataExportModal {...defaultProps} open={true} />);
    expect(screen.getByTestId("export-list-step")).toBeInTheDocument();
    expect(screen.queryByTestId("export-creation-step")).not.toBeInTheDocument();

    vi.useRealTimers();
  });

  it("renders dialog header correctly", () => {
    renderModal();
    expect(screen.getByTestId("dialog-header")).toBeInTheDocument();
  });
});
