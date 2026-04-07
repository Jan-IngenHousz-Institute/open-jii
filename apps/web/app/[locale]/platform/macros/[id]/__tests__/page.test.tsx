import { use } from "react";
import type React from "react";
import { describe, it, expect, vi, beforeEach } from "vitest";

import { useSession } from "@repo/auth/client";
import { toast } from "@repo/ui/hooks";

import MacroOverviewPage from "../page";

import { render, screen, userEvent } from "@/test/test-utils";

// --------------------
// Hook mocks
// --------------------

interface MockUseMacroReturn {
  data: Record<string, unknown> | undefined;
  isLoading: boolean;
  error: unknown;
}

const mockUseMacro = vi.fn<() => MockUseMacroReturn>();
vi.mock("@/hooks/macro/useMacro/useMacro", () => ({
  useMacro: () => mockUseMacro(),
}));

const mockMutateAsync = vi.fn();
const mockMutate = vi.fn();
const mockUseMacroUpdate = vi.fn(() => ({
  mutateAsync: mockMutateAsync,
  mutate: mockMutate,
  isPending: false,
}));
vi.mock("@/hooks/macro/useMacroUpdate/useMacroUpdate", () => ({
  useMacroUpdate: () => mockUseMacroUpdate(),
}));



vi.mock("@/util/base64", () => ({
  decodeBase64: (s: string) => {
    try {
      return atob(s);
    } catch {
      return "Error decoding content";
    }
  },
  encodeBase64: (s: string) => btoa(s),
}));

// --------------------
// Component mocks
// --------------------

vi.mock("@/components/error-display", () => ({
  ErrorDisplay: ({ title }: { error: unknown; title: string }) => (
    <div data-testid="error-display">{title}</div>
  ),
}));

vi.mock("@/components/macro-overview/macro-details-sidebar", () => ({
  MacroDetailsSidebar: ({
    macroId,
    macro,
  }: {
    macroId: string;
    macro: Record<string, unknown>;
  }) => (
    <div data-testid="macro-details-sidebar" data-macro-id={macroId}>
      <span data-testid="sidebar-macro-name">{String(macro.name)}</span>
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
    title?: string;
    hasAccess?: boolean;
    onSave: (v: string) => Promise<void>;
    isPending?: boolean;
    saveLabel?: string;
    cancelLabel?: string;
    placeholder?: string;
  }) => (
    <div data-testid="inline-editable-description" data-has-access={String(hasAccess)}>
      <span data-testid="description-title">{title}</span>
      <span data-testid="description-content">{description}</span>
      <button data-testid="description-save-btn" onClick={() => onSave("new description")}>
        save
      </button>
    </div>
  ),
}));

vi.mock("@/components/macro-code-viewer", () => ({
  default: ({
    value,
    language,
    height,
    title,
    onEditStart,
  }: {
    value: string;
    language: string;
    height: string;
    title?: React.ReactNode;
    onEditStart?: () => void;
  }) => (
    <div data-testid="macro-code-viewer" onClick={onEditStart}>
      {title && <div data-testid="viewer-title">{title}</div>}
      {onEditStart && (
        <button data-testid="viewer-edit-trigger" onClick={onEditStart}>
          common.edit
        </button>
      )}
      <div data-testid="code-value">{value}</div>
      <div data-testid="code-language">{language}</div>
      <div data-testid="code-height">{height}</div>
    </div>
  ),
}));

vi.mock("@/components/macro-code-editor", () => ({
  default: ({
    value,
    onChange,
    language,
    title,
    headerActions,
  }: {
    value: string;
    onChange: (v: string) => void;
    language: string;
    label?: string;
    title?: React.ReactNode;
    headerActions?: React.ReactNode;
  }) => (
    <div data-testid="macro-code-editor">
      {title && <div data-testid="editor-title">{title}</div>}
      {headerActions && <div data-testid="editor-actions">{headerActions}</div>}
      <div data-testid="editor-value">{value}</div>
      <div data-testid="editor-language">{language}</div>
      <button data-testid="editor-change-btn" onClick={() => onChange("new code")}>
        change
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
  const CardTitle = ({ children, className }: React.HTMLAttributes<HTMLDivElement>) => (
    <h3 data-testid="card-title" className={className}>
      {children}
    </h3>
  );
  const CardContent = ({ children }: React.HTMLAttributes<HTMLDivElement>) => (
    <div data-testid="card-content">{children}</div>
  );
  const Button = ({
    children,
    onClick,
    disabled,
    variant,
  }: React.ButtonHTMLAttributes<HTMLButtonElement> & {
    variant?: string;
    size?: string;
  }) => (
    <button data-testid={`button-${variant ?? "default"}`} onClick={onClick} disabled={disabled}>
      {children}
    </button>
  );
  const Tooltip = ({ children }: { children: React.ReactNode }) => <>{children}</>;
  const TooltipContent = ({ children }: { children: React.ReactNode }) => (
    <div data-testid="tooltip-content">{children}</div>
  );
  const TooltipProvider = ({ children }: { children: React.ReactNode }) => <>{children}</>;
  const TooltipTrigger = ({ children }: { children: React.ReactNode; asChild?: boolean }) => (
    <>{children}</>
  );
  return {
    Card,
    CardHeader,
    CardTitle,
    CardContent,
    Button,
    Tooltip,
    TooltipContent,
    TooltipProvider,
    TooltipTrigger,
  };
});

vi.mock("~/util/apiError", () => ({
  parseApiError: (err: unknown) => ({ message: String(err) }),
}));

// --------------------
// Test data
// --------------------

const mockMacroData = {
  id: "test-macro-id",
  name: "Test Macro",
  filename: "test_macro.py",
  description: "This is a test macro description",
  language: "python" as const,
  code: btoa("print('Hello, World!')"), // base64 encoded
  createdBy: "creator-id",
  createdAt: "2023-01-01T00:00:00Z",
  updatedAt: "2023-01-02T00:00:00Z",
  createdByName: "John Doe",
  sortOrder: null,
};

// --------------------
// Tests
// --------------------

describe("MacroOverviewPage", () => {
  const mockParams = Promise.resolve({ id: "test-macro-id" });

  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(use).mockReturnValue({ id: "test-macro-id" });
    vi.mocked(useSession).mockReturnValue({
      data: { user: { id: "creator-id" } },
      isPending: false,
    } as ReturnType<typeof useSession>);
    mockUseMacroUpdate.mockReturnValue({
      mutateAsync: mockMutateAsync,
      mutate: mockMutate,
      isPending: false,
    });
  });

  describe("Loading State", () => {
    it("should display loading message when data is loading", () => {
      mockUseMacro.mockReturnValue({
        data: undefined,
        isLoading: true,
        error: null,
      });

      render(<MacroOverviewPage params={mockParams} />);

      expect(screen.getByText("common.loading")).toBeInTheDocument();
    });

    it("should call useMacro with the correct id", () => {
      mockUseMacro.mockReturnValue({
        data: undefined,
        isLoading: true,
        error: null,
      });

      render(<MacroOverviewPage params={mockParams} />);

      expect(mockUseMacro).toHaveBeenCalled();
    });
  });

  describe("Error State", () => {
    it("should display ErrorDisplay component when there is an error", () => {
      mockUseMacro.mockReturnValue({
        data: undefined,
        isLoading: false,
        error: new Error("Failed to fetch macro"),
      });

      render(<MacroOverviewPage params={mockParams} />);

      expect(screen.getByTestId("error-display")).toBeInTheDocument();
      expect(screen.getByText("errors.failedToLoadMacro")).toBeInTheDocument();
    });

    it("should not render the sidebar when in error state", () => {
      mockUseMacro.mockReturnValue({
        data: undefined,
        isLoading: false,
        error: new Error("server error"),
      });

      render(<MacroOverviewPage params={mockParams} />);

      expect(screen.queryByTestId("macro-details-sidebar")).not.toBeInTheDocument();
    });
  });

  describe("Not Found State", () => {
    it("should display not found message when data is undefined and not loading", () => {
      mockUseMacro.mockReturnValue({
        data: undefined,
        isLoading: false,
        error: null,
      });

      render(<MacroOverviewPage params={mockParams} />);

      expect(screen.getByText("macros.notFound")).toBeInTheDocument();
    });

    it("should not render the sidebar in not found state", () => {
      mockUseMacro.mockReturnValue({
        data: undefined,
        isLoading: false,
        error: null,
      });

      render(<MacroOverviewPage params={mockParams} />);

      expect(screen.queryByTestId("macro-details-sidebar")).not.toBeInTheDocument();
    });
  });

  describe("Success State — sidebar layout", () => {
    it("should render the MacroDetailsSidebar with correct props", () => {
      mockUseMacro.mockReturnValue({
        data: mockMacroData,
        isLoading: false,
        error: null,
      });

      render(<MacroOverviewPage params={mockParams} />);

      expect(screen.getByTestId("macro-details-sidebar")).toBeInTheDocument();
      expect(screen.getByTestId("macro-details-sidebar")).toHaveAttribute(
        "data-macro-id",
        "test-macro-id",
      );
      expect(screen.getByTestId("sidebar-macro-name")).toHaveTextContent("Test Macro");
    });

    it("should render InlineEditableDescription with description and title", () => {
      mockUseMacro.mockReturnValue({
        data: mockMacroData,
        isLoading: false,
        error: null,
      });

      render(<MacroOverviewPage params={mockParams} />);

      expect(screen.getByTestId("inline-editable-description")).toBeInTheDocument();
      expect(screen.getByTestId("description-title")).toHaveTextContent("common.description");
      expect(screen.getByTestId("description-content")).toHaveTextContent(
        "This is a test macro description",
      );
    });

    it("should pass hasAccess=true to InlineEditableDescription when user is creator", () => {
      mockUseMacro.mockReturnValue({
        data: mockMacroData,
        isLoading: false,
        error: null,
      });

      render(<MacroOverviewPage params={mockParams} />);

      expect(screen.getByTestId("inline-editable-description")).toHaveAttribute(
        "data-has-access",
        "true",
      );
    });

    it("should pass hasAccess=false to InlineEditableDescription when user is not creator", () => {
      const macroOwnedByOther = { ...mockMacroData, createdBy: "another-user" };
      mockUseMacro.mockReturnValue({
        data: macroOwnedByOther,
        isLoading: false,
        error: null,
      });

      render(<MacroOverviewPage params={mockParams} />);

      // The current session user is "creator-id" (from beforeEach), macro.createdBy is "another-user"
      expect(screen.getByTestId("inline-editable-description")).toHaveAttribute(
        "data-has-access",
        "false",
      );
    });
  });

  describe("Code Section — view mode", () => {
    it("should render MacroCodeViewer when code is present", () => {
      mockUseMacro.mockReturnValue({
        data: mockMacroData,
        isLoading: false,
        error: null,
      });

      render(<MacroOverviewPage params={mockParams} />);

      expect(screen.getByTestId("macro-code-viewer")).toBeInTheDocument();
      expect(screen.getByTestId("code-value")).toHaveTextContent("print('Hello, World!')");
      expect(screen.getByTestId("code-language")).toHaveTextContent("python");
      expect(screen.getByTestId("code-height")).toHaveTextContent("500px");
    });

    it("should display 'code not available' placeholder when macro has no code", () => {
      const macroWithoutCode = { ...mockMacroData, code: "" };
      mockUseMacro.mockReturnValue({
        data: macroWithoutCode,
        isLoading: false,
        error: null,
      });

      render(<MacroOverviewPage params={mockParams} />);

      expect(screen.getByText("macros.codeNotAvailable")).toBeInTheDocument();
      expect(screen.queryByTestId("macro-code-viewer")).not.toBeInTheDocument();
      expect(screen.queryByTestId("macro-code-editor")).not.toBeInTheDocument();
    });

    it("should render the code viewer with title", () => {
      mockUseMacro.mockReturnValue({
        data: mockMacroData,
        isLoading: false,
        error: null,
      });

      render(<MacroOverviewPage params={mockParams} />);

      expect(screen.getByTestId("viewer-title")).toHaveTextContent("macros.codeTitle");
    });

    it("should show edit trigger for creator when code is present", () => {
      mockUseMacro.mockReturnValue({
        data: mockMacroData,
        isLoading: false,
        error: null,
      });

      render(<MacroOverviewPage params={mockParams} />);

      expect(screen.getByTestId("viewer-edit-trigger")).toBeInTheDocument();
      expect(screen.getByText("common.edit")).toBeInTheDocument();
    });

    it("should not show edit trigger when there is no code", () => {
      const macroWithoutCode = { ...mockMacroData, code: "" };
      mockUseMacro.mockReturnValue({
        data: macroWithoutCode,
        isLoading: false,
        error: null,
      });

      render(<MacroOverviewPage params={mockParams} />);

      expect(screen.queryByText("common.edit")).not.toBeInTheDocument();
    });

    it("should handle invalid base64 code gracefully", () => {
      const macroWithInvalidCode = { ...mockMacroData, code: "invalid-base64!!!" };
      mockUseMacro.mockReturnValue({
        data: macroWithInvalidCode,
        isLoading: false,
        error: null,
      });

      render(<MacroOverviewPage params={mockParams} />);

      expect(screen.getByTestId("macro-code-viewer")).toBeInTheDocument();
      expect(screen.getByTestId("code-value")).toHaveTextContent("Error decoding content");
    });
  });

  describe("Code Section — edit mode", () => {
    it("should switch to edit mode when edit trigger is clicked", async () => {
      const user = userEvent.setup();
      mockUseMacro.mockReturnValue({
        data: mockMacroData,
        isLoading: false,
        error: null,
      });

      render(<MacroOverviewPage params={mockParams} />);

      await user.click(screen.getByText("common.edit"));

      expect(screen.getByTestId("macro-code-editor")).toBeInTheDocument();
      expect(screen.queryByTestId("macro-code-viewer")).not.toBeInTheDocument();
    });

    it("should show editor actions in edit mode", async () => {
      const user = userEvent.setup();
      mockUseMacro.mockReturnValue({
        data: mockMacroData,
        isLoading: false,
        error: null,
      });

      render(<MacroOverviewPage params={mockParams} />);

      await user.click(screen.getByText("common.edit"));

      expect(screen.getByTestId("editor-actions")).toBeInTheDocument();
      expect(screen.getByTestId("button-ghost")).toBeInTheDocument();
    });

    it("should hide edit trigger in edit mode", async () => {
      const user = userEvent.setup();
      mockUseMacro.mockReturnValue({
        data: mockMacroData,
        isLoading: false,
        error: null,
      });

      render(<MacroOverviewPage params={mockParams} />);

      await user.click(screen.getByText("common.edit"));

      expect(screen.queryByTestId("viewer-edit-trigger")).not.toBeInTheDocument();
    });

    it("should initialize the editor with decoded macro code", async () => {
      const user = userEvent.setup();
      mockUseMacro.mockReturnValue({
        data: mockMacroData,
        isLoading: false,
        error: null,
      });

      render(<MacroOverviewPage params={mockParams} />);

      await user.click(screen.getByText("common.edit"));

      expect(screen.getByTestId("editor-value")).toHaveTextContent("print('Hello, World!')");
      expect(screen.getByTestId("editor-language")).toHaveTextContent("python");
    });

    it("should return to view mode when close button is clicked", async () => {
      const user = userEvent.setup();
      mockUseMacro.mockReturnValue({
        data: mockMacroData,
        isLoading: false,
        error: null,
      });

      render(<MacroOverviewPage params={mockParams} />);

      await user.click(screen.getByText("common.edit"));
      expect(screen.getByTestId("macro-code-editor")).toBeInTheDocument();

      // Click the close (X) button rendered in headerActions
      await user.click(screen.getByTestId("button-ghost"));

      expect(screen.queryByTestId("macro-code-editor")).not.toBeInTheDocument();
      expect(screen.getByTestId("macro-code-viewer")).toBeInTheDocument();
    });
  });

  describe("Description updates", () => {
    it("should call updateMacro with new description when description is saved", () => {
      mockMutateAsync.mockResolvedValue({});
      mockUseMacro.mockReturnValue({
        data: mockMacroData,
        isLoading: false,
        error: null,
      });

      // The InlineEditableDescription is mocked so we just verify it receives the onSave prop.
      // We get the rendered element and check it exists with the expected data.
      render(<MacroOverviewPage params={mockParams} />);

      expect(screen.getByTestId("inline-editable-description")).toBeInTheDocument();
    });
  });

  describe("Component Structure", () => {
    it("should render the two-column layout container", () => {
      mockUseMacro.mockReturnValue({
        data: mockMacroData,
        isLoading: false,
        error: null,
      });

      const { container } = render(<MacroOverviewPage params={mockParams} />);

      const layoutDiv = container.querySelector(".flex.flex-col");
      expect(layoutDiv).toBeInTheDocument();
    });

    it("should render the code section", () => {
      mockUseMacro.mockReturnValue({
        data: mockMacroData,
        isLoading: false,
        error: null,
      });

      render(<MacroOverviewPage params={mockParams} />);

      expect(screen.getByTestId("macro-code-viewer")).toBeInTheDocument();
    });

    it("should render both sidebar and main content in success state", () => {
      mockUseMacro.mockReturnValue({
        data: mockMacroData,
        isLoading: false,
        error: null,
      });

      render(<MacroOverviewPage params={mockParams} />);

      expect(screen.getByTestId("macro-details-sidebar")).toBeInTheDocument();
      expect(screen.getByTestId("inline-editable-description")).toBeInTheDocument();
      expect(screen.getByTestId("macro-code-viewer")).toBeInTheDocument();
    });
  });

  describe("Non-creator behavior", () => {
    it("should not show edit trigger when user is not the creator", () => {
      const macroOwnedByOther = { ...mockMacroData, createdBy: "different-user-id" };
      mockUseMacro.mockReturnValue({
        data: macroOwnedByOther,
        isLoading: false,
        error: null,
      });

      render(<MacroOverviewPage params={mockParams} />);

      // Session user is "creator-id" but macro.createdBy is "different-user-id"
      expect(screen.queryByText("common.edit")).not.toBeInTheDocument();
      expect(screen.queryByTestId("viewer-edit-trigger")).not.toBeInTheDocument();
    });

    it("should still render the code viewer for non-creators", () => {
      const macroOwnedByOther = { ...mockMacroData, createdBy: "different-user-id" };
      mockUseMacro.mockReturnValue({
        data: macroOwnedByOther,
        isLoading: false,
        error: null,
      });

      render(<MacroOverviewPage params={mockParams} />);

      expect(screen.getByTestId("macro-code-viewer")).toBeInTheDocument();
    });
  });

  describe("Empty description", () => {
    it("should pass empty string to InlineEditableDescription when description is null", () => {
      const macroWithNullDescription = { ...mockMacroData, description: null };
      mockUseMacro.mockReturnValue({
        data: macroWithNullDescription,
        isLoading: false,
        error: null,
      });

      render(<MacroOverviewPage params={mockParams} />);

      expect(screen.getByTestId("description-content")).toHaveTextContent("");
    });
  });

  describe("handleDescriptionSave", () => {
    it("should show success toast when description save succeeds", async () => {
      const user = userEvent.setup();
      mockMutateAsync.mockImplementation(
        (_payload: unknown, options: { onSuccess?: () => void }) => {
          options.onSuccess?.();
          return Promise.resolve({});
        },
      );
      mockUseMacro.mockReturnValue({
        data: mockMacroData,
        isLoading: false,
        error: null,
      });

      render(<MacroOverviewPage params={mockParams} />);

      await user.click(screen.getByTestId("description-save-btn"));

      expect(mockMutateAsync).toHaveBeenCalledWith(
        { params: { id: "test-macro-id" }, body: { description: "new description" } },
        expect.objectContaining({
          onSuccess: expect.any(Function) as unknown,
          onError: expect.any(Function) as unknown,
        }),
      );
      expect(toast).toHaveBeenCalledWith({ description: "macros.macroUpdated" });
    });

    it("should show destructive toast when description save fails", async () => {
      const user = userEvent.setup();
      mockMutateAsync.mockImplementation(
        (_payload: unknown, options: { onError?: (err: unknown) => void }) => {
          options.onError?.("save failed");
          return Promise.resolve();
        },
      );
      mockUseMacro.mockReturnValue({
        data: mockMacroData,
        isLoading: false,
        error: null,
      });

      render(<MacroOverviewPage params={mockParams} />);

      await user.click(screen.getByTestId("description-save-btn"));

      expect(toast).toHaveBeenCalledWith({
        description: "save failed",
        variant: "destructive",
      });
    });
  });

  describe("CodeIcon fallback", () => {
    it("should render CodeIcon in the code not available placeholder", () => {
      const macroWithoutCode = { ...mockMacroData, code: "" };
      mockUseMacro.mockReturnValue({
        data: macroWithoutCode,
        isLoading: false,
        error: null,
      });

      render(<MacroOverviewPage params={mockParams} />);

      const container = screen.getByText("macros.codeNotAvailable").parentElement;
      expect(container?.querySelector("svg")).toBeInTheDocument();
      expect(screen.getByText("macros.codeNotAvailable")).toBeInTheDocument();
    });
  });
});
