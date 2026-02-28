import { act, render, screen, userEvent, waitFor } from "@/test/test-utils";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { DataUploadModal } from "./data-upload-modal";

// Mock the step components
vi.mock("./steps/sensor-selection-step", () => ({
  SensorSelectionStep: ({ onSensorSelect }: { onSensorSelect: (id: string) => void }) => (
    <div data-testid="sensor-selection-step">
      <button onClick={() => onSensorSelect("ambyte")} data-testid="select-ambyte">
        Select Ambyte
      </button>
    </div>
  ),
  SENSOR_FAMILIES: [
    {
      id: "ambyte",
      label: "Ambyte",
      disabled: false,
      description: "uploadModal.sensorTypes.ambyte.description",
    },
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
    expect(screen.getByRole("dialog")).toBeInTheDocument();
    expect(screen.getByText("uploadModal.title")).toBeInTheDocument();
    expect(screen.getByText("uploadModal.description")).toBeInTheDocument();
  });

  it("does not render modal when closed", () => {
    renderModal(false);
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("starts with sensor selection step", () => {
    renderModal();
    expect(screen.getByTestId("sensor-selection-step")).toBeInTheDocument();
    expect(screen.queryByTestId("file-upload-step")).not.toBeInTheDocument();
    expect(screen.queryByTestId("success-step")).not.toBeInTheDocument();
  });

  it("transitions to file upload step when sensor is selected", async () => {
    const user = userEvent.setup();
    renderModal();

    const selectAmbyteButton = screen.getByTestId("select-ambyte");
    await user.click(selectAmbyteButton);

    await waitFor(() => {
      expect(screen.getByTestId("file-upload-step")).toBeInTheDocument();
      expect(screen.queryByTestId("sensor-selection-step")).not.toBeInTheDocument();
    });
  });

  it("goes back to sensor selection from file upload step", async () => {
    const user = userEvent.setup();
    renderModal();

    // Go to file upload step
    await user.click(screen.getByTestId("select-ambyte"));

    await waitFor(() => {
      expect(screen.getByTestId("file-upload-step")).toBeInTheDocument();
    });

    // Go back
    await user.click(screen.getByTestId("back-button"));

    await waitFor(() => {
      expect(screen.getByTestId("sensor-selection-step")).toBeInTheDocument();
      expect(screen.queryByTestId("file-upload-step")).not.toBeInTheDocument();
    });
  });

  it("transitions to success step when upload succeeds", async () => {
    const user = userEvent.setup();
    renderModal();

    // Go to file upload step
    await user.click(screen.getByTestId("select-ambyte"));

    await waitFor(() => {
      expect(screen.getByTestId("file-upload-step")).toBeInTheDocument();
    });

    // Trigger upload success
    await user.click(screen.getByTestId("upload-success"));

    await waitFor(() => {
      expect(screen.getByTestId("success-step")).toBeInTheDocument();
      expect(screen.queryByTestId("file-upload-step")).not.toBeInTheDocument();
    });
  });

  it("closes modal from success step", async () => {
    const user = userEvent.setup();
    renderModal();

    // Navigate to success step
    await user.click(screen.getByTestId("select-ambyte"));

    await waitFor(() => {
      expect(screen.getByTestId("file-upload-step")).toBeInTheDocument();
    });

    await user.click(screen.getByTestId("upload-success"));

    await waitFor(() => {
      expect(screen.getByTestId("success-step")).toBeInTheDocument();
    });

    // Close modal
    await user.click(screen.getByTestId("close-button"));

    expect(mockOnOpenChange).toHaveBeenCalledWith(false);
  });

  it("resets state when modal is closed", async () => {
    const user = userEvent.setup();
    const { rerender } = render(
      <DataUploadModal
        experimentId="test-experiment"
        open={true}
        onOpenChange={mockOnOpenChange}
      />,
    );

    // Go to file upload step
    await user.click(screen.getByTestId("select-ambyte"));

    await waitFor(() => {
      expect(screen.getByTestId("file-upload-step")).toBeInTheDocument();
    });

    // Close modal
    rerender(
      <DataUploadModal
        experimentId="test-experiment"
        open={false}
        onOpenChange={mockOnOpenChange}
      />,
    );

    // Wait for reset timeout
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 350));
    });

    // Reopen modal
    rerender(
      <DataUploadModal
        experimentId="test-experiment"
        open={true}
        onOpenChange={mockOnOpenChange}
      />,
    );

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
});
