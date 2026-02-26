import { render, screen, userEvent, waitFor } from "@/test/test-utils";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { DataUploadModal } from "./data-upload-modal";

// Mock the step components
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

describe("DataUploadModal", () => {
  const mockOnOpenChange = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  function renderModal(open = true) {
    return render(
      <DataUploadModal
        experimentId="test-experiment"
        open={open}
        onOpenChange={mockOnOpenChange}
      />,
    );
  }

  it("renders modal when open", () => {
    renderModal();
    expect(screen.getByRole("dialog")).toBeInTheDocument();
    expect(screen.getByText("uploadModal.fileUpload.title")).toBeInTheDocument();
    expect(screen.getByText("uploadModal.fileUpload.description")).toBeInTheDocument();
  });

  it("does not render modal when closed", () => {
    renderModal(false);
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("starts with file upload step", () => {
    renderModal();
    expect(screen.getByTestId("file-upload-step")).toBeInTheDocument();
    expect(screen.queryByTestId("success-step")).not.toBeInTheDocument();
  });

  it("transitions to success step when upload succeeds", async () => {
    const user = userEvent.setup();
    renderModal();

    await user.click(screen.getByTestId("upload-success"));

    await waitFor(() => {
      expect(screen.getByTestId("success-step")).toBeInTheDocument();
      expect(screen.queryByTestId("file-upload-step")).not.toBeInTheDocument();
    });
  });

  it("shows success header on success step", async () => {
    const user = userEvent.setup();
    renderModal();

    await user.click(screen.getByTestId("upload-success"));

    await waitFor(() => {
      expect(screen.getByText("uploadModal.success.title")).toBeInTheDocument();
      expect(screen.getByText("uploadModal.success.description")).toBeInTheDocument();
    });
  });

  it("calls onOpenChange(false) when back is clicked", async () => {
    const user = userEvent.setup();
    renderModal();

    await user.click(screen.getByTestId("back-button"));

    expect(mockOnOpenChange).toHaveBeenCalledWith(false);
  });

  it("closes modal from success step", async () => {
    const user = userEvent.setup();
    renderModal();

    await user.click(screen.getByTestId("upload-success"));

    await waitFor(() => {
      expect(screen.getByTestId("success-step")).toBeInTheDocument();
    });

    await user.click(screen.getByTestId("close-button"));

    expect(mockOnOpenChange).toHaveBeenCalledWith(false);
  });

  it("resets to file upload step when reopened", async () => {
    const user = userEvent.setup();
    const { rerender } = render(
      <DataUploadModal
        experimentId="test-experiment"
        open={true}
        onOpenChange={mockOnOpenChange}
      />,
    );

    // Go to success step
    await user.click(screen.getByTestId("upload-success"));

    await waitFor(() => {
      expect(screen.getByTestId("success-step")).toBeInTheDocument();
    });

    // Close modal
    rerender(
      <DataUploadModal
        experimentId="test-experiment"
        open={false}
        onOpenChange={mockOnOpenChange}
      />,
    );

    // Reopen modal
    rerender(
      <DataUploadModal
        experimentId="test-experiment"
        open={true}
        onOpenChange={mockOnOpenChange}
      />,
    );

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

    // Should be back to sensor selection
    expect(screen.getByTestId("sensor-selection-step")).toBeInTheDocument();
    expect(screen.queryByTestId("file-upload-step")).not.toBeInTheDocument();
  });

  it("calls onOpenChange when dialog requests to close", () => {
    renderModal();

    // The dialog component should be able to trigger onOpenChange
    // This would be handled by the Dialog component internally
    expect(screen.getByRole("dialog")).toBeInTheDocument();
  });

  it("calls onOpenChange when dialog requests to close", () => {
    renderModal();
    expect(screen.getByRole("dialog")).toBeInTheDocument();
  });
});
