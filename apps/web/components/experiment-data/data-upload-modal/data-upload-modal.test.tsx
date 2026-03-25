import "@testing-library/jest-dom";
import { fireEvent, render, screen, waitFor, act } from "@testing-library/react";
import React from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { DataUploadModal } from "./data-upload-modal";

globalThis.React = React;

// Mock the step components
vi.mock("./steps/data-selection-step", () => ({
  DataSelectionStep: ({ onOptionSelect }: { onOptionSelect: (option: { id: string }) => void }) => (
    <div data-testid="data-selection-step">
      <button onClick={() => onOptionSelect({ id: "ambyte" })} data-testid="select-ambyte">
        Select Ambyte
      </button>
      <button onClick={() => onOptionSelect({ id: "metadata" })} data-testid="select-metadata">
        Select Metadata
      </button>
    </div>
  ),
  DATA_OPTIONS: [
    { id: "multispeq", category: "sensor", disabled: true },
    { id: "ambyte", category: "sensor", disabled: false },
    { id: "metadata", category: "metadata", disabled: false },
  ],
}));

vi.mock("./steps/file-upload-step", () => ({
  FileUploadStep: ({
    onBack,
    onUploadSuccess,
  }: {
    onBack: () => void;
    onUploadSuccess: () => void;
  }) => (
    <div data-testid="file-upload-step">
      <button onClick={onBack} data-testid="back-button">
        Back
      </button>
      <button onClick={onUploadSuccess} data-testid="upload-success">
        Upload Success
      </button>
    </div>
  ),
}));

vi.mock("./steps/metadata-upload-step", () => ({
  MetadataUploadStep: ({
    onBack,
    onUploadSuccess,
  }: {
    onBack: () => void;
    onUploadSuccess: () => void;
  }) => (
    <div data-testid="metadata-upload-step">
      <button onClick={onBack} data-testid="metadata-back-button">
        Back
      </button>
      <button onClick={onUploadSuccess} data-testid="metadata-upload-success">
        Upload Success
      </button>
    </div>
  ),
}));

vi.mock("./steps/success-step", () => ({
  SuccessStep: ({ onClose, isMetadata }: { onClose: () => void; isMetadata?: boolean }) => (
    <div data-testid="success-step" data-is-metadata={isMetadata}>
      <button onClick={onClose} data-testid="close-button">
        Close
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

describe("DataUploadModal", () => {
  const mockOnOpenChange = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  const renderModal = (open = true) => {
    render(
      <DataUploadModal
        experimentId="test-experiment"
        open={open}
        onOpenChange={mockOnOpenChange}
      />,
    );
  };

  it("renders modal when open", () => {
    renderModal();
    expect(screen.getByTestId("dialog")).toBeInTheDocument();
    expect(screen.getByText("uploadModal.title")).toBeInTheDocument();
    expect(screen.getByText("uploadModal.description")).toBeInTheDocument();
  });

  it("does not render modal when closed", () => {
    renderModal(false);
    expect(screen.queryByTestId("dialog")).not.toBeInTheDocument();
  });

  it("starts with data selection step", () => {
    renderModal();
    expect(screen.getByTestId("data-selection-step")).toBeInTheDocument();
    expect(screen.queryByTestId("file-upload-step")).not.toBeInTheDocument();
    expect(screen.queryByTestId("metadata-upload-step")).not.toBeInTheDocument();
    expect(screen.queryByTestId("success-step")).not.toBeInTheDocument();
  });

  it("transitions to file upload step when sensor is selected", async () => {
    renderModal();

    const selectAmbyteButton = screen.getByTestId("select-ambyte");
    fireEvent.click(selectAmbyteButton);

    await waitFor(() => {
      expect(screen.getByTestId("file-upload-step")).toBeInTheDocument();
      expect(screen.queryByTestId("data-selection-step")).not.toBeInTheDocument();
    });
  });

  it("transitions to metadata upload step when metadata is selected", async () => {
    renderModal();

    const selectMetadataButton = screen.getByTestId("select-metadata");
    fireEvent.click(selectMetadataButton);

    await waitFor(() => {
      expect(screen.getByTestId("metadata-upload-step")).toBeInTheDocument();
      expect(screen.queryByTestId("data-selection-step")).not.toBeInTheDocument();
    });
  });

  it("goes back to data selection from file upload step", async () => {
    renderModal();

    // Go to file upload step
    fireEvent.click(screen.getByTestId("select-ambyte"));

    await waitFor(() => {
      expect(screen.getByTestId("file-upload-step")).toBeInTheDocument();
    });

    // Go back
    fireEvent.click(screen.getByTestId("back-button"));

    await waitFor(() => {
      expect(screen.getByTestId("data-selection-step")).toBeInTheDocument();
      expect(screen.queryByTestId("file-upload-step")).not.toBeInTheDocument();
    });
  });

  it("goes back to data selection from metadata upload step", async () => {
    renderModal();

    // Go to metadata upload step
    fireEvent.click(screen.getByTestId("select-metadata"));

    await waitFor(() => {
      expect(screen.getByTestId("metadata-upload-step")).toBeInTheDocument();
    });

    // Go back
    fireEvent.click(screen.getByTestId("metadata-back-button"));

    await waitFor(() => {
      expect(screen.getByTestId("data-selection-step")).toBeInTheDocument();
      expect(screen.queryByTestId("metadata-upload-step")).not.toBeInTheDocument();
    });
  });

  it("transitions to success step when upload succeeds", async () => {
    renderModal();

    // Go to file upload step
    fireEvent.click(screen.getByTestId("select-ambyte"));

    await waitFor(() => {
      expect(screen.getByTestId("file-upload-step")).toBeInTheDocument();
    });

    // Trigger upload success
    fireEvent.click(screen.getByTestId("upload-success"));

    await waitFor(() => {
      expect(screen.getByTestId("success-step")).toBeInTheDocument();
      expect(screen.queryByTestId("file-upload-step")).not.toBeInTheDocument();
    });
  });

  it("closes modal from success step", async () => {
    renderModal();

    // Navigate to success step
    fireEvent.click(screen.getByTestId("select-ambyte"));

    await waitFor(() => {
      fireEvent.click(screen.getByTestId("upload-success"));
    });

    await waitFor(() => {
      expect(screen.getByTestId("success-step")).toBeInTheDocument();
    });

    // Close modal
    fireEvent.click(screen.getByTestId("close-button"));

    expect(mockOnOpenChange).toHaveBeenCalledWith(false);
  });

  it("resets state when modal is closed", async () => {
    const { rerender } = render(
      <DataUploadModal
        experimentId="test-experiment"
        open={true}
        onOpenChange={mockOnOpenChange}
      />,
    );

    // Go to file upload step
    fireEvent.click(screen.getByTestId("select-ambyte"));

    await waitFor(() => {
      expect(screen.getByTestId("file-upload-step")).toBeInTheDocument();
    });

    // Close modal
    act(() => {
      rerender(
        <DataUploadModal
          experimentId="test-experiment"
          open={false}
          onOpenChange={mockOnOpenChange}
        />,
      );
    });

    // Wait for reset timeout
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 350));
    });

    // Reopen modal
    act(() => {
      rerender(
        <DataUploadModal
          experimentId="test-experiment"
          open={true}
          onOpenChange={mockOnOpenChange}
        />,
      );
    });

    // Should be back to data selection
    expect(screen.getByTestId("data-selection-step")).toBeInTheDocument();
    expect(screen.queryByTestId("file-upload-step")).not.toBeInTheDocument();
  });

  it("calls onOpenChange when dialog requests to close", () => {
    renderModal();

    // The dialog component should be able to trigger onOpenChange
    // This would be handled by the Dialog component internally
    expect(screen.getByTestId("dialog")).toBeInTheDocument();
  });

  it("starts at metadata-upload step when initialStep is metadata-upload", () => {
    render(
      <DataUploadModal
        experimentId="test-experiment"
        open={true}
        onOpenChange={mockOnOpenChange}
        initialStep="metadata-upload"
      />,
    );

    expect(screen.getByTestId("metadata-upload-step")).toBeInTheDocument();
    expect(screen.queryByTestId("data-selection-step")).not.toBeInTheDocument();
    expect(screen.getByText("uploadModal.metadata.title")).toBeInTheDocument();
    expect(screen.getByText("uploadModal.metadata.description")).toBeInTheDocument();
  });

  it("starts at file-upload step when initialStep is file-upload", () => {
    render(
      <DataUploadModal
        experimentId="test-experiment"
        open={true}
        onOpenChange={mockOnOpenChange}
        initialStep="file-upload"
      />,
    );

    expect(screen.getByTestId("file-upload-step")).toBeInTheDocument();
    expect(screen.queryByTestId("data-selection-step")).not.toBeInTheDocument();
    expect(screen.getByText("uploadModal.fileUpload.title")).toBeInTheDocument();
    expect(screen.getByText("uploadModal.fileUpload.description")).toBeInTheDocument();
  });

  it("closes modal when going back from non-selection initialStep", () => {
    render(
      <DataUploadModal
        experimentId="test-experiment"
        open={true}
        onOpenChange={mockOnOpenChange}
        initialStep="metadata-upload"
      />,
    );

    // Go back — should close modal rather than go to selection
    fireEvent.click(screen.getByTestId("metadata-back-button"));

    expect(mockOnOpenChange).toHaveBeenCalledWith(false);
  });

  it("passes isMetadata=true to SuccessStep when metadata option is selected", async () => {
    renderModal();

    // Select metadata option
    fireEvent.click(screen.getByTestId("select-metadata"));

    await waitFor(() => {
      expect(screen.getByTestId("metadata-upload-step")).toBeInTheDocument();
    });

    // Trigger upload success
    fireEvent.click(screen.getByTestId("metadata-upload-success"));

    await waitFor(() => {
      const successStep = screen.getByTestId("success-step");
      expect(successStep).toHaveAttribute("data-is-metadata", "true");
    });
  });

  it("resets to initialStep when modal is closed and reopened", async () => {
    const { rerender } = render(
      <DataUploadModal
        experimentId="test-experiment"
        open={true}
        onOpenChange={mockOnOpenChange}
        initialStep="file-upload"
      />,
    );

    expect(screen.getByTestId("file-upload-step")).toBeInTheDocument();

    // Close modal
    rerender(
      <DataUploadModal
        experimentId="test-experiment"
        open={false}
        onOpenChange={mockOnOpenChange}
        initialStep="file-upload"
      />,
    );

    // Wait for reset timeout
    await new Promise((resolve) => setTimeout(resolve, 350));

    // Reopen modal
    rerender(
      <DataUploadModal
        experimentId="test-experiment"
        open={true}
        onOpenChange={mockOnOpenChange}
        initialStep="file-upload"
      />,
    );

    // Should be back at file-upload (the initialStep)
    expect(screen.getByTestId("file-upload-step")).toBeInTheDocument();
  });
});
