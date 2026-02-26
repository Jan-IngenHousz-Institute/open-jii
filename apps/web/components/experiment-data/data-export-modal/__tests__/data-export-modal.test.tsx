import { act, render, screen, userEvent, waitFor } from "@/test/test-utils";
import React from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

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

// Track toast calls
const mockToast = vi.hoisted(() => vi.fn());
vi.mock("@repo/ui/hooks", () => ({
  toast: mockToast,
}));

// Mock the step component
vi.mock("../steps/export-list-step", () => ({
  ExportListStep: ({
    onCreateExport,
    onClose,
    creationStatus,
  }: {
    experimentId: string;
    tableName: string;
    onCreateExport: (format: string) => void;
    onClose: () => void;
    creationStatus: string;
  }) => (
    <div data-testid="export-list-step">
      <span data-testid="creation-status">{creationStatus}</span>
      <button onClick={() => onCreateExport("csv")} data-testid="create-csv-button">
        Create CSV Export
      </button>
      <button onClick={onClose} data-testid="close-button">
        Close
      </button>
    </div>
  ),
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
    vi.resetAllMocks();
    capturedOnSuccess = undefined;
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  const renderModal = (props = {}) => {
    render(<DataExportModal {...defaultProps} {...props} />);
  };

  it("renders modal when open", () => {
    renderModal();
    expect(screen.getByRole("dialog")).toBeInTheDocument();
    expect(screen.getByText("experimentData.exportModal.title")).toBeInTheDocument();
  });

  it("does not render modal when closed", () => {
    renderModal({ open: false });
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("always shows export list step", () => {
    renderModal();
    expect(screen.getByTestId("export-list-step")).toBeInTheDocument();
  });

  it("passes idle creationStatus initially", () => {
    renderModal();
    expect(screen.getByTestId("creation-status")).toHaveTextContent("idle");
  });

  it("sets creationStatus to creating when export is initiated", async () => {
    renderModal();

    await userEvent.click(screen.getByTestId("create-csv-button"));

    expect(screen.getByTestId("creation-status")).toHaveTextContent("creating");
  });

  it("calls initiateExport with correct params when format is selected", async () => {
    renderModal();

    await userEvent.click(screen.getByTestId("create-csv-button"));

    expect(mockInitiateExport).toHaveBeenCalledWith(
      {
        params: { id: "test-experiment-123" },
        body: {
          tableName: "raw_data",
          format: "csv",
        },
      },
      expect.objectContaining({
        onError: expect.any(Function) as unknown,
      }),
    );
  });

  it("sets creationStatus to success and shows toast after successful export", async () => {
    renderModal();

    await userEvent.click(screen.getByTestId("create-csv-button"));

    capturedOnSuccess?.();

    await waitFor(() => {
      expect(screen.getByTestId("creation-status")).toHaveTextContent("success");
    });
    expect(mockToast).toHaveBeenCalledWith({
      description: "experimentData.exportModal.creationSuccess",
    });
  });

  it("resets creationStatus to idle after success delay", async () => {
    vi.useFakeTimers();

    renderModal();

    await act(async () => {
      await userEvent.click(screen.getByTestId("create-csv-button"));
    });

    act(() => {
      capturedOnSuccess?.();
    });

    expect(screen.getByTestId("creation-status")).toHaveTextContent("success");

    act(() => {
      vi.advanceTimersByTime(2000);
    });

    expect(screen.getByTestId("creation-status")).toHaveTextContent("idle");
  });

  it("resets creationStatus to idle and shows error toast on failure", async () => {
    mockInitiateExport.mockImplementation(
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (_params: unknown, options?: { onError?: (err: any) => void }) => {
        options?.onError?.({ body: { message: "Something went wrong" } });
      },
    );

    renderModal();

    await userEvent.click(screen.getByTestId("create-csv-button"));

    // Error callback fires synchronously in the mock, resetting status to idle
    expect(screen.getByTestId("creation-status")).toHaveTextContent("idle");
    expect(mockToast).toHaveBeenCalledWith({
      description: "Something went wrong",
      variant: "destructive",
    });
  });

  it("closes modal when close button is clicked", async () => {
    renderModal();

    await userEvent.click(screen.getByTestId("close-button"));

    expect(mockOnOpenChange).toHaveBeenCalledWith(false);
  });

  it("resets creationStatus when modal closes and reopens", async () => {
    vi.useFakeTimers();

    const { rerender } = render(<DataExportModal {...defaultProps} open={true} />);

    await act(async () => {
      await userEvent.click(screen.getByTestId("create-csv-button"));
    });
    expect(screen.getByTestId("creation-status")).toHaveTextContent("creating");

    rerender(<DataExportModal {...defaultProps} open={false} />);
    act(() => {
      vi.advanceTimersByTime(350);
    });

    rerender(<DataExportModal {...defaultProps} open={true} />);
    expect(screen.getByTestId("creation-status")).toHaveTextContent("idle");
  });

  it("renders dialog header correctly", () => {
    renderModal();
    expect(screen.getByRole("dialog")).toBeInTheDocument();
    expect(screen.getByText("experimentData.exportModal.title")).toBeInTheDocument();
  });
});
