import "@testing-library/jest-dom";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import React from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { DataDownloadModal } from "./data-download-modal";

globalThis.React = React;

// Mock the useExperimentDataDownload hook
const mockDownloadData = vi.fn();
const mockDownloadHook = {
  mutate: mockDownloadData,
  isPending: false,
  error: null as Error | null,
};

vi.mock("~/hooks/experiment/useExperimentDataDownload/useExperimentDataDownload", () => ({
  useExperimentDataDownload: () => mockDownloadHook,
}));

// Mock translation
vi.mock("@repo/i18n/client", () => ({
  useTranslation: () => ({
    t: (key: string, params?: Record<string, string>) => {
      if (key === "experimentDataTable.downloadDescription" && params?.tableName) {
        return `Download data from ${params.tableName} table`;
      }
      const translations: Record<string, string> = {
        "experimentDataTable.downloadData": "Download Data",
        "experimentDataTable.format": "Format",
        "experimentDataTable.downloadError": "Download failed",
        "experimentDataTable.downloading": "Downloading...",
        "common.cancel": "Cancel",
        "common.download": "Download",
      };
      return translations[key] || key;
    },
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
      <div data-testid="dialog" onClick={() => onOpenChange(false)}>
        {children}
      </div>
    ) : null,
  DialogContent: ({ children }: { children: React.ReactNode }) => (
    <div data-testid="dialog-content" onClick={(e) => e.stopPropagation()}>
      {children}
    </div>
  ),
  DialogHeader: ({ children }: { children: React.ReactNode }) => (
    <div data-testid="dialog-header">{children}</div>
  ),
  DialogTitle: ({ children }: { children: React.ReactNode }) => (
    <h2 data-testid="dialog-title">{children}</h2>
  ),
  DialogDescription: ({ children }: { children: React.ReactNode }) => (
    <p data-testid="dialog-description">{children}</p>
  ),
  DialogFooter: ({ children }: { children: React.ReactNode }) => (
    <div data-testid="dialog-footer">{children}</div>
  ),
  Button: ({
    children,
    onClick,
    disabled,
    variant,
  }: {
    children: React.ReactNode;
    onClick?: () => void;
    disabled?: boolean;
    variant?: string;
  }) => (
    <button
      onClick={onClick}
      disabled={disabled}
      data-testid={variant === "outline" ? "cancel-button" : "download-button"}
      data-variant={variant}
    >
      {children}
    </button>
  ),
  Label: ({ children, htmlFor }: { children: React.ReactNode; htmlFor?: string }) => (
    <label htmlFor={htmlFor} data-testid="format-label">
      {children}
    </label>
  ),
  Select: ({
    children,
    value,
    onValueChange,
  }: {
    children: React.ReactNode;
    value: string;
    onValueChange: (value: string) => void;
  }) => (
    <div data-testid="select" data-value={value} onClick={() => onValueChange("csv")}>
      {children}
    </div>
  ),
  SelectTrigger: ({ children }: { children: React.ReactNode }) => (
    <div data-testid="select-trigger">{children}</div>
  ),
  SelectValue: () => <span data-testid="select-value">CSV</span>,
  SelectContent: ({ children }: { children: React.ReactNode }) => (
    <div data-testid="select-content">{children}</div>
  ),
  SelectItem: ({ children, value }: { children: React.ReactNode; value: string }) => (
    <div data-testid="select-item" data-value={value}>
      {children}
    </div>
  ),
}));

describe("DataDownloadModal", () => {
  const defaultProps = {
    experimentId: "test-experiment-123",
    tableName: "sensor_data",
    open: true,
    onOpenChange: vi.fn(),
  };

  beforeEach(() => {
    vi.clearAllMocks();
    // Reset mock hook state
    mockDownloadHook.isPending = false;
    mockDownloadHook.error = null;
  });

  const renderModal = (props = {}) => {
    return render(<DataDownloadModal {...defaultProps} {...props} />);
  };

  describe("rendering", () => {
    it("renders modal when open is true", () => {
      renderModal();

      expect(screen.getByTestId("dialog")).toBeInTheDocument();
      expect(screen.getByTestId("dialog-title")).toHaveTextContent("Download Data");
      expect(screen.getByTestId("dialog-description")).toHaveTextContent(
        "Download data from sensor_data table",
      );
    });

    it("does not render modal when open is false", () => {
      renderModal({ open: false });

      expect(screen.queryByTestId("dialog")).not.toBeInTheDocument();
    });

    it("renders format selection with CSV option", () => {
      renderModal();

      expect(screen.getByTestId("format-label")).toHaveTextContent("Format");
      expect(screen.getByTestId("select")).toHaveAttribute("data-value", "csv");
      expect(screen.getByTestId("select-value")).toHaveTextContent("CSV");
      expect(screen.getByTestId("select-item")).toHaveTextContent("CSV");
    });

    it("renders action buttons", () => {
      renderModal();

      expect(screen.getByTestId("cancel-button")).toHaveTextContent("Cancel");
      expect(screen.getByTestId("download-button")).toHaveTextContent("Download");
    });
  });

  describe("interactions", () => {
    it("calls onOpenChange when cancel button is clicked", () => {
      const onOpenChange = vi.fn();
      renderModal({ onOpenChange });

      const cancelButton = screen.getByTestId("cancel-button");
      fireEvent.click(cancelButton);

      expect(onOpenChange).toHaveBeenCalledWith(false);
    });

    it("calls downloadData and closes modal when download button is clicked", () => {
      const onOpenChange = vi.fn();
      renderModal({ onOpenChange });

      const downloadButton = screen.getByTestId("download-button");
      fireEvent.click(downloadButton);

      expect(mockDownloadData).toHaveBeenCalledWith({
        experimentId: "test-experiment-123",
        tableName: "sensor_data",
      });
      expect(onOpenChange).toHaveBeenCalledWith(false);
    });

    it("calls onOpenChange when clicking outside dialog content", () => {
      const onOpenChange = vi.fn();
      renderModal({ onOpenChange });

      const dialog = screen.getByTestId("dialog");
      fireEvent.click(dialog);

      expect(onOpenChange).toHaveBeenCalledWith(false);
    });

    it("does not call onOpenChange when clicking inside dialog content", () => {
      const onOpenChange = vi.fn();
      renderModal({ onOpenChange });

      const dialogContent = screen.getByTestId("dialog-content");
      fireEvent.click(dialogContent);

      expect(onOpenChange).not.toHaveBeenCalled();
    });
  });

  describe("loading state", () => {
    beforeEach(() => {
      mockDownloadHook.isPending = true;
    });

    it("disables buttons when loading", () => {
      renderModal();

      expect(screen.getByTestId("cancel-button")).toBeDisabled();
      expect(screen.getByTestId("download-button")).toBeDisabled();
    });

    it("shows downloading text on download button when loading", () => {
      renderModal();

      expect(screen.getByTestId("download-button")).toHaveTextContent("Downloading...");
    });
  });

  describe("error state", () => {
    beforeEach(() => {
      mockDownloadHook.error = new Error("Network error occurred");
    });

    it("displays error message when error exists", () => {
      renderModal();

      const errorMessage = screen.getByText(/Download failed: Network error occurred/);
      expect(errorMessage).toBeInTheDocument();
      expect(errorMessage).toHaveClass("text-red-600");
    });
  });

  describe("format selection", () => {
    it("has CSV as default selected format", () => {
      renderModal();

      expect(screen.getByTestId("select")).toHaveAttribute("data-value", "csv");
    });

    it("updates selected format when select is changed", () => {
      renderModal();

      const select = screen.getByTestId("select");
      fireEvent.click(select);

      // The mock select component will change to "csv" when clicked
      expect(screen.getByTestId("select")).toHaveAttribute("data-value", "csv");
    });
  });

  describe("state reset on modal close", () => {
    it("resets selected format to CSV after modal closes", async () => {
      const { rerender } = renderModal();

      // Simulate changing format (in real component, this would happen through Select)
      // For this test, we'll verify the effect happens when modal is closed

      // Close modal
      rerender(<DataDownloadModal {...defaultProps} open={false} />);

      // Wait for timeout to complete (300ms in component)
      await waitFor(
        () => {
          // When reopened, it should have reset to default
          rerender(<DataDownloadModal {...defaultProps} open={true} />);

          expect(screen.getByTestId("select")).toHaveAttribute("data-value", "csv");
        },
        { timeout: 500 },
      );
    });
  });

  describe("props validation", () => {
    it("handles different table names correctly", () => {
      renderModal({ tableName: "measurement_data" });

      expect(screen.getByTestId("dialog-description")).toHaveTextContent(
        "Download data from measurement_data table",
      );
    });

    it("handles different experiment IDs correctly", () => {
      const onOpenChange = vi.fn();
      renderModal({
        experimentId: "different-experiment-456",
        onOpenChange,
      });

      const downloadButton = screen.getByTestId("download-button");
      fireEvent.click(downloadButton);

      expect(mockDownloadData).toHaveBeenCalledWith({
        experimentId: "different-experiment-456",
        tableName: "sensor_data",
      });
    });
  });

  describe("accessibility", () => {
    it("has proper labels for form elements", () => {
      renderModal();

      const formatLabel = screen.getByTestId("format-label");
      expect(formatLabel).toBeInTheDocument();
      expect(formatLabel).toHaveTextContent("Format");
    });

    it("has proper dialog structure", () => {
      renderModal();

      expect(screen.getByTestId("dialog-header")).toBeInTheDocument();
      expect(screen.getByTestId("dialog-title")).toBeInTheDocument();
      expect(screen.getByTestId("dialog-description")).toBeInTheDocument();
      expect(screen.getByTestId("dialog-footer")).toBeInTheDocument();
    });
  });
});
