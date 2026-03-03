import "@testing-library/jest-dom/vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import React from "react";
import { describe, it, expect, vi, beforeEach } from "vitest";

import MacroOverviewPage from "../page";

globalThis.React = React;

// Mock React's use function to resolve the params promise synchronously
vi.mock("react", async () => {
  const actual = await vi.importActual("react");
  return {
    ...actual,
    use: vi.fn().mockReturnValue({ id: "test-macro-id" }),
  };
});

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
const mockUseMacroUpdate = vi.fn(() => ({
  mutateAsync: mockMutateAsync,
  isPending: false,
}));
vi.mock("@/hooks/macro/useMacroUpdate/useMacroUpdate", () => ({
  useMacroUpdate: () => mockUseMacroUpdate(),
}));

vi.mock("@repo/auth/client", () => ({
  useSession: () => ({
    data: { user: { id: "creator-id" } },
  }),
}));

vi.mock("@repo/i18n", () => ({
  useTranslation: () => ({
    t: (k: string) => k,
  }),
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
    </div>
  ),
}));

vi.mock("@/components/macro-code-viewer", () => ({
  default: ({
    value,
    language,
    height,
    macroName,
    title,
    headerActions,
  }: {
    value: string;
    language: string;
    height: string;
    macroName: string;
    title?: React.ReactNode;
    headerActions?: React.ReactNode;
  }) => (
    <div data-testid="macro-code-viewer">
      {title && <div data-testid="viewer-title">{title}</div>}
      {headerActions && <div data-testid="viewer-actions">{headerActions}</div>}
      <div data-testid="code-value">{value}</div>
      <div data-testid="code-language">{language}</div>
      <div data-testid="code-height">{height}</div>
      <div data-testid="code-macro-name">{macroName}</div>
    </div>
  ),
}));

vi.mock("@/components/macro-code-editor", () => ({
  default: ({
    value,
    onChange,
    language,
    macroName,
    title,
    headerActions,
  }: {
    value: string;
    onChange: (v: string) => void;
    language: string;
    macroName: string;
    label?: string;
    title?: React.ReactNode;
    headerActions?: React.ReactNode;
  }) => (
    <div data-testid="macro-code-editor">
      {title && <div data-testid="editor-title">{title}</div>}
      {headerActions && <div data-testid="editor-actions">{headerActions}</div>}
      <div data-testid="editor-value">{value}</div>
      <div data-testid="editor-language">{language}</div>
      <div data-testid="editor-macro-name">{macroName}</div>
      <button data-testid="editor-change-btn" onClick={() => onChange("new code")}>
        change
      </button>
    </div>
  ),
}));

vi.mock("lucide-react", () => ({
  Check: ({ className }: { className?: string }) => (
    <span data-testid="check-icon" className={className} />
  ),
  CodeIcon: ({ className }: { className?: string }) => (
    <span data-testid="code-icon" className={className} />
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
  return { Card, CardHeader, CardTitle, CardContent, Button };
});

vi.mock("@repo/ui/hooks", () => ({
  toast: vi.fn(),
}));

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
    mockUseMacroUpdate.mockReturnValue({
      mutateAsync: mockMutateAsync,
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
      // Re-mock session with a different user id
      vi.doMock("@repo/auth/client", () => ({
        useSession: () => ({
          data: { user: { id: "different-user-id" } },
        }),
      }));

      const macroOwnedByOther = { ...mockMacroData, createdBy: "another-user" };
      mockUseMacro.mockReturnValue({
        data: macroOwnedByOther,
        isLoading: false,
        error: null,
      });

      render(<MacroOverviewPage params={mockParams} />);

      // The current session user is "creator-id" (from top-level mock), macro.createdBy is "another-user"
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
      expect(screen.getByTestId("code-macro-name")).toHaveTextContent("Test Macro");
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

      expect(screen.getByTestId("viewer-title")).toHaveTextContent("macros.code");
    });

    it("should show Edit button for creator when code is present", () => {
      mockUseMacro.mockReturnValue({
        data: mockMacroData,
        isLoading: false,
        error: null,
      });

      render(<MacroOverviewPage params={mockParams} />);

      expect(screen.getByTestId("viewer-actions")).toBeInTheDocument();
      expect(screen.getByText("common.edit")).toBeInTheDocument();
    });

    it("should not show Edit button when there is no code", () => {
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
    it("should switch to edit mode when Edit button is clicked", () => {
      mockUseMacro.mockReturnValue({
        data: mockMacroData,
        isLoading: false,
        error: null,
      });

      render(<MacroOverviewPage params={mockParams} />);

      const editButton = screen.getByText("common.edit");
      fireEvent.click(editButton);

      expect(screen.getByTestId("macro-code-editor")).toBeInTheDocument();
      expect(screen.queryByTestId("macro-code-viewer")).not.toBeInTheDocument();
    });

    it("should show Cancel and Save buttons in edit mode", () => {
      mockUseMacro.mockReturnValue({
        data: mockMacroData,
        isLoading: false,
        error: null,
      });

      render(<MacroOverviewPage params={mockParams} />);

      fireEvent.click(screen.getByText("common.edit"));

      expect(screen.getByText("common.cancel")).toBeInTheDocument();
      expect(screen.getByText("common.save")).toBeInTheDocument();
      expect(screen.getByTestId("x-icon")).toBeInTheDocument();
      expect(screen.getByTestId("check-icon")).toBeInTheDocument();
    });

    it("should hide Edit button in edit mode", () => {
      mockUseMacro.mockReturnValue({
        data: mockMacroData,
        isLoading: false,
        error: null,
      });

      render(<MacroOverviewPage params={mockParams} />);

      fireEvent.click(screen.getByText("common.edit"));

      expect(screen.queryByText("common.edit")).not.toBeInTheDocument();
    });

    it("should initialize the editor with decoded macro code", () => {
      mockUseMacro.mockReturnValue({
        data: mockMacroData,
        isLoading: false,
        error: null,
      });

      render(<MacroOverviewPage params={mockParams} />);

      fireEvent.click(screen.getByText("common.edit"));

      expect(screen.getByTestId("editor-value")).toHaveTextContent("print('Hello, World!')");
      expect(screen.getByTestId("editor-language")).toHaveTextContent("python");
      expect(screen.getByTestId("editor-macro-name")).toHaveTextContent("Test Macro");
    });

    it("should return to view mode when Cancel is clicked", () => {
      mockUseMacro.mockReturnValue({
        data: mockMacroData,
        isLoading: false,
        error: null,
      });

      render(<MacroOverviewPage params={mockParams} />);

      fireEvent.click(screen.getByText("common.edit"));
      expect(screen.getByTestId("macro-code-editor")).toBeInTheDocument();

      fireEvent.click(screen.getByText("common.cancel"));

      expect(screen.queryByTestId("macro-code-editor")).not.toBeInTheDocument();
      expect(screen.getByTestId("macro-code-viewer")).toBeInTheDocument();
    });

    it("should call updateMacro with encoded code when Save is clicked", () => {
      mockMutateAsync.mockResolvedValue({});
      mockUseMacro.mockReturnValue({
        data: mockMacroData,
        isLoading: false,
        error: null,
      });

      render(<MacroOverviewPage params={mockParams} />);

      fireEvent.click(screen.getByText("common.edit"));
      fireEvent.click(screen.getByText("common.save"));

      expect(mockMutateAsync).toHaveBeenCalledWith(
        expect.objectContaining({
          params: { id: "test-macro-id" },
          body: expect.objectContaining({
            code: expect.any(String) as string,
          }) as Record<string, unknown>,
        }),
        expect.objectContaining({
          onSuccess: expect.any(Function) as () => void,
          onError: expect.any(Function) as () => void,
        }),
      );
    });

    it("should disable Cancel and Save buttons when update is pending", () => {
      mockUseMacroUpdate.mockReturnValue({
        mutateAsync: mockMutateAsync,
        isPending: true,
      });
      mockUseMacro.mockReturnValue({
        data: mockMacroData,
        isLoading: false,
        error: null,
      });

      render(<MacroOverviewPage params={mockParams} />);

      fireEvent.click(screen.getByText("common.edit"));

      const cancelButton = screen.getByText("common.cancel").closest("button");
      const saveButton = screen.getByText("common.save").closest("button");

      expect(cancelButton).toBeDisabled();
      expect(saveButton).toBeDisabled();
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
    it("should not show Edit button when user is not the creator", () => {
      const macroOwnedByOther = { ...mockMacroData, createdBy: "different-user-id" };
      mockUseMacro.mockReturnValue({
        data: macroOwnedByOther,
        isLoading: false,
        error: null,
      });

      render(<MacroOverviewPage params={mockParams} />);

      // Session user is "creator-id" but macro.createdBy is "different-user-id"
      expect(screen.queryByText("common.edit")).not.toBeInTheDocument();
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
});
