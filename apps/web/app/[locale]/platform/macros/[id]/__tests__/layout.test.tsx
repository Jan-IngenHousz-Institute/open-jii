import { createMacro } from "@/test/factories";
import { server } from "@/test/msw/server";
import { render, screen, userEvent, waitFor } from "@/test/test-utils";
import { useParams, notFound } from "next/navigation";
import type React from "react";
import { describe, it, expect, vi, beforeEach } from "vitest";

import { contract } from "@repo/api";
import { useSession } from "@repo/auth/client";

import MacroLayout from "../layout";

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

vi.mock("~/util/apiError", () => ({
  parseApiError: (err: unknown) => ({ message: String(err) }),
}));

const defaultMacro = createMacro({
  id: "test-macro-id",
  name: "Test Macro",
  language: "python",
  createdBy: "user-123",
  sortOrder: null,
});

const defaultSession = {
  data: { user: { id: "user-123" } },
};

function renderLayout({
  macroId = "test-macro-id",
  session = defaultSession,
  children = <div>Child Content</div>,
}: {
  macroId?: string;
  session?: { data: { user: { id: string } } } | { data: null };
  children?: React.ReactNode;
} = {}) {
  vi.mocked(useParams).mockReturnValue({ id: macroId } as ReturnType<typeof useParams>);
  vi.mocked(useSession).mockReturnValue(session as ReturnType<typeof useSession>);

  return render(<MacroLayout>{children}</MacroLayout>);
}

describe("<MacroLayout />", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("Loading State", () => {
    it("renders loading indicator when isLoading is true", () => {
      server.mount(contract.macros.getMacro, { body: createMacro(), delay: 999_999 });
      renderLayout();

      expect(screen.getByText("common.loading")).toBeInTheDocument();
    });

    it("does not render children when loading", () => {
      server.mount(contract.macros.getMacro, { body: createMacro(), delay: 999_999 });
      renderLayout();

      expect(screen.queryByText("Child Content")).not.toBeInTheDocument();
    });

    it("does not render the inline editable title when loading", () => {
      server.mount(contract.macros.getMacro, { body: createMacro(), delay: 999_999 });
      renderLayout();

      expect(screen.queryByTestId("inline-editable-title")).not.toBeInTheDocument();
    });
  });

  describe("Error Handling", () => {
    it("calls notFound for 404 errors", async () => {
      server.mount(contract.macros.getMacro, { status: 404 });
      renderLayout();

      await waitFor(() => {
        expect(vi.mocked(notFound)).toHaveBeenCalled();
      });
    });

    it("calls notFound for 400 errors (invalid UUID)", async () => {
      server.mount(contract.macros.getMacro, { status: 400 });
      renderLayout();

      await waitFor(() => {
        expect(vi.mocked(notFound)).toHaveBeenCalled();
      });
    });

    it("renders error display for 500 server errors", async () => {
      server.mount(contract.macros.getMacro, { status: 500 });
      renderLayout();

      await waitFor(
        () => {
          expect(screen.getByText("errors.error")).toBeInTheDocument();
        },
        { timeout: 5000 },
      );
      expect(screen.getByText("errors.resourceNotFoundMessage")).toBeInTheDocument();
      expect(screen.getByTestId("error-display")).toBeInTheDocument();
      expect(vi.mocked(notFound)).not.toHaveBeenCalled();
    });

    it("renders error display for 403 forbidden errors", async () => {
      server.mount(contract.macros.getMacro, { status: 403 });
      renderLayout();

      await waitFor(() => {
        expect(screen.getByText("errors.error")).toBeInTheDocument();
      });
      expect(screen.getByTestId("error-display")).toBeInTheDocument();
      expect(vi.mocked(notFound)).not.toHaveBeenCalled();
    });

    it("does not render children when an error is present", async () => {
      server.mount(contract.macros.getMacro, { status: 500 });
      renderLayout();

      await waitFor(
        () => {
          expect(screen.getByTestId("error-display")).toBeInTheDocument();
        },
        { timeout: 5000 },
      );
      expect(screen.queryByText("Child Content")).not.toBeInTheDocument();
    });
  });

  describe("Success State - Layout Structure", () => {
    it("renders children when macro data is available", async () => {
      server.mount(contract.macros.getMacro, { body: defaultMacro });
      renderLayout();

      await waitFor(() => {
        expect(screen.getByText("Child Content")).toBeInTheDocument();
      });
    });

    it("renders with space-y-6 container class", async () => {
      server.mount(contract.macros.getMacro, { body: defaultMacro });
      renderLayout();

      await waitFor(() => {
        expect(screen.getByText("Child Content")).toBeInTheDocument();
      });
      expect(document.querySelector(".space-y-6")).toBeInTheDocument();
    });

    it("renders the InlineEditableTitle component", async () => {
      server.mount(contract.macros.getMacro, { body: defaultMacro });
      renderLayout();

      await waitFor(() => {
        expect(screen.getByTestId("inline-editable-title")).toBeInTheDocument();
      });
    });
  });

  describe("InlineEditableTitle Props", () => {
    it("passes the macro name to InlineEditableTitle", async () => {
      server.mount(contract.macros.getMacro, {
        body: createMacro({ ...defaultMacro, name: "My Test Macro" }),
      });
      renderLayout();

      await waitFor(() => {
        expect(screen.getByTestId("title-name")).toHaveTextContent("My Test Macro");
      });
    });

    it("passes hasAccess=true when the session user is the creator", async () => {
      server.mount(contract.macros.getMacro, {
        body: createMacro({ ...defaultMacro, createdBy: "user-123" }),
      });
      renderLayout({
        session: { data: { user: { id: "user-123" } } },
      });

      await waitFor(() => {
        expect(screen.getByTestId("title-has-access")).toHaveTextContent("true");
      });
    });

    it("passes hasAccess=false when the session user is not the creator", async () => {
      server.mount(contract.macros.getMacro, {
        body: createMacro({ ...defaultMacro, createdBy: "other-user" }),
      });
      renderLayout({
        session: { data: { user: { id: "user-123" } } },
      });

      await waitFor(() => {
        expect(screen.getByTestId("title-has-access")).toHaveTextContent("false");
      });
    });

    it("passes hasAccess=false when there is no session", async () => {
      server.mount(contract.macros.getMacro, { body: defaultMacro });
      renderLayout({
        session: { data: null },
      });

      await waitFor(() => {
        expect(screen.getByTestId("title-has-access")).toHaveTextContent("false");
      });
    });

    it("passes isPending from useMacroUpdate", async () => {
      server.mount(contract.macros.getMacro, { body: defaultMacro });
      server.mount(contract.macros.updateMacro, { body: defaultMacro, delay: 999_999 });
      const user = userEvent.setup();
      renderLayout();

      await waitFor(() => {
        expect(screen.getByTestId("title-save-btn")).toBeInTheDocument();
      });

      await user.click(screen.getByTestId("title-save-btn"));

      await waitFor(() => {
        expect(screen.getByTestId("title-is-pending")).toHaveTextContent("true");
      });
    });

    it("passes isPending=false when not updating", async () => {
      server.mount(contract.macros.getMacro, { body: defaultMacro });
      renderLayout();

      await waitFor(() => {
        expect(screen.getByTestId("title-is-pending")).toHaveTextContent("false");
      });
    });
  });

  describe("Preferred Badge", () => {
    it("renders preferred badge when sortOrder is not null", async () => {
      server.mount(contract.macros.getMacro, {
        body: createMacro({ ...defaultMacro, sortOrder: 1 }),
      });
      renderLayout();

      await waitFor(() => {
        const badges = screen.getByTestId("title-badges");
        expect(badges).toHaveTextContent("common.preferred");
      });
    });

    it("does not render preferred badge when sortOrder is null", async () => {
      server.mount(contract.macros.getMacro, {
        body: createMacro({ ...defaultMacro, sortOrder: null }),
      });
      renderLayout();

      await waitFor(() => {
        expect(screen.getByTestId("inline-editable-title")).toBeInTheDocument();
      });
      expect(screen.queryByTestId("title-badges")).not.toBeInTheDocument();
    });

    it("renders preferred badge with correct classes when sortOrder is 0", async () => {
      server.mount(contract.macros.getMacro, {
        body: createMacro({ ...defaultMacro, sortOrder: 0 }),
      });
      renderLayout();

      await waitFor(() => {
        const preferredBadge = screen.getByText("common.preferred");
        expect(preferredBadge).toHaveClass("bg-secondary/30", "text-primary");
      });
    });
  });

  describe("Title Save Handler", () => {
    it("sends update request when title is saved", async () => {
      server.mount(contract.macros.getMacro, { body: defaultMacro });
      const updateSpy = server.mount(contract.macros.updateMacro, { body: defaultMacro });
      const user = userEvent.setup();
      renderLayout();

      await waitFor(() => {
        expect(screen.getByTestId("title-save-btn")).toBeInTheDocument();
      });

      await user.click(screen.getByTestId("title-save-btn"));

      await waitFor(() => {
        expect(updateSpy.called).toBe(true);
      });
      expect(updateSpy.body).toMatchObject({ name: "Updated Macro Name" });
      expect(updateSpy.params).toMatchObject({ id: "test-macro-id" });
    });

    it("uses the macro id from useParams when calling update", async () => {
      server.mount(contract.macros.getMacro, {
        body: createMacro({ ...defaultMacro, id: "custom-macro-id" }),
      });
      const updateSpy = server.mount(contract.macros.updateMacro, { body: defaultMacro });
      const user = userEvent.setup();
      renderLayout({ macroId: "custom-macro-id" });

      await waitFor(() => {
        expect(screen.getByTestId("title-save-btn")).toBeInTheDocument();
      });

      await user.click(screen.getByTestId("title-save-btn"));

      await waitFor(() => {
        expect(updateSpy.called).toBe(true);
      });
      expect(updateSpy.params).toMatchObject({ id: "custom-macro-id" });
    });
  });

  describe("Component Structure", () => {
    it("renders InlineEditableTitle before children", async () => {
      server.mount(contract.macros.getMacro, { body: defaultMacro });
      renderLayout({ children: <div data-testid="child-node">Child</div> });

      await waitFor(() => {
        expect(screen.getByTestId("inline-editable-title")).toBeInTheDocument();
      });

      const title = screen.getByTestId("inline-editable-title");
      const child = screen.getByTestId("child-node");

      // title should appear before child in the DOM
      expect(title.compareDocumentPosition(child) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    });
  });
});
