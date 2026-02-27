import { server } from "@/test/msw/server";
import { act, render, screen, userEvent, waitFor } from "@/test/test-utils";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

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
      <button data-testid="step-close" onClick={onClose}>
        Close Step
      </button>
    </div>
  ),
}));

// Mock translation — append interpolation params so we can assert on them
vi.mock("@repo/i18n/client", () => ({
  useTranslation: () => ({
    t: (key: string, params?: Record<string, string>) => {
      if (params) {
        const serialized = Object.entries(params)
          .map(([k, v]) => `${k}:${v}`)
          .join(",");
        return `${key}|${serialized}`;
      }
      return key;
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
  const onOpenChange = vi.fn();
  const defaultProps = {
    experimentId: "test-experiment-123",
    tableName: "raw_data",
    open: true,
    onOpenChange,
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

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
    const spy = mountExportHandlers();

    render(<DataExportModal {...defaultProps} />);

    const user = userEvent.setup();
    await user.click(screen.getByRole("button", { name: "Create CSV Export" }));

    // After the click the full mutation lifecycle has settled (MSW responds
    // synchronously), so the status has already transitioned through
    // "creating" → "success".
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
    vi.useFakeTimers({ shouldAdvanceTime: true });
    mountExportHandlers();

    render(<DataExportModal {...defaultProps} />);

    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime.bind(vi) });
    await user.click(screen.getByRole("button", { name: "Create CSV Export" }));

    await waitFor(() => {
      expect(screen.getByText("success")).toBeInTheDocument();
    });

    act(() => {
      vi.advanceTimersByTime(2000);
    });

    expect(screen.getByText("idle")).toBeInTheDocument();
  });

  it("shows error toast on failure and resets to idle", async () => {
    mountExportHandlers({
      status: 400,
      body: { message: "Something went wrong" },
    });

    render(<DataExportModal {...defaultProps} />);

    const user = userEvent.setup();
    await user.click(screen.getByRole("button", { name: "Create CSV Export" }));

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
    const user = userEvent.setup();
    await user.click(screen.getByTestId("step-close"));
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });

  it("resets creationStatus when modal closes and reopens", async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    mountExportHandlers();

    const { rerender } = render(<DataExportModal {...defaultProps} open={true} />);

    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime.bind(vi) });
    await user.click(screen.getByRole("button", { name: "Create CSV Export" }));

    await waitFor(() => {
      expect(screen.getByText("success")).toBeInTheDocument();
    });

    rerender(<DataExportModal {...defaultProps} open={false} />);
    act(() => {
      vi.advanceTimersByTime(350);
    });

    rerender(<DataExportModal {...defaultProps} open={true} />);
    expect(screen.getByText("idle")).toBeInTheDocument();
  });

  it("shows displayName in description when provided", () => {
    renderModal({ displayName: "My Experiment Data" });
    const description = screen.getByTestId("dialog-description");
    expect(description).toHaveTextContent("tableName:My Experiment Data");
  });

  it("falls back to tableName in description when displayName is not provided", () => {
    renderModal();
    const description = screen.getByTestId("dialog-description");
    expect(description).toHaveTextContent("tableName:raw_data");
  });
});
