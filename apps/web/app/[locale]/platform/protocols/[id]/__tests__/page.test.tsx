import { render, screen, userEvent } from "@/test/test-utils";
import { use } from "react";
import type React from "react";
import { describe, it, expect, vi, beforeEach } from "vitest";

import { useSession } from "@repo/auth/client";
import { toast } from "@repo/ui/hooks";

import ProtocolOverviewPage from "../page";

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
    asChild,
  }: React.ButtonHTMLAttributes<HTMLButtonElement> & {
    variant?: string;
    size?: string;
    asChild?: boolean;
  }) =>
    asChild ? (
      <>{children}</>
    ) : (
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

    vi.mocked(use).mockReturnValue({ id: "proto-1" });
    vi.mocked(useSession).mockReturnValue({
      data: { user: { id: "user-123" } },
      isPending: false,
    } as ReturnType<typeof useSession>);

    mockUseProtocolUpdate.mockReturnValue({
      mutateAsync: mockMutateAsync,
      mutate: mockMutate,
      isPending: false,
    });
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

  it("should call toast with success message when description save succeeds", async () => {
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

    const user = userEvent.setup();
    await user.click(screen.getByTestId("description-save-btn"));

    expect(mockMutateAsync).toHaveBeenCalledWith(
      { params: { id: "proto-1" }, body: { description: "updated description" } },
      expect.objectContaining({
        onSuccess: expect.any(Function) as unknown,
        onError: expect.any(Function) as unknown,
      }),
    );
    expect(toast).toHaveBeenCalledWith({ description: "protocols.protocolUpdated" });
  });

  it("should call toast with destructive variant when description save fails", async () => {
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

    const user = userEvent.setup();
    await user.click(screen.getByTestId("description-save-btn"));

    expect(toast).toHaveBeenCalledWith({
      description: "save failed",
      variant: "destructive",
    });
  });

  it("should switch to ProtocolCodeEditor when creator clicks edit button", async () => {
    mockUseProtocol.mockReturnValue({
      data: { body: { ...mockProtocol, createdBy: "user-123" } },
      isLoading: false,
      error: null,
    });

    render(<ProtocolOverviewPage params={Promise.resolve({ id: "proto-1" })} />);

    expect(screen.getByTestId("json-viewer")).toBeInTheDocument();
    expect(screen.queryByTestId("protocol-code-editor")).not.toBeInTheDocument();

    const user = userEvent.setup();
    await user.click(screen.getByRole("button", { name: /common\.edit/i }));

    expect(screen.getByTestId("protocol-code-editor")).toBeInTheDocument();
    expect(screen.queryByTestId("json-viewer")).not.toBeInTheDocument();
  });
});
