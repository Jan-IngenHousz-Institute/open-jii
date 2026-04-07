import { render, screen, userEvent } from "@/test/test-utils";
import { describe, it, expect, vi, beforeEach } from "vitest";

import { CodeEditorHeaderActions } from "../code-editor-header-actions";

// ---------- Mocks ----------
vi.mock("lucide-react", () => ({
  Check: () => <span data-testid="icon-check">Check</span>,
  Circle: () => <span data-testid="icon-circle">Circle</span>,
  Loader2: () => <span data-testid="icon-loader">Loader2</span>,
  X: () => <span data-testid="icon-x">X</span>,
}));

vi.mock("@repo/ui/components", () => ({
  Button: ({
    children,
    onClick,
    className,
    variant,
    size,
  }: {
    children: React.ReactNode;
    onClick?: () => void;
    className?: string;
    variant?: string;
    size?: string;
  }) => (
    <button onClick={onClick} className={className} data-variant={variant} data-size={size}>
      {children}
    </button>
  ),
  Tooltip: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  TooltipContent: ({ children, side }: { children: React.ReactNode; side?: string }) => (
    <div data-testid="tooltip-content" data-side={side}>
      {children}
    </div>
  ),
  TooltipProvider: ({ children }: { children: React.ReactNode; delayDuration?: number }) => (
    <div>{children}</div>
  ),
  TooltipTrigger: ({ children, asChild }: { children: React.ReactNode; asChild?: boolean }) => (
    <div data-aschild={asChild}>{children}</div>
  ),
}));

// ---------- Helpers ----------
type SyncStatus = "synced" | "unsynced" | "syncing";

function renderComponent(syncStatus: SyncStatus, onClose = vi.fn()) {
  return {
    onClose,
    ...render(<CodeEditorHeaderActions syncStatus={syncStatus} onClose={onClose} />),
  };
}

// ---------- Tests ----------
describe("CodeEditorHeaderActions", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // ---------- Icon rendering ----------
  it("renders check icon when syncStatus is synced", () => {
    renderComponent("synced");
    expect(screen.getByTestId("icon-check")).toBeInTheDocument();
    expect(screen.queryByTestId("icon-circle")).not.toBeInTheDocument();
    expect(screen.queryByTestId("icon-loader")).not.toBeInTheDocument();
  });

  it("renders circle icon when syncStatus is unsynced", () => {
    renderComponent("unsynced");
    expect(screen.getByTestId("icon-circle")).toBeInTheDocument();
    expect(screen.queryByTestId("icon-check")).not.toBeInTheDocument();
    expect(screen.queryByTestId("icon-loader")).not.toBeInTheDocument();
  });

  it("renders loader icon when syncStatus is syncing", () => {
    renderComponent("syncing");
    expect(screen.getByTestId("icon-loader")).toBeInTheDocument();
    expect(screen.queryByTestId("icon-check")).not.toBeInTheDocument();
    expect(screen.queryByTestId("icon-circle")).not.toBeInTheDocument();
  });

  // ---------- Tooltip text ----------
  it("shows 'All changes saved' tooltip for synced", () => {
    renderComponent("synced");
    expect(screen.getByText("All changes saved")).toBeInTheDocument();
  });

  it("shows 'Unsaved changes' tooltip for unsynced", () => {
    renderComponent("unsynced");
    expect(screen.getByText("Unsaved changes")).toBeInTheDocument();
  });

  it("shows 'Saving...' tooltip for syncing", () => {
    renderComponent("syncing");
    expect(screen.getByText("Saving...")).toBeInTheDocument();
  });

  it("shows 'Close editor' tooltip for close button", () => {
    renderComponent("synced");
    expect(screen.getByText("Close editor")).toBeInTheDocument();
  });

  // ---------- Close button ----------
  it("calls onClose when close button is clicked", async () => {
    const user = userEvent.setup();
    const onClose = vi.fn();
    renderComponent("synced", onClose);

    const button = screen.getByRole("button");
    await user.click(button);

    expect(onClose).toHaveBeenCalledTimes(1);
  });
});
