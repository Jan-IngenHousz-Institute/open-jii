import { createMacro } from "@/test/factories";
import { server } from "@/test/msw/server";
import { render, screen, userEvent, waitFor, within } from "@/test/test-utils";
import { use } from "react";
import type React from "react";
import { describe, it, expect, vi, beforeEach } from "vitest";

import { contract } from "@repo/api";
import { useSession } from "@repo/auth/client";
import { toast } from "@repo/ui/hooks";

import { contract } from "@repo/api";

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
      <button
        data-testid="description-save-btn"
        onClick={() =>
          onSave("new description").catch(() => {
            /* noop */
          })
        }
      >
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

vi.mock("~/util/apiError", () => ({
  parseApiError: (err: unknown) => ({ message: String(err) }),
}));

const mockMacroData = createMacro({
  id: "test-macro-id",
  name: "Test Macro",
  filename: "test_macro.py",
  description: "This is a test macro description",
  language: "python",
  code: btoa("print('Hello, World!')"),
  createdBy: "creator-id",
  createdAt: "2023-01-01T00:00:00Z",
  updatedAt: "2023-01-02T00:00:00Z",
  createdByName: "John Doe",
  sortOrder: null,
});

describe("MacroOverviewPage", () => {
  const mockParams = Promise.resolve({ id: "test-macro-id" });

  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(use).mockReturnValue({ id: "test-macro-id" });
    vi.mocked(useSession).mockReturnValue({
      data: { user: { id: "creator-id" } },
      isPending: false,
    } as ReturnType<typeof useSession>);
    server.mount(contract.macros.getMacro, { body: mockMacroData });
    server.mount(contract.macros.updateMacro, { body: mockMacroData });
  });

  describe("Loading State", () => {
    it("should display loading message when data is loading", () => {
      server.mount(contract.macros.getMacro, { body: mockMacroData, delay: 999_999 });

      render(<MacroOverviewPage params={mockParams} />);

      expect(screen.getByText("common.loading")).toBeInTheDocument();
    });
  });

  describe("Error State", () => {
    it("should display ErrorDisplay component when there is an error", async () => {
      server.mount(contract.macros.getMacro, { status: 500 });

      render(<MacroOverviewPage params={mockParams} />);

      await waitFor(() => {
        expect(screen.getByTestId("error-display")).toBeInTheDocument();
      });
      expect(screen.getByText("errors.failedToLoadMacro")).toBeInTheDocument();
    });

    it("should not render the sidebar when in error state", async () => {
      server.mount(contract.macros.getMacro, { status: 500 });

      render(<MacroOverviewPage params={mockParams} />);

      await waitFor(() => {
        expect(screen.getByTestId("error-display")).toBeInTheDocument();
      });
      expect(screen.queryByTestId("macro-details-sidebar")).not.toBeInTheDocument();
    });
  });

  describe("Success State — sidebar layout", () => {
    it("should render the MacroDetailsSidebar with correct props", async () => {
      render(<MacroOverviewPage params={mockParams} />);

      await waitFor(() => {
        expect(screen.getByTestId("macro-details-sidebar")).toBeInTheDocument();
      });
      expect(screen.getByTestId("macro-details-sidebar")).toHaveAttribute(
        "data-macro-id",
        "test-macro-id",
      );
      expect(screen.getByTestId("sidebar-macro-name")).toHaveTextContent("Test Macro");
    });

    it("should render InlineEditableDescription with description and title", async () => {
      render(<MacroOverviewPage params={mockParams} />);

      await waitFor(() => {
        expect(screen.getByTestId("inline-editable-description")).toBeInTheDocument();
      });
      expect(screen.getByTestId("description-title")).toHaveTextContent("common.description");
      expect(screen.getByTestId("description-content")).toHaveTextContent(
        "This is a test macro description",
      );
    });

    it("should pass hasAccess=true to InlineEditableDescription when user is creator", async () => {
      render(<MacroOverviewPage params={mockParams} />);

      await waitFor(() => {
        expect(screen.getByTestId("inline-editable-description")).toHaveAttribute(
          "data-has-access",
          "true",
        );
      });
    });

    it("should pass hasAccess=false to InlineEditableDescription when user is not creator", async () => {
      const macroOwnedByOther = createMacro({ ...mockMacroData, createdBy: "another-user" });
      server.mount(contract.macros.getMacro, { body: macroOwnedByOther });

      render(<MacroOverviewPage params={mockParams} />);

      await waitFor(() => {
        expect(screen.getByTestId("inline-editable-description")).toHaveAttribute(
          "data-has-access",
          "false",
        );
      });
    });
  });

  describe("Code Section — view mode", () => {
    it("should render MacroCodeViewer when code is present", async () => {
      render(<MacroOverviewPage params={mockParams} />);

      await waitFor(() => {
        expect(screen.getByTestId("macro-code-viewer")).toBeInTheDocument();
      });
      expect(screen.getByTestId("code-value")).toHaveTextContent("print('Hello, World!')");
      expect(screen.getByTestId("code-language")).toHaveTextContent("python");
      expect(screen.getByTestId("code-height")).toHaveTextContent("500px");
    });

    it("should display 'code not available' placeholder when macro has no code", async () => {
      const macroWithoutCode = createMacro({ ...mockMacroData, code: "" });
      server.mount(contract.macros.getMacro, { body: macroWithoutCode });

      render(<MacroOverviewPage params={mockParams} />);

      await waitFor(() => {
        expect(screen.getByText("macros.codeNotAvailable")).toBeInTheDocument();
      });
      expect(screen.queryByTestId("macro-code-viewer")).not.toBeInTheDocument();
      expect(screen.queryByTestId("macro-code-editor")).not.toBeInTheDocument();
    });

    it("should render the code viewer with title", async () => {
      render(<MacroOverviewPage params={mockParams} />);

      await waitFor(() => {
        expect(screen.getByTestId("viewer-title")).toHaveTextContent("macros.codeTitle");
      });
    });

    it("should show edit trigger for creator when code is present", async () => {
      render(<MacroOverviewPage params={mockParams} />);

      await waitFor(() => {
        expect(screen.getByTestId("viewer-edit-trigger")).toBeInTheDocument();
      });
      expect(screen.getByText("common.edit")).toBeInTheDocument();
    });

    it("should not show edit trigger when there is no code", async () => {
      const macroWithoutCode = createMacro({ ...mockMacroData, code: "" });
      server.mount(contract.macros.getMacro, { body: macroWithoutCode });

      render(<MacroOverviewPage params={mockParams} />);

      await waitFor(() => {
        expect(screen.getByText("macros.codeNotAvailable")).toBeInTheDocument();
      });
      expect(screen.queryByText("common.edit")).not.toBeInTheDocument();
    });

    it("should handle invalid base64 code gracefully", async () => {
      const macroWithInvalidCode = createMacro({ ...mockMacroData, code: "invalid-base64!!!" });
      server.mount(contract.macros.getMacro, { body: macroWithInvalidCode });

      render(<MacroOverviewPage params={mockParams} />);

      await waitFor(() => {
        expect(screen.getByTestId("macro-code-viewer")).toBeInTheDocument();
      });
      expect(screen.getByTestId("code-value")).toHaveTextContent("Error decoding content");
    });
  });

  describe("Code Section — edit mode", () => {
    it("should switch to edit mode when edit trigger is clicked", async () => {
      const user = userEvent.setup();

      render(<MacroOverviewPage params={mockParams} />);

      await waitFor(() => {
        expect(screen.getByText("common.edit")).toBeInTheDocument();
      });
      await user.click(screen.getByText("common.edit"));

      expect(screen.getByTestId("macro-code-editor")).toBeInTheDocument();
      expect(screen.queryByTestId("macro-code-viewer")).not.toBeInTheDocument();
    });

    it("should show editor actions in edit mode", async () => {
      const user = userEvent.setup();

      render(<MacroOverviewPage params={mockParams} />);

      await waitFor(() => {
        expect(screen.getByText("common.edit")).toBeInTheDocument();
      });
      await user.click(screen.getByText("common.edit"));

      const editorActions = screen.getByTestId("editor-actions");
      expect(editorActions).toBeInTheDocument();
      expect(within(editorActions).getByRole("button")).toBeInTheDocument();
    });

    it("should hide edit trigger in edit mode", async () => {
      const user = userEvent.setup();

      render(<MacroOverviewPage params={mockParams} />);

      await waitFor(() => {
        expect(screen.getByText("common.edit")).toBeInTheDocument();
      });
      await user.click(screen.getByText("common.edit"));

      expect(screen.queryByTestId("viewer-edit-trigger")).not.toBeInTheDocument();
    });

    it("should initialize the editor with decoded macro code", async () => {
      const user = userEvent.setup();

      render(<MacroOverviewPage params={mockParams} />);

      await waitFor(() => {
        expect(screen.getByText("common.edit")).toBeInTheDocument();
      });
      await user.click(screen.getByText("common.edit"));

      expect(screen.getByTestId("editor-value")).toHaveTextContent("print('Hello, World!')");
      expect(screen.getByTestId("editor-language")).toHaveTextContent("python");
    });

    it("should return to view mode when close button is clicked", async () => {
      const user = userEvent.setup();

      render(<MacroOverviewPage params={mockParams} />);

      await waitFor(() => {
        expect(screen.getByText("common.edit")).toBeInTheDocument();
      });
      await user.click(screen.getByText("common.edit"));
      expect(screen.getByTestId("macro-code-editor")).toBeInTheDocument();

      // Click the close (X) button rendered in headerActions
      const editorActions = screen.getByTestId("editor-actions");
      await user.click(within(editorActions).getByRole("button"));

      expect(screen.queryByTestId("macro-code-editor")).not.toBeInTheDocument();
      expect(screen.getByTestId("macro-code-viewer")).toBeInTheDocument();
    });
  });

  describe("Description updates", () => {
    it("should call updateMacro with new description when description is saved", async () => {
      const updateSpy = server.mount(contract.macros.updateMacro, { body: mockMacroData });

      render(<MacroOverviewPage params={mockParams} />);

      await waitFor(() => {
        expect(screen.getByTestId("inline-editable-description")).toBeInTheDocument();
      });

      const user = userEvent.setup();
      await user.click(screen.getByTestId("description-save-btn"));

      await waitFor(() => {
        expect(updateSpy.body).toEqual({ description: "new description" });
      });
      expect(updateSpy.params.id).toBe("test-macro-id");
    });
  });

  describe("Component Structure", () => {
    it("should render the two-column layout container", async () => {
      render(<MacroOverviewPage params={mockParams} />);

      await waitFor(() => {
        expect(document.querySelector(".flex.flex-col")).toBeInTheDocument();
      });
    });

    it("should render the code section", async () => {
      render(<MacroOverviewPage params={mockParams} />);

      await waitFor(() => {
        expect(screen.getByTestId("macro-code-viewer")).toBeInTheDocument();
      });
    });

    it("should render both sidebar and main content in success state", async () => {
      render(<MacroOverviewPage params={mockParams} />);

      await waitFor(() => {
        expect(screen.getByTestId("macro-details-sidebar")).toBeInTheDocument();
      });
      expect(screen.getByTestId("inline-editable-description")).toBeInTheDocument();
      expect(screen.getByTestId("macro-code-viewer")).toBeInTheDocument();
    });
  });

  describe("Non-creator behavior", () => {
    it("should not show edit trigger when user is not the creator", async () => {
      const macroOwnedByOther = createMacro({ ...mockMacroData, createdBy: "different-user-id" });
      server.mount(contract.macros.getMacro, { body: macroOwnedByOther });

      render(<MacroOverviewPage params={mockParams} />);

      await waitFor(() => {
        expect(screen.getByTestId("macro-code-viewer")).toBeInTheDocument();
      });
      expect(screen.queryByText("common.edit")).not.toBeInTheDocument();
      expect(screen.queryByTestId("viewer-edit-trigger")).not.toBeInTheDocument();
    });

    it("should still render the code viewer for non-creators", async () => {
      const macroOwnedByOther = createMacro({ ...mockMacroData, createdBy: "different-user-id" });
      server.mount(contract.macros.getMacro, { body: macroOwnedByOther });

      render(<MacroOverviewPage params={mockParams} />);

      await waitFor(() => {
        expect(screen.getByTestId("macro-code-viewer")).toBeInTheDocument();
      });
    });
  });

  describe("Empty description", () => {
    it("should pass empty string to InlineEditableDescription when description is null", async () => {
      const macroWithNullDescription = createMacro({
        ...mockMacroData,
        description: null as unknown as string,
      });
      server.mount(contract.macros.getMacro, { body: macroWithNullDescription });

      render(<MacroOverviewPage params={mockParams} />);

      await waitFor(() => {
        expect(screen.getByTestId("description-content")).toHaveTextContent("");
      });
    });
  });

  describe("handleDescriptionSave", () => {
    it("should show success toast when description save succeeds", async () => {
      const user = userEvent.setup();
      server.mount(contract.macros.updateMacro, { body: mockMacroData });

      render(<MacroOverviewPage params={mockParams} />);

      await waitFor(() => {
        expect(screen.getByTestId("description-save-btn")).toBeInTheDocument();
      });

      await user.click(screen.getByTestId("description-save-btn"));

      await waitFor(() => {
        expect(toast).toHaveBeenCalledWith({ description: "macros.macroUpdated" });
      });
    });

    it("should show destructive toast when description save fails", async () => {
      const user = userEvent.setup();
      server.mount(contract.macros.updateMacro, { status: 400 });

      render(<MacroOverviewPage params={mockParams} />);

      await waitFor(() => {
        expect(screen.getByTestId("description-save-btn")).toBeInTheDocument();
      });

      await user.click(screen.getByTestId("description-save-btn"));

      await waitFor(() => {
        expect(toast).toHaveBeenCalledWith(expect.objectContaining({ variant: "destructive" }));
      });
    });
  });

  describe("CodeIcon fallback", () => {
    it("should render CodeIcon in the code not available placeholder", async () => {
      const macroWithoutCode = createMacro({ ...mockMacroData, code: "" });
      server.mount(contract.macros.getMacro, { body: macroWithoutCode });

      render(<MacroOverviewPage params={mockParams} />);

      await waitFor(() => {
        expect(screen.getByText("macros.codeNotAvailable")).toBeInTheDocument();
      });
      const container = screen.getByText("macros.codeNotAvailable").parentElement;
      expect(container?.querySelector("svg")).toBeInTheDocument();
    });
  });
});
