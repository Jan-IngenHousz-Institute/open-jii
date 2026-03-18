/* eslint-disable @typescript-eslint/no-unsafe-return */
import "@testing-library/jest-dom";
import { render, screen, fireEvent } from "@testing-library/react";
import React from "react";
import { describe, it, expect, vi, beforeEach } from "vitest";

import MacroLayout from "../layout";

// Global React for JSX in mocks
globalThis.React = React;

// -------------------
// Mocks
// -------------------
const mockUseParams = vi.fn();
const mockNotFound = vi.fn();
const mockUseMacro = vi.fn();
const mockUseMacroUpdate = vi.fn();
const mockUseSession = vi.fn();
const mockMutateAsync = vi.fn();

vi.mock("next/navigation", () => ({
  useParams: () => mockUseParams(),
  notFound: () => mockNotFound(),
}));

vi.mock("@/hooks/macro/useMacro/useMacro", () => ({
  useMacro: () => mockUseMacro(),
}));

vi.mock("@/hooks/macro/useMacroUpdate/useMacroUpdate", () => ({
  useMacroUpdate: () => mockUseMacroUpdate(),
}));

vi.mock("@repo/auth/client", () => ({
  useSession: () => mockUseSession(),
}));

vi.mock("@repo/i18n", () => ({
  __esModule: true,
  useTranslation: (_ns?: string) => ({
    t: (key: string) => key,
  }),
}));

vi.mock("@/components/error-display", () => ({
  ErrorDisplay: ({ error }: { error: unknown }) => (
    <div data-testid="error-display">{String(error)}</div>
  ),
}));

vi.mock("@/components/shared/inline-editable-title", () => ({
  InlineEditableTitle: ({
    name,
    hasAccess,
    onSave,
    isPending,
    badges,
  }: {
    name: string;
    hasAccess?: boolean;
    onSave: (newName: string) => Promise<void>;
    isPending?: boolean;
    badges?: React.ReactNode;
  }) => (
    <div data-testid="inline-editable-title">
      <span data-testid="title-name">{name}</span>
      <span data-testid="title-has-access">{String(hasAccess)}</span>
      <span data-testid="title-is-pending">{String(isPending)}</span>
      <button data-testid="title-save-btn" onClick={() => void onSave("Updated Macro Name")}>
        Save
      </button>
      {badges && <div data-testid="title-badges">{badges}</div>}
    </div>
  ),
}));

vi.mock("@repo/ui/components", () => ({
  Badge: ({ children, className }: React.PropsWithChildren<{ className?: string }>) => (
    <span data-testid="badge" className={className}>
      {children}
    </span>
  ),
}));

vi.mock("@repo/ui/hooks", () => ({
  toast: vi.fn(),
}));

vi.mock("~/util/apiError", () => ({
  parseApiError: (err: unknown) => ({ message: String(err) }),
}));

// -------------------
// Default mock data
// -------------------
const defaultMacro = {
  id: "test-macro-id",
  name: "Test Macro",
  language: "python",
  createdBy: "user-123",
  sortOrder: null,
};

const defaultSession = {
  data: { user: { id: "user-123" } },
};

// -------------------
// Helpers
// -------------------
function renderLayout({
  macroId = "test-macro-id",
  macroData = defaultMacro,
  isLoading = false,
  error = null,
  session = defaultSession,
  isUpdating = false,
  children = <div>Child Content</div>,
}: {
  macroId?: string;
  macroData?: typeof defaultMacro | null;
  isLoading?: boolean;
  error?: { status?: number; message?: string } | Error | null;
  session?: { data: { user: { id: string } } } | { data: null };
  isUpdating?: boolean;
  children?: React.ReactNode;
} = {}) {
  mockUseParams.mockReturnValue({ id: macroId });
  mockUseMacro.mockReturnValue({ isLoading, error, data: macroData });
  mockUseMacroUpdate.mockReturnValue({ mutateAsync: mockMutateAsync, isPending: isUpdating });
  mockUseSession.mockReturnValue(session);

  return render(<MacroLayout>{children}</MacroLayout>);
}

// -------------------
// Tests
// -------------------
describe("<MacroLayout />", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockMutateAsync.mockResolvedValue(undefined);
  });

  describe("Loading State", () => {
    it("renders loading indicator when isLoading is true", () => {
      renderLayout({ isLoading: true, macroData: null });

      expect(screen.getByText("common.loading")).toBeInTheDocument();
    });

    it("does not render children when loading", () => {
      renderLayout({ isLoading: true, macroData: null });

      expect(screen.queryByText("Child Content")).not.toBeInTheDocument();
    });

    it("does not render the inline editable title when loading", () => {
      renderLayout({ isLoading: true, macroData: null });

      expect(screen.queryByTestId("inline-editable-title")).not.toBeInTheDocument();
    });
  });

  describe("Error Handling", () => {
    it("calls notFound for 404 errors", () => {
      renderLayout({
        macroData: null,
        error: { status: 404, message: "Not Found" },
      });

      expect(mockNotFound).toHaveBeenCalled();
    });

    it("calls notFound for 400 errors (invalid UUID)", () => {
      renderLayout({
        macroData: null,
        error: { status: 400, message: "Bad Request" },
      });

      expect(mockNotFound).toHaveBeenCalled();
    });

    it("renders error display for 500 server errors", () => {
      renderLayout({
        macroData: null,
        error: { status: 500, message: "Internal Server Error" },
      });

      expect(screen.getByText("errors.error")).toBeInTheDocument();
      expect(screen.getByText("errors.resourceNotFoundMessage")).toBeInTheDocument();
      expect(screen.getByTestId("error-display")).toBeInTheDocument();
      expect(mockNotFound).not.toHaveBeenCalled();
    });

    it("renders error display for 403 forbidden errors", () => {
      renderLayout({
        macroData: null,
        error: { status: 403, message: "Forbidden" },
      });

      expect(screen.getByText("errors.error")).toBeInTheDocument();
      expect(screen.getByTestId("error-display")).toBeInTheDocument();
      expect(mockNotFound).not.toHaveBeenCalled();
    });

    it("does not render children when an error is present", () => {
      renderLayout({
        macroData: null,
        error: { status: 500, message: "Internal Server Error" },
      });

      expect(screen.queryByText("Child Content")).not.toBeInTheDocument();
    });
  });

  describe("Null Data State", () => {
    it("renders null when macroData is falsy and no loading or error", () => {
      const { container } = renderLayout({ macroData: null });

      expect(container.firstChild).toBeNull();
    });
  });

  describe("Success State - Layout Structure", () => {
    it("renders children when macro data is available", () => {
      renderLayout();

      expect(screen.getByText("Child Content")).toBeInTheDocument();
    });

    it("renders with space-y-6 container class", () => {
      const { container } = renderLayout();

      expect(container.firstChild).toHaveClass("space-y-6");
    });

    it("renders the InlineEditableTitle component", () => {
      renderLayout();

      expect(screen.getByTestId("inline-editable-title")).toBeInTheDocument();
    });
  });

  describe("InlineEditableTitle Props", () => {
    it("passes the macro name to InlineEditableTitle", () => {
      renderLayout({ macroData: { ...defaultMacro, name: "My Test Macro" } });

      expect(screen.getByTestId("title-name")).toHaveTextContent("My Test Macro");
    });

    it("passes hasAccess=true when the session user is the creator", () => {
      renderLayout({
        macroData: { ...defaultMacro, createdBy: "user-123" },
        session: { data: { user: { id: "user-123" } } },
      });

      expect(screen.getByTestId("title-has-access")).toHaveTextContent("true");
    });

    it("passes hasAccess=false when the session user is not the creator", () => {
      renderLayout({
        macroData: { ...defaultMacro, createdBy: "other-user" },
        session: { data: { user: { id: "user-123" } } },
      });

      expect(screen.getByTestId("title-has-access")).toHaveTextContent("false");
    });

    it("passes hasAccess=false when there is no session", () => {
      renderLayout({
        session: { data: null },
      });

      expect(screen.getByTestId("title-has-access")).toHaveTextContent("false");
    });

    it("passes isPending from useMacroUpdate", () => {
      renderLayout({ isUpdating: true });

      expect(screen.getByTestId("title-is-pending")).toHaveTextContent("true");
    });

    it("passes isPending=false when not updating", () => {
      renderLayout({ isUpdating: false });

      expect(screen.getByTestId("title-is-pending")).toHaveTextContent("false");
    });
  });

  describe("Preferred Badge", () => {
    it("renders preferred badge when sortOrder is not null", () => {
      renderLayout({ macroData: { ...defaultMacro, sortOrder: 1 } });

      const badges = screen.getByTestId("title-badges");
      expect(badges).toHaveTextContent("common.preferred");
    });

    it("does not render preferred badge when sortOrder is null", () => {
      renderLayout({ macroData: { ...defaultMacro, sortOrder: null } });

      expect(screen.queryByTestId("title-badges")).not.toBeInTheDocument();
    });

    it("renders preferred badge with correct classes when sortOrder is 0", () => {
      renderLayout({ macroData: { ...defaultMacro, sortOrder: 0 } });

      const allBadges = screen.getAllByTestId("badge");
      const preferredBadge = allBadges.find((b) => b.textContent === "common.preferred");
      expect(preferredBadge).toHaveClass("bg-secondary/30", "text-primary");
    });
  });

  describe("Title Save Handler", () => {
    it("calls useMacroUpdate mutateAsync when title is saved", () => {
      renderLayout();

      fireEvent.click(screen.getByTestId("title-save-btn"));

      expect(mockMutateAsync).toHaveBeenCalledWith(
        {
          params: { id: "test-macro-id" },
          body: { name: "Updated Macro Name" },
        },
        expect.objectContaining({
          onSuccess: expect.any(Function) as () => void,
          onError: expect.any(Function) as () => void,
        }),
      );
    });

    it("uses the macro id from useParams when calling update", () => {
      renderLayout({ macroId: "custom-macro-id" });

      fireEvent.click(screen.getByTestId("title-save-btn"));

      expect(mockMutateAsync).toHaveBeenCalledWith(
        expect.objectContaining({
          params: { id: "custom-macro-id" },
        }),
        expect.any(Object),
      );
    });
  });

  describe("Component Structure", () => {
    it("renders InlineEditableTitle before children", () => {
      renderLayout({ children: <div data-testid="child-node">Child</div> });

      const container = screen.getByTestId("inline-editable-title").closest(".space-y-6");
      expect(container).not.toBeNull();

      const title = screen.getByTestId("inline-editable-title");
      const child = screen.getByTestId("child-node");

      // title should appear before child in the DOM
      expect(title.compareDocumentPosition(child) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    });
  });
});
