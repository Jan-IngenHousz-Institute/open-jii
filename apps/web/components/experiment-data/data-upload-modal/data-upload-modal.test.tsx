import "@testing-library/jest-dom";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import React from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { DataUploadModal } from "./data-upload-modal";

globalThis.React = React;

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

vi.mock("./steps/success-step", () => ({
  SuccessStep: ({ onClose }: { onClose: () => void }) => (
    <div data-testid="success-step">
      <button onClick={onClose} data-testid="close-button">
        Close
      </button>
    </div>
  ),
}));

vi.mock("@repo/i18n/client", () => ({
  useTranslation: () => ({
    t: (key: string) => key,
  }),
}));

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

  it("renders file upload step when open", () => {
    render(
      <DataUploadModal
        experimentId="test-experiment"
        open={true}
        onOpenChange={mockOnOpenChange}
      />,
    );
    expect(screen.getByTestId("dialog")).toBeInTheDocument();
    expect(screen.getByTestId("file-upload-step")).toBeInTheDocument();
  });

  it("does not render when closed", () => {
    render(
      <DataUploadModal
        experimentId="test-experiment"
        open={false}
        onOpenChange={mockOnOpenChange}
      />,
    );
    expect(screen.queryByTestId("dialog")).not.toBeInTheDocument();
  });

  it("closes modal on back", () => {
    render(
      <DataUploadModal
        experimentId="test-experiment"
        open={true}
        onOpenChange={mockOnOpenChange}
      />,
    );
    fireEvent.click(screen.getByTestId("back-button"));
    expect(mockOnOpenChange).toHaveBeenCalledWith(false);
  });

  it("transitions to success step on upload success", async () => {
    render(
      <DataUploadModal
        experimentId="test-experiment"
        open={true}
        onOpenChange={mockOnOpenChange}
      />,
    );
    fireEvent.click(screen.getByTestId("upload-success"));
    await waitFor(() => {
      expect(screen.getByTestId("success-step")).toBeInTheDocument();
      expect(screen.queryByTestId("file-upload-step")).not.toBeInTheDocument();
    });
  });

  it("closes modal from success step", async () => {
    render(
      <DataUploadModal
        experimentId="test-experiment"
        open={true}
        onOpenChange={mockOnOpenChange}
      />,
    );
    fireEvent.click(screen.getByTestId("upload-success"));
    await waitFor(() => {
      expect(screen.getByTestId("success-step")).toBeInTheDocument();
    });
    fireEvent.click(screen.getByTestId("close-button"));
    expect(mockOnOpenChange).toHaveBeenCalledWith(false);
  });

  it("resets to file-upload step when reopened", () => {
    const { rerender } = render(
      <DataUploadModal
        experimentId="test-experiment"
        open={true}
        onOpenChange={mockOnOpenChange}
      />,
    );

    // Go to success
    fireEvent.click(screen.getByTestId("upload-success"));

    // Close
    rerender(
      <DataUploadModal
        experimentId="test-experiment"
        open={false}
        onOpenChange={mockOnOpenChange}
      />,
    );

    // Reopen
    rerender(
      <DataUploadModal
        experimentId="test-experiment"
        open={true}
        onOpenChange={mockOnOpenChange}
      />,
    );

    expect(screen.getByTestId("file-upload-step")).toBeInTheDocument();
    expect(screen.queryByTestId("success-step")).not.toBeInTheDocument();
  });
});
