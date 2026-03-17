import "@testing-library/jest-dom";
import { render, screen, fireEvent, act } from "@testing-library/react";
import React from "react";
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

import { toast } from "@repo/ui/hooks";

import ProtocolOverviewPage from "../page";

globalThis.React = React;

// Mock React's use function to resolve the params promise synchronously
vi.mock("react", async () => {
  const actual = await vi.importActual("react");
  return {
    ...actual,
    use: vi.fn().mockReturnValue({ id: "proto-1" }),
  };
});

// --------------------
// Mocks
// --------------------

interface MockProtocolReturn {
  data: { body: Record<string, unknown> } | undefined;
  isLoading: boolean;
  error: unknown;
}

const mockUseProtocol = vi.fn<() => MockProtocolReturn>();
vi.mock("@/hooks/protocol/useProtocol/useProtocol", () => ({
  useProtocol: () => mockUseProtocol(),
}));

const mockMutateAsync = vi.fn();
const mockMutate = vi.fn();

interface MockProtocolUpdateReturn {
  mutateAsync: typeof mockMutateAsync;
  mutate: typeof mockMutate;
  isPending: boolean;
}

const mockUseProtocolUpdate = vi.fn<() => MockProtocolUpdateReturn>();
vi.mock("@/hooks/protocol/useProtocolUpdate/useProtocolUpdate", () => ({
  useProtocolUpdate: () => mockUseProtocolUpdate(),
}));

vi.mock("@repo/auth/client", () => ({
  useSession: () => ({
    data: { user: { id: "user-123" } },
  }),
}));

vi.mock("@repo/i18n", () => ({
  useTranslation: () => ({
    t: (k: string) => k,
  }),
}));

vi.mock("@repo/ui/hooks", () => ({
  toast: vi.fn(),
}));

vi.mock("~/util/apiError", () => ({
  parseApiError: (err: unknown) => ({ message: String(err) }),
}));

vi.mock("@/components/error-display", () => ({
  ErrorDisplay: ({ title }: { error: unknown; title: string }) => (
    <div data-testid="error-display">{title}</div>
  ),
}));

vi.mock("@/components/json-code-viewer", () => ({
  JsonCodeViewer: ({
    value,
    title,
    onEditStart,
  }: {
    value: unknown;
    height?: string;
    title?: React.ReactNode;
    headerActions?: React.ReactNode;
    onEditStart?: () => void;
  }) => (
    <pre data-testid="json-viewer">
      {title && <span data-testid="viewer-title">{title}</span>}
      {onEditStart && (
        <span data-testid="viewer-actions">
          <button onClick={onEditStart}>
            common.edit
            <span data-testid="pencil-icon" />
          </button>
        </span>
      )}
      {JSON.stringify(value)}
    </pre>
  ),
}));

vi.mock("@/components/protocol-code-editor", () => ({
  default: ({
    value,
    title,
    headerActions,
    onChange,
  }: {
    value: unknown;
    onChange: (v: unknown) => void;
    onValidationChange: (v: boolean) => void;
    label: string;
    placeholder?: string;
    title?: React.ReactNode;
    headerActions?: React.ReactNode;
  }) => (
    <div data-testid="protocol-code-editor">
      {title && <span data-testid="editor-title">{title}</span>}
      {headerActions && <span data-testid="editor-actions">{headerActions}</span>}
      <button data-testid="editor-change-btn" onClick={() => onChange([{ averages: 2 }])}>
        Change
      </button>
      <button data-testid="editor-change-same-btn" onClick={() => onChange([{ averages: 1 }])}>
        ChangeSame
      </button>
      <button data-testid="editor-change-string-btn" onClick={() => onChange("not-an-array")}>
        ChangeString
      </button>
      {JSON.stringify(value)}
    </div>
  ),
}));

vi.mock("@/components/protocol-overview/protocol-details-sidebar", () => ({
  ProtocolDetailsSidebar: ({
    protocolId,
    protocol,
  }: {
    protocolId: string;
    protocol: Record<string, unknown>;
  }) => (
    <div data-testid="protocol-details-sidebar">
      <span data-testid="sidebar-protocol-id">{protocolId}</span>
      <span data-testid="sidebar-protocol-name">{String(protocol.name)}</span>
    </div>
  ),
}));

vi.mock("@/components/shared/inline-editable-description", () => ({
  InlineEditableDescription: ({
    description,
    title,
    hasAccess,
    onSave,
  }: {
    description: string;
    hasAccess?: boolean;
    onSave: (v: string) => Promise<void>;
    isPending?: boolean;
    title?: string;
    saveLabel?: string;
    cancelLabel?: string;
    placeholder?: string;
  }) => (
    <div data-testid="inline-editable-description">
      <span data-testid="description-title">{title}</span>
      <span data-testid="description-content">{description}</span>
      <span data-testid="description-has-access">{String(hasAccess ?? false)}</span>
      <button data-testid="description-save-btn" onClick={() => onSave("updated description")}>
        Save
      </button>
    </div>
  ),
}));

vi.mock("lucide-react", () => ({
  Check: ({ className }: { className?: string }) => (
    <span data-testid="check-icon" className={className} />
  ),
  Circle: ({ className }: { className?: string }) => (
    <span data-testid="circle-icon" className={className} />
  ),
  Loader2: ({ className }: { className?: string }) => (
    <span data-testid="loader2-icon" className={className} />
  ),
  Pencil: ({ className }: { className?: string }) => (
    <span data-testid="pencil-icon" className={className} />
  ),
  X: ({ className }: { className?: string }) => <span data-testid="x-icon" className={className} />,
}));

vi.mock("@repo/ui/components", () => {
  const Card = ({ children, className }: React.HTMLAttributes<HTMLDivElement>) => (
    <div data-testid="card" className={className}>
      {children}
    </div>
  );
  const CardHeader = ({ children }: React.HTMLAttributes<HTMLDivElement>) => (
    <div data-testid="card-header">{children}</div>
  );
  const CardContent = ({ children, className }: React.HTMLAttributes<HTMLDivElement>) => (
    <div data-testid="card-content" className={className}>
      {children}
    </div>
  );
  const Button = ({
    children,
    onClick,
    disabled,
    variant,
    size,
  }: React.ButtonHTMLAttributes<HTMLButtonElement> & {
    variant?: string;
    size?: string;
  }) => (
    <button
      data-testid="button"
      data-variant={variant}
      data-size={size}
      onClick={onClick}
      disabled={disabled}
    >
      {children}
    </button>
  );
  const Tooltip = ({ children }: { children: React.ReactNode }) => <>{children}</>;
  const TooltipContent = ({ children }: { children: React.ReactNode }) => (
    <span data-testid="tooltip-content">{children}</span>
  );
  const TooltipProvider = ({ children }: { children: React.ReactNode }) => <>{children}</>;
  const TooltipTrigger = ({ children }: { children: React.ReactNode; asChild?: boolean }) => (
    <>{children}</>
  );
  return {
    Card,
    CardHeader,
    CardContent,
    Button,
    Tooltip,
    TooltipContent,
    TooltipProvider,
    TooltipTrigger,
  };
});

// --------------------
// Test data
// --------------------

const mockProtocol = {
  id: "proto-1",
  name: "Water Quality Protocol",
  description: "Measures water quality parameters",
  family: "multispeq",
  code: [{ averages: 1 }],
  createdAt: "2025-01-01T00:00:00Z",
  updatedAt: "2025-06-15T00:00:00Z",
  createdByName: "Dr. Smith",
  createdBy: "other-user",
};

// --------------------
// Tests
// --------------------

describe("ProtocolOverviewPage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();

    mockUseProtocolUpdate.mockReturnValue({
      mutateAsync: mockMutateAsync,
      mutate: mockMutate,
      isPending: false,
    });
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("should render loading state", () => {
    mockUseProtocol.mockReturnValue({
      data: undefined,
      isLoading: true,
      error: null,
    });

    render(<ProtocolOverviewPage params={Promise.resolve({ id: "proto-1" })} />);

    expect(screen.getByText("common.loading")).toBeInTheDocument();
  });

  it("should render error state", () => {
    mockUseProtocol.mockReturnValue({
      data: undefined,
      isLoading: false,
      error: { status: 500, message: "Server error" },
    });

    render(<ProtocolOverviewPage params={Promise.resolve({ id: "proto-1" })} />);

    expect(screen.getByTestId("error-display")).toBeInTheDocument();
    expect(screen.getByText("errors.failedToLoadProtocol")).toBeInTheDocument();
  });

  it("should render not found state when no data", () => {
    mockUseProtocol.mockReturnValue({
      data: undefined,
      isLoading: false,
      error: null,
    });

    render(<ProtocolOverviewPage params={Promise.resolve({ id: "proto-1" })} />);

    expect(screen.getByText("protocols.notFound")).toBeInTheDocument();
  });

  it("should render the sidebar and main content area on success", () => {
    mockUseProtocol.mockReturnValue({
      data: { body: mockProtocol },
      isLoading: false,
      error: null,
    });

    render(<ProtocolOverviewPage params={Promise.resolve({ id: "proto-1" })} />);

    expect(screen.getByTestId("protocol-details-sidebar")).toBeInTheDocument();
    expect(screen.getByTestId("sidebar-protocol-id")).toHaveTextContent("proto-1");
    expect(screen.getByTestId("sidebar-protocol-name")).toHaveTextContent("Water Quality Protocol");
  });

  it("should render the inline editable description with correct props", () => {
    mockUseProtocol.mockReturnValue({
      data: { body: mockProtocol },
      isLoading: false,
      error: null,
    });

    render(<ProtocolOverviewPage params={Promise.resolve({ id: "proto-1" })} />);

    expect(screen.getByTestId("inline-editable-description")).toBeInTheDocument();
    expect(screen.getByTestId("description-title")).toHaveTextContent("protocols.descriptionTitle");
    expect(screen.getByTestId("description-content")).toHaveTextContent(
      "Measures water quality parameters",
    );
  });

  it("should pass hasAccess=false to description when user is not the creator", () => {
    mockUseProtocol.mockReturnValue({
      data: { body: { ...mockProtocol, createdBy: "other-user" } },
      isLoading: false,
      error: null,
    });

    render(<ProtocolOverviewPage params={Promise.resolve({ id: "proto-1" })} />);

    expect(screen.getByTestId("description-has-access")).toHaveTextContent("false");
  });

  it("should pass hasAccess=true to description when user is the creator", () => {
    mockUseProtocol.mockReturnValue({
      data: { body: { ...mockProtocol, createdBy: "user-123" } },
      isLoading: false,
      error: null,
    });

    render(<ProtocolOverviewPage params={Promise.resolve({ id: "proto-1" })} />);

    expect(screen.getByTestId("description-has-access")).toHaveTextContent("true");
  });

  it("should render the code viewer with title", () => {
    mockUseProtocol.mockReturnValue({
      data: { body: mockProtocol },
      isLoading: false,
      error: null,
    });

    render(<ProtocolOverviewPage params={Promise.resolve({ id: "proto-1" })} />);

    expect(screen.getByTestId("viewer-title")).toHaveTextContent("protocols.codeTitle");
  });

  it("should render JsonCodeViewer with protocol code when not editing", () => {
    mockUseProtocol.mockReturnValue({
      data: { body: mockProtocol },
      isLoading: false,
      error: null,
    });

    render(<ProtocolOverviewPage params={Promise.resolve({ id: "proto-1" })} />);

    expect(screen.getByTestId("json-viewer")).toBeInTheDocument();
    expect(screen.queryByTestId("protocol-code-editor")).not.toBeInTheDocument();
  });

  it("should show the edit button for the creator when not editing", () => {
    mockUseProtocol.mockReturnValue({
      data: { body: { ...mockProtocol, createdBy: "user-123" } },
      isLoading: false,
      error: null,
    });

    render(<ProtocolOverviewPage params={Promise.resolve({ id: "proto-1" })} />);

    const editButton = screen.getByRole("button", { name: /common\.edit/i });
    expect(editButton).toBeInTheDocument();
    expect(screen.getByTestId("pencil-icon")).toBeInTheDocument();
  });

  it("should not show the edit button for non-creators", () => {
    mockUseProtocol.mockReturnValue({
      data: { body: { ...mockProtocol, createdBy: "other-user" } },
      isLoading: false,
      error: null,
    });

    render(<ProtocolOverviewPage params={Promise.resolve({ id: "proto-1" })} />);

    expect(screen.queryByRole("button", { name: /common\.edit/i })).not.toBeInTheDocument();
    expect(screen.queryByTestId("pencil-icon")).not.toBeInTheDocument();
  });

  it("should handle null description gracefully", () => {
    mockUseProtocol.mockReturnValue({
      data: { body: { ...mockProtocol, description: null } },
      isLoading: false,
      error: null,
    });

    render(<ProtocolOverviewPage params={Promise.resolve({ id: "proto-1" })} />);

    expect(screen.getByTestId("description-content")).toHaveTextContent("");
  });

  it("should call toast with success message when description save succeeds", () => {
    mockMutateAsync.mockImplementation((_data: unknown, opts: { onSuccess?: () => void }) => {
      opts.onSuccess?.();
      return Promise.resolve();
    });

    mockUseProtocol.mockReturnValue({
      data: { body: { ...mockProtocol, createdBy: "user-123" } },
      isLoading: false,
      error: null,
    });

    render(<ProtocolOverviewPage params={Promise.resolve({ id: "proto-1" })} />);

    act(() => {
      fireEvent.click(screen.getByTestId("description-save-btn"));
    });

    expect(mockMutateAsync).toHaveBeenCalledWith(
      { params: { id: "proto-1" }, body: { description: "updated description" } },
      expect.objectContaining({
        onSuccess: expect.any(Function) as unknown,
        onError: expect.any(Function) as unknown,
      }),
    );
    expect(toast).toHaveBeenCalledWith({ description: "protocols.protocolUpdated" });
  });

  it("should call toast with destructive variant when description save fails", () => {
    mockMutateAsync.mockImplementation(
      (_data: unknown, opts: { onError?: (err: unknown) => void }) => {
        opts.onError?.("save failed");
        return Promise.resolve();
      },
    );

    mockUseProtocol.mockReturnValue({
      data: { body: { ...mockProtocol, createdBy: "user-123" } },
      isLoading: false,
      error: null,
    });

    render(<ProtocolOverviewPage params={Promise.resolve({ id: "proto-1" })} />);

    act(() => {
      fireEvent.click(screen.getByTestId("description-save-btn"));
    });

    expect(toast).toHaveBeenCalledWith({
      description: "save failed",
      variant: "destructive",
    });
  });

  it("should switch to ProtocolCodeEditor when creator clicks edit button", () => {
    mockUseProtocol.mockReturnValue({
      data: { body: { ...mockProtocol, createdBy: "user-123" } },
      isLoading: false,
      error: null,
    });

    render(<ProtocolOverviewPage params={Promise.resolve({ id: "proto-1" })} />);

    expect(screen.getByTestId("json-viewer")).toBeInTheDocument();
    expect(screen.queryByTestId("protocol-code-editor")).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: /common\.edit/i }));

    expect(screen.getByTestId("protocol-code-editor")).toBeInTheDocument();
    expect(screen.queryByTestId("json-viewer")).not.toBeInTheDocument();
  });

  it("should close editor without saving when no changes were made", () => {
    mockUseProtocol.mockReturnValue({
      data: { body: { ...mockProtocol, createdBy: "user-123" } },
      isLoading: false,
      error: null,
    });

    render(<ProtocolOverviewPage params={Promise.resolve({ id: "proto-1" })} />);

    // Enter edit mode
    fireEvent.click(screen.getByRole("button", { name: /common\.edit/i }));
    expect(screen.getByTestId("protocol-code-editor")).toBeInTheDocument();

    // Click close button (the X icon button in editor header actions)
    const closeButton = screen.getByTestId("x-icon").closest("button");
    if (!closeButton) throw new Error("Expected close button to exist");
    fireEvent.click(closeButton);

    // Should return to viewer without calling mutate
    expect(screen.getByTestId("json-viewer")).toBeInTheDocument();
    expect(screen.queryByTestId("protocol-code-editor")).not.toBeInTheDocument();
    expect(mockMutate).not.toHaveBeenCalled();
  });

  it("should save on close when changes were made", () => {
    mockUseProtocol.mockReturnValue({
      data: { body: { ...mockProtocol, createdBy: "user-123" } },
      isLoading: false,
      error: null,
    });

    render(<ProtocolOverviewPage params={Promise.resolve({ id: "proto-1" })} />);

    // Enter edit mode
    fireEvent.click(screen.getByRole("button", { name: /common\.edit/i }));

    // Trigger onChange with modified data
    fireEvent.click(screen.getByTestId("editor-change-btn"));

    // Click close button
    const closeButton = screen.getByTestId("x-icon").closest("button");
    if (!closeButton) throw new Error("Expected close button to exist");
    fireEvent.click(closeButton);

    // Should have called mutate to save the changes
    expect(mockMutate).toHaveBeenCalledWith({
      params: { id: "proto-1" },
      body: { code: [{ averages: 2 }] },
    });
    expect(screen.getByTestId("json-viewer")).toBeInTheDocument();
  });

  it("should show unsynced status after code change and trigger debounced save", () => {
    mockUseProtocol.mockReturnValue({
      data: { body: { ...mockProtocol, createdBy: "user-123" } },
      isLoading: false,
      error: null,
    });

    render(<ProtocolOverviewPage params={Promise.resolve({ id: "proto-1" })} />);

    // Enter edit mode
    fireEvent.click(screen.getByRole("button", { name: /common\.edit/i }));

    // Initially synced — check icon should be visible
    expect(screen.getByTestId("check-icon")).toBeInTheDocument();

    // Trigger onChange with modified data
    fireEvent.click(screen.getByTestId("editor-change-btn"));

    // Should show unsynced (circle icon)
    expect(screen.getByTestId("circle-icon")).toBeInTheDocument();

    // Advance timers by 1000ms to trigger the debounced save
    act(() => {
      vi.advanceTimersByTime(1000);
    });

    // mockMutate should have been called
    expect(mockMutate).toHaveBeenCalledWith(
      { params: { id: "proto-1" }, body: { code: [{ averages: 2 }] } },
      expect.objectContaining({
        onSuccess: expect.any(Function) as unknown,
        onError: expect.any(Function) as unknown,
      }),
    );
  });

  it("should show syncing status after debounce triggers and synced after success", () => {
    mockUseProtocol.mockReturnValue({
      data: { body: { ...mockProtocol, createdBy: "user-123" } },
      isLoading: false,
      error: null,
    });

    render(<ProtocolOverviewPage params={Promise.resolve({ id: "proto-1" })} />);

    // Enter edit mode
    fireEvent.click(screen.getByRole("button", { name: /common\.edit/i }));

    // Trigger onChange with modified data
    fireEvent.click(screen.getByTestId("editor-change-btn"));

    // Advance timers to trigger debounced save
    act(() => {
      vi.advanceTimersByTime(1000);
    });

    // Should show syncing (loader icon)
    expect(screen.getByTestId("loader2-icon")).toBeInTheDocument();

    // Simulate save success by calling the onSuccess callback
    const mutateCall = mockMutate.mock.calls[0] as [
      unknown,
      { onSuccess: () => void; onError: (err: unknown) => void },
    ];
    act(() => {
      mutateCall[1].onSuccess();
    });

    // Should show synced (check icon)
    expect(screen.getByTestId("check-icon")).toBeInTheDocument();
  });

  it("should show destructive toast and unsynced status on auto-save error", () => {
    mockUseProtocol.mockReturnValue({
      data: { body: { ...mockProtocol, createdBy: "user-123" } },
      isLoading: false,
      error: null,
    });

    render(<ProtocolOverviewPage params={Promise.resolve({ id: "proto-1" })} />);

    // Enter edit mode
    fireEvent.click(screen.getByRole("button", { name: /common\.edit/i }));

    // Trigger onChange
    fireEvent.click(screen.getByTestId("editor-change-btn"));

    // Advance timers to trigger debounced save
    act(() => {
      vi.advanceTimersByTime(1000);
    });

    // Simulate save error
    const mutateCall = mockMutate.mock.calls[0] as [
      unknown,
      { onSuccess: () => void; onError: (err: unknown) => void },
    ];
    act(() => {
      mutateCall[1].onError("auto-save failed");
    });

    // Should show destructive toast
    expect(toast).toHaveBeenCalledWith({
      description: "auto-save failed",
      variant: "destructive",
    });

    // Should revert to unsynced status
    expect(screen.getByTestId("circle-icon")).toBeInTheDocument();
  });

  it("should stay synced when code change matches saved code", () => {
    mockUseProtocol.mockReturnValue({
      data: { body: { ...mockProtocol, createdBy: "user-123" } },
      isLoading: false,
      error: null,
    });

    render(<ProtocolOverviewPage params={Promise.resolve({ id: "proto-1" })} />);

    // Enter edit mode — savedCodeRef is set to JSON.stringify(protocol.code) = '[{"averages":1}]'
    fireEvent.click(screen.getByRole("button", { name: /common\.edit/i }));

    // Trigger onChange with same data as saved
    fireEvent.click(screen.getByTestId("editor-change-same-btn"));

    // Should remain synced (check icon)
    expect(screen.getByTestId("check-icon")).toBeInTheDocument();
    expect(screen.queryByTestId("circle-icon")).not.toBeInTheDocument();
  });

  it("should not trigger save when onChange receives a non-array value", () => {
    mockUseProtocol.mockReturnValue({
      data: { body: { ...mockProtocol, createdBy: "user-123" } },
      isLoading: false,
      error: null,
    });

    render(<ProtocolOverviewPage params={Promise.resolve({ id: "proto-1" })} />);

    // Enter edit mode
    fireEvent.click(screen.getByRole("button", { name: /common\.edit/i }));

    // Trigger onChange with a string value
    fireEvent.click(screen.getByTestId("editor-change-string-btn"));

    // Advance timers — should not trigger any save
    act(() => {
      vi.advanceTimersByTime(2000);
    });

    // mutate should not have been called
    expect(mockMutate).not.toHaveBeenCalled();

    // Should still show synced (check icon) since the non-array early-returns
    expect(screen.getByTestId("check-icon")).toBeInTheDocument();
  });

  it("should render sync status tooltip content in edit mode", () => {
    mockUseProtocol.mockReturnValue({
      data: { body: { ...mockProtocol, createdBy: "user-123" } },
      isLoading: false,
      error: null,
    });

    render(<ProtocolOverviewPage params={Promise.resolve({ id: "proto-1" })} />);

    // Enter edit mode
    fireEvent.click(screen.getByRole("button", { name: /common\.edit/i }));

    // Synced state — tooltip should say "All changes saved"
    expect(screen.getByText("All changes saved")).toBeInTheDocument();

    // Trigger change to get unsynced
    fireEvent.click(screen.getByTestId("editor-change-btn"));
    expect(screen.getByText("Unsaved changes")).toBeInTheDocument();

    // Advance timers to get syncing
    act(() => {
      vi.advanceTimersByTime(1000);
    });
    expect(screen.getByText("Saving...")).toBeInTheDocument();
  });
});
