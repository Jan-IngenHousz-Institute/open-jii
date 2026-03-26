import "@testing-library/jest-dom";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import React from "react";
import { describe, it, expect, vi, beforeEach } from "vitest";

import { toast } from "@repo/ui/hooks";

import ProtocolLayout from "../layout";

// Global React for JSX in mocks
globalThis.React = React;

// -------------------
// Mocks
// -------------------

interface MockProtocolReturn {
  data:
    | {
        body: {
          id: string;
          name: string;
          family: string;
          sortOrder: number | null;
          createdBy: string;
        };
      }
    | undefined;
  isLoading: boolean;
  error: { status?: number; message?: string } | null;
}

const mockUseProtocol = vi.fn<() => MockProtocolReturn>();
vi.mock("@/hooks/protocol/useProtocol/useProtocol", () => ({
  useProtocol: () => mockUseProtocol(),
}));

const mockMutateAsync = vi.fn();

interface MockProtocolUpdateReturn {
  mutateAsync: typeof mockMutateAsync;
  isPending: boolean;
}

const mockUseProtocolUpdate = vi.fn<() => MockProtocolUpdateReturn>();
vi.mock("@/hooks/protocol/useProtocolUpdate/useProtocolUpdate", () => ({
  useProtocolUpdate: () => mockUseProtocolUpdate(),
}));

const mockNotFound = vi.fn();
vi.mock("next/navigation", () => ({
  useParams: () => ({ id: "test-id", locale: "en" }) as { id: string; locale: string },
  usePathname: () => "/en/platform/protocols/test-id",
  notFound: () => mockNotFound() as never,
}));

vi.mock("next/link", () => ({
  __esModule: true,
  default: ({ children, href }: { children: React.ReactNode; href: string }) => (
    <a href={href}>{children}</a>
  ),
}));

vi.mock("lucide-react", () => ({
  ArrowLeft: () => <span data-testid="arrow-left-icon" />,
  Play: () => <span data-testid="play-icon" />,
}));

vi.mock("@repo/auth/client", () => ({
  useSession: () => ({
    data: { user: { id: "user-123" } },
  }),
}));

vi.mock("@repo/i18n", () => ({
  __esModule: true,
  useTranslation: (namespace?: string) => ({
    t: (key: string) => (namespace ? `${namespace}.${key}` : key),
    i18n: { language: "en" },
  }),
}));

vi.mock("@/components/error-display", () => ({
  ErrorDisplay: ({ error }: { error: unknown }) => (
    <div data-testid="error-display">{String(error)}</div>
  ),
}));

vi.mock("~/util/apiError", () => ({
  parseApiError: (err: unknown) => ({ message: String(err) }),
}));

const mockBrowserSupport = {
  bluetooth: true,
  serial: true,
  any: true,
  bluetoothReason: null as string | null,
  serialReason: null as string | null,
};
vi.mock("~/hooks/iot/useIotBrowserSupport", () => ({
  useIotBrowserSupport: () => mockBrowserSupport,
}));

vi.mock("@repo/ui/hooks", () => ({
  toast: vi.fn(),
}));

vi.mock("@/components/shared/inline-editable-title", () => ({
  InlineEditableTitle: ({
    name,
    hasAccess,
    isPending,
    badges,
    actions,
    onSave,
  }: {
    name: string;
    hasAccess: boolean;
    onSave: (newName: string) => Promise<void>;
    isPending: boolean;
    badges?: React.ReactNode;
    actions?: React.ReactNode;
  }) => (
    <div data-testid="inline-editable-title">
      <span data-testid="title-name">{name}</span>
      <span data-testid="title-has-access">{String(hasAccess)}</span>
      <span data-testid="title-is-pending">{String(isPending)}</span>
      {badges && <div data-testid="title-badges">{badges}</div>}
      {actions && <div data-testid="title-actions">{actions}</div>}
      <button data-testid="save-title-btn" onClick={() => onSave("New Title")}>
        Save
      </button>
    </div>
  ),
}));

vi.mock("@repo/ui/components", () => ({
  Badge: ({
    children,
    variant,
    className,
  }: React.PropsWithChildren<{ variant?: string; className?: string }>) => (
    <span data-testid="badge" data-variant={variant} className={className}>
      {children}
    </span>
  ),
  Button: ({
    children,
    asChild,
    ...rest
  }: React.ComponentProps<"button"> & { asChild?: boolean; size?: string }) =>
    asChild ? <>{children}</> : <button {...rest}>{children}</button>,
  Tooltip: ({ children }: React.PropsWithChildren) => <>{children}</>,
  TooltipTrigger: ({ children }: React.PropsWithChildren<{ asChild?: boolean }>) => <>{children}</>,
  TooltipContent: ({ children }: React.PropsWithChildren) => (
    <div data-testid="tooltip-content">{children}</div>
  ),
}));

// -------------------
// Helpers
// -------------------

const defaultProtocol = {
  id: "test-id",
  name: "Test Protocol",
  family: "multispeq",
  sortOrder: null as number | null,
  createdBy: "other-user",
};

function renderLayout(children: React.ReactNode = <div>Children Content</div>) {
  return render(<ProtocolLayout>{children}</ProtocolLayout>);
}

// -------------------
// Tests
// -------------------

describe("ProtocolLayout", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockBrowserSupport.bluetooth = true;
    mockBrowserSupport.serial = true;
    mockBrowserSupport.any = true;
    mockBrowserSupport.bluetoothReason = null;
    mockBrowserSupport.serialReason = null;
    mockUseProtocolUpdate.mockReturnValue({
      mutateAsync: mockMutateAsync,
      isPending: false,
    });
  });

  describe("Loading State", () => {
    it("should display loading message when data is loading", () => {
      mockUseProtocol.mockReturnValue({
        data: undefined,
        isLoading: true,
        error: null,
      });

      renderLayout();

      expect(screen.getByText("protocols.loadingProtocols")).toBeInTheDocument();
    });

    it("should not render children when loading", () => {
      mockUseProtocol.mockReturnValue({
        data: undefined,
        isLoading: true,
        error: null,
      });

      renderLayout(<div>Children Content</div>);

      expect(screen.queryByText("Children Content")).not.toBeInTheDocument();
    });

    it("should not render the inline editable title when loading", () => {
      mockUseProtocol.mockReturnValue({
        data: undefined,
        isLoading: true,
        error: null,
      });

      renderLayout();

      expect(screen.queryByTestId("inline-editable-title")).not.toBeInTheDocument();
    });
  });

  describe("Error Handling", () => {
    it("should call notFound for 404 errors", () => {
      mockUseProtocol.mockReturnValue({
        data: undefined,
        isLoading: false,
        error: { status: 404, message: "Not found" },
      });

      renderLayout();

      expect(mockNotFound).toHaveBeenCalled();
    });

    it("should call notFound for 400 errors (invalid UUID)", () => {
      mockUseProtocol.mockReturnValue({
        data: undefined,
        isLoading: false,
        error: { status: 400, message: "Invalid UUID" },
      });

      renderLayout();

      expect(mockNotFound).toHaveBeenCalled();
    });

    it("should display error display for 500 errors", () => {
      mockUseProtocol.mockReturnValue({
        data: undefined,
        isLoading: false,
        error: { status: 500, message: "Server error" },
      });

      renderLayout();

      expect(screen.getByTestId("error-display")).toBeInTheDocument();
      expect(mockNotFound).not.toHaveBeenCalled();
    });

    it("should display error heading and description for non-404/400 errors", () => {
      mockUseProtocol.mockReturnValue({
        data: undefined,
        isLoading: false,
        error: { status: 500, message: "Server error" },
      });

      renderLayout();

      expect(screen.getByText("common.errors.error")).toBeInTheDocument();
      expect(screen.getByText("protocols.notFoundDescription")).toBeInTheDocument();
    });

    it("should not render children when there is an error", () => {
      mockUseProtocol.mockReturnValue({
        data: undefined,
        isLoading: false,
        error: { status: 500, message: "Server error" },
      });

      renderLayout(<div>Children Content</div>);

      expect(screen.queryByText("Children Content")).not.toBeInTheDocument();
    });
  });

  describe("No Data State", () => {
    it("should render null when protocolData body is missing", () => {
      mockUseProtocol.mockReturnValue({
        data: undefined,
        isLoading: false,
        error: null,
      });

      const { container } = renderLayout();

      expect(container.firstChild).toBeNull();
    });
  });

  describe("Success State", () => {
    it("should render InlineEditableTitle with protocol name", () => {
      mockUseProtocol.mockReturnValue({
        data: { body: { ...defaultProtocol, name: "My Protocol" } },
        isLoading: false,
        error: null,
      });

      renderLayout();

      expect(screen.getByTestId("inline-editable-title")).toBeInTheDocument();
      expect(screen.getByTestId("title-name")).toHaveTextContent("My Protocol");
    });

    it("should render children content", () => {
      mockUseProtocol.mockReturnValue({
        data: { body: defaultProtocol },
        isLoading: false,
        error: null,
      });

      renderLayout(<div>Children Content</div>);

      expect(screen.getByText("Children Content")).toBeInTheDocument();
    });

    it("should pass hasAccess=true when current user is the creator", () => {
      mockUseProtocol.mockReturnValue({
        data: { body: { ...defaultProtocol, createdBy: "user-123" } },
        isLoading: false,
        error: null,
      });

      renderLayout();

      expect(screen.getByTestId("title-has-access")).toHaveTextContent("true");
    });

    it("should pass hasAccess=false when current user is not the creator", () => {
      mockUseProtocol.mockReturnValue({
        data: { body: { ...defaultProtocol, createdBy: "different-user" } },
        isLoading: false,
        error: null,
      });

      renderLayout();

      expect(screen.getByTestId("title-has-access")).toHaveTextContent("false");
    });

    it("should pass isPending from useProtocolUpdate", () => {
      mockUseProtocolUpdate.mockReturnValue({
        mutateAsync: mockMutateAsync,
        isPending: true,
      });

      mockUseProtocol.mockReturnValue({
        data: { body: defaultProtocol },
        isLoading: false,
        error: null,
      });

      renderLayout();

      expect(screen.getByTestId("title-is-pending")).toHaveTextContent("true");
    });

    it("should render preferred badge when sortOrder is not null", () => {
      mockUseProtocol.mockReturnValue({
        data: { body: { ...defaultProtocol, sortOrder: 1 } },
        isLoading: false,
        error: null,
      });

      renderLayout();

      const badges = screen.getAllByTestId("badge");
      const preferredBadge = badges.find((b) => b.textContent === "common.common.preferred");
      expect(preferredBadge).toBeInTheDocument();
    });

    it("should not render preferred badge when sortOrder is null", () => {
      mockUseProtocol.mockReturnValue({
        data: { body: { ...defaultProtocol, sortOrder: null } },
        isLoading: false,
        error: null,
      });

      renderLayout();

      const badges = screen.queryAllByTestId("badge");
      const preferredBadge = badges.find((b) => b.textContent === "common.common.preferred");
      expect(preferredBadge).toBeUndefined();
    });

    it("should render the outer container with space-y-6 class", () => {
      mockUseProtocol.mockReturnValue({
        data: { body: defaultProtocol },
        isLoading: false,
        error: null,
      });

      const { container } = renderLayout();

      expect(container.firstChild).toHaveClass("space-y-6");
    });

    it("should call toast on successful title save", async () => {
      mockMutateAsync.mockImplementation((_data: unknown, options?: { onSuccess?: () => void }) => {
        options?.onSuccess?.();
        return Promise.resolve();
      });
      mockUseProtocol.mockReturnValue({
        data: { body: { ...defaultProtocol, createdBy: "user-123" } },
        isLoading: false,
        error: null,
      });
      renderLayout();

      const saveBtn = screen.getByTestId("save-title-btn");
      await userEvent.click(saveBtn);

      expect(toast).toHaveBeenCalledWith({ description: "protocols.protocolUpdated" });
    });

    it("should call toast with destructive variant on title save error", async () => {
      mockMutateAsync.mockImplementation(
        (_data: unknown, options?: { onError?: (err: unknown) => void }) => {
          options?.onError?.(new Error("Update failed"));
          return Promise.resolve();
        },
      );
      mockUseProtocol.mockReturnValue({
        data: { body: { ...defaultProtocol, createdBy: "user-123" } },
        isLoading: false,
        error: null,
      });
      renderLayout();

      const saveBtn = screen.getByTestId("save-title-btn");
      await userEvent.click(saveBtn);

      expect(toast).toHaveBeenCalledWith({
        description: expect.any(String) as unknown,
        variant: "destructive",
      });
    });
  });
});
