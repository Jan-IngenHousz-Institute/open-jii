import { server } from "@/test/msw/server";
import { act, render, screen, userEvent, waitFor } from "@/test/test-utils";
import { afterEach, describe, expect, it, vi } from "vitest";

import { contract } from "@repo/api";
import { toast } from "@repo/ui/hooks";

import { DataExportModal } from "../data-export-modal";

// ExportListStep — sibling component (Rule 5: mock siblings in a parent-level test)
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
    <div>
      <p>{creationStatus}</p>
      <button onClick={() => onCreateExport("csv")}>Create CSV Export</button>
      <button onClick={onClose}>Close</button>
    </div>
  ),
}));

describe("DataExportModal", () => {
  const onOpenChange = vi.fn();
  const defaultProps = {
    experimentId: "test-experiment-123",
    tableName: "raw_data",
    open: true,
    onOpenChange,
  };

  afterEach(() => {
    vi.useRealTimers();
  });

  it("renders modal with title when open", () => {
    render(<DataExportModal {...defaultProps} />);
    expect(screen.getByRole("dialog")).toBeInTheDocument();
    expect(screen.getByText("experimentData.exportModal.title")).toBeInTheDocument();
  });

  it("does not render modal when closed", () => {
    render(<DataExportModal {...defaultProps} open={false} />);
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("shows idle creationStatus initially", () => {
    render(<DataExportModal {...defaultProps} />);
    expect(screen.getByText("idle")).toBeInTheDocument();
  });

  it("sets creationStatus to creating then success on export", async () => {
    const spy = server.mount(contract.experiments.initiateExport, {
      body: { status: "queued" },
    });

    render(<DataExportModal {...defaultProps} />);

    await userEvent.click(screen.getByRole("button", { name: "Create CSV Export" }));
    expect(screen.getByText("creating")).toBeInTheDocument();

    await waitFor(() => {
      expect(screen.getByText("success")).toBeInTheDocument();
    });

    expect(spy.callCount).toBe(1);
    expect(spy.body).toEqual({ tableName: "raw_data", format: "csv" });
    expect(vi.mocked(toast)).toHaveBeenCalledWith({
      description: "experimentData.exportModal.creationSuccess",
    });
  });

  it("resets creationStatus to idle after success delay", async () => {
    vi.useFakeTimers();
    server.mount(contract.experiments.initiateExport, {
      body: { status: "queued" },
    });

    render(<DataExportModal {...defaultProps} />);

    await act(async () => {
      await userEvent.click(screen.getByRole("button", { name: "Create CSV Export" }));
    });

    await waitFor(() => {
      expect(screen.getByText("success")).toBeInTheDocument();
    });

    act(() => {
      vi.advanceTimersByTime(2000);
    });

    expect(screen.getByText("idle")).toBeInTheDocument();
  });

  it("shows error toast on failure and resets to idle", async () => {
    server.mount(contract.experiments.initiateExport, {
      status: 400,
      body: { message: "Something went wrong" },
    });

    render(<DataExportModal {...defaultProps} />);

    await userEvent.click(screen.getByRole("button", { name: "Create CSV Export" }));

    await waitFor(() => {
      expect(vi.mocked(toast)).toHaveBeenCalledWith({
        description: "Something went wrong",
        variant: "destructive",
      });
    });

    expect(screen.getByText("idle")).toBeInTheDocument();
  });

  it("closes modal when close button is clicked", async () => {
    render(<DataExportModal {...defaultProps} />);
    await userEvent.click(screen.getByRole("button", { name: "Close" }));
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });

  it("resets creationStatus when modal closes and reopens", async () => {
    vi.useFakeTimers();
    server.mount(contract.experiments.initiateExport, {
      body: { status: "queued" },
    });

    const { rerender } = render(<DataExportModal {...defaultProps} open={true} />);

    await act(async () => {
      await userEvent.click(screen.getByRole("button", { name: "Create CSV Export" }));
    });
    expect(screen.getByText("creating")).toBeInTheDocument();

    rerender(<DataExportModal {...defaultProps} open={false} />);
    act(() => {
      vi.advanceTimersByTime(350);
    });

    rerender(<DataExportModal {...defaultProps} open={true} />);
    expect(screen.getByText("idle")).toBeInTheDocument();
  });
});
