import { createMacro } from "@/test/factories";
import { server } from "@/test/msw/server";
import { render, screen, userEvent, waitFor } from "@/test/test-utils";
import { useRouter } from "next/navigation";
import type React from "react";
import { describe, it, expect, vi, beforeEach } from "vitest";

import type { Macro } from "@repo/api";
import { contract } from "@repo/api";
import { useSession } from "@repo/auth/client";

import { MacroDetailsSidebar } from "../macro-details-sidebar";

// --------------------
// Mocks
// --------------------

vi.mock("@/util/date", () => ({
  formatDate: (d: string) => `formatted:${d}`,
}));

vi.mock("~/util/apiError", () => ({
  parseApiError: (err: unknown) => ({ message: `parsed:${String(err)}` }),
}));

vi.mock("@repo/analytics", () => ({
  FEATURE_FLAGS: {
    MACRO_DELETION: "macro-deletion",
  },
}));

// Mock MacroCompatibleProtocolsCard
vi.mock("../../macro-settings/macro-compatible-protocols-card", () => ({
  MacroCompatibleProtocolsCard: ({
    macroId,
    embedded,
  }: {
    macroId: string;
    embedded?: boolean;
  }) => (
    <div
      data-testid="macro-compatible-protocols-card"
      data-macro-id={macroId}
      data-embedded={String(embedded)}
    >
      MacroCompatibleProtocolsCard
    </div>
  ),
}));

// Mock DetailsSidebarCard - render children directly with the title
vi.mock("../../shared/details-sidebar-card", () => ({
  DetailsSidebarCard: ({
    title,
    collapsedSummary,
    children,
  }: {
    title: string;
    collapsedSummary?: string;
    children: React.ReactNode;
  }) => (
    <div
      data-testid="details-sidebar-card"
      data-title={title}
      data-collapsed-summary={collapsedSummary}
    >
      <h3>{title}</h3>
      {children}
    </div>
  ),
}));

// Mock UI components (pragmatic: keep Dialog + Select which use Radix portals)
vi.mock("@repo/ui/components", async (importOriginal) => {
  const actual = await importOriginal<Record<string, unknown>>();

  const Dialog = ({
    children,
    open,
  }: {
    children: React.ReactNode;
    open?: boolean;
    onOpenChange?: (open: boolean) => void;
  }) => (
    <div data-testid="dialog" data-open={String(open)}>
      {children}
    </div>
  );

  const DialogTrigger = ({ children }: { children: React.ReactNode; asChild?: boolean }) => (
    <div data-testid="dialog-trigger">{children}</div>
  );

  const DialogContent = ({ children }: { children: React.ReactNode }) => (
    <div data-testid="dialog-content">{children}</div>
  );

  const DialogHeader = ({
    children,
    className,
  }: {
    children: React.ReactNode;
    className?: string;
  }) => (
    <div data-testid="dialog-header" className={className}>
      {children}
    </div>
  );

  const DialogTitle = ({
    children,
    className,
  }: {
    children: React.ReactNode;
    className?: string;
  }) => (
    <h2 data-testid="dialog-title" className={className}>
      {children}
    </h2>
  );

  const DialogDescription = ({ children }: { children: React.ReactNode }) => (
    <p data-testid="dialog-description">{children}</p>
  );

  const DialogFooter = ({
    children,
    className,
  }: {
    children: React.ReactNode;
    className?: string;
  }) => (
    <div data-testid="dialog-footer" className={className}>
      {children}
    </div>
  );

  const Select = ({
    children,
    value,
    onValueChange,
    disabled,
  }: {
    children: React.ReactNode;
    value?: string;
    onValueChange?: (value: string) => void;
    disabled?: boolean;
  }) => (
    <div data-testid="select" data-value={value} data-disabled={String(disabled)}>
      <select
        data-testid="select-native"
        value={value}
        disabled={disabled}
        onChange={(e) => {
          const result = onValueChange?.(e.target.value);
          if (result instanceof Promise) result.catch(() => {});
        }}
      >
        <option value="python">Python</option>
        <option value="r">R</option>
        <option value="javascript">JavaScript</option>
      </select>
      {children}
    </div>
  );

  const SelectContent = ({ children }: { children: React.ReactNode }) => (
    <div data-testid="select-content">{children}</div>
  );

  const SelectItem = ({ children, value }: { children: React.ReactNode; value: string }) => (
    <div data-testid="select-item" data-value={value}>
      {children}
    </div>
  );

  const SelectTrigger = ({
    children,
    className,
  }: {
    children: React.ReactNode;
    className?: string;
  }) => (
    <div data-testid="select-trigger" className={className}>
      {children}
    </div>
  );

  const SelectValue = () => <span data-testid="select-value" />;

  return {
    ...actual,
    Dialog,
    DialogTrigger,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogDescription,
    DialogFooter,
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
  };
});

// --------------------
// Test Data
// --------------------

const baseMacro = createMacro({
  id: "abc12345-6789-0abc-def0-123456789abc",
  name: "Test Macro",
  filename: "test_macro.py",
  description: "A test macro",
  language: "python",
  code: "print('hello')",
  sortOrder: null,
  createdBy: "user-123",
  createdByName: "John Doe",
  createdAt: "2024-01-15T10:00:00.000Z",
  updatedAt: "2024-06-20T14:30:00.000Z",
});

const nonCreatorMacro = createMacro({
  ...baseMacro,
  createdBy: "other-user-456",
});

// --------------------
// Tests
// --------------------

describe("<MacroDetailsSidebar />", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    server.mount(contract.macros.updateMacro, { body: baseMacro });
    server.mount(contract.macros.deleteMacro, {});
    server.mount(contract.macros.listCompatibleProtocols, {
      body: [
        {
          macroId: "abc12345-6789-0abc-def0-123456789abc",
          protocol: {
            id: "00000000-0000-0000-0000-000000000001",
            name: "Protocol 1",
            family: "multispeq",
            createdBy: "00000000-0000-0000-0000-000000000002",
          },
          addedAt: "2024-01-01T00:00:00.000Z",
        },
        {
          macroId: "abc12345-6789-0abc-def0-123456789abc",
          protocol: {
            id: "00000000-0000-0000-0000-000000000003",
            name: "Protocol 2",
            family: "multispeq",
            createdBy: "00000000-0000-0000-0000-000000000004",
          },
          addedAt: "2024-01-01T00:00:00.000Z",
        },
      ],
    });
    vi.mocked(useSession).mockReturnValue({
      data: { user: { id: "user-123" } },
    } as never);
  });

  describe("basic rendering", () => {
    it("renders the details sidebar card with correct title", () => {
      render(<MacroDetailsSidebar macroId="abc12345" macro={baseMacro} />);

      const card = screen.getByTestId("details-sidebar-card");
      expect(card).toBeInTheDocument();
      expect(card).toHaveAttribute("data-title", "macros.detailsTitle");
    });

    it("passes collapsed summary with updated date and macro id", () => {
      render(<MacroDetailsSidebar macroId="abc12345" macro={baseMacro} />);

      const card = screen.getByTestId("details-sidebar-card");
      const summary = card.getAttribute("data-collapsed-summary");
      expect(summary).toContain("common.updated");
      expect(summary).toContain("formatted:2024-06-20T14:30:00.000Z");
      expect(summary).toContain("macros.macroId");
      expect(summary).toContain("abc12345");
    });

    it("displays the macro id", () => {
      render(<MacroDetailsSidebar macroId="abc12345" macro={baseMacro} />);

      expect(screen.getByText("macros.macroId")).toBeInTheDocument();
      expect(screen.getByText(baseMacro.id)).toBeInTheDocument();
    });

    it("displays updated date", () => {
      render(<MacroDetailsSidebar macroId="abc12345" macro={baseMacro} />);

      expect(screen.getByText("common.updated")).toBeInTheDocument();
      expect(screen.getByText("formatted:2024-06-20T14:30:00.000Z")).toBeInTheDocument();
    });

    it("displays created date", () => {
      render(<MacroDetailsSidebar macroId="abc12345" macro={baseMacro} />);

      expect(screen.getByText("common.created")).toBeInTheDocument();
      expect(screen.getByText("formatted:2024-01-15T10:00:00.000Z")).toBeInTheDocument();
    });

    it("displays created by name", () => {
      render(<MacroDetailsSidebar macroId="abc12345" macro={baseMacro} />);

      expect(screen.getByText("common.createdBy")).toBeInTheDocument();
      expect(screen.getByText("John Doe")).toBeInTheDocument();
    });

    it("displays dash when createdByName is null", () => {
      const macroNoCreator: Macro = { ...baseMacro, createdByName: undefined };
      render(<MacroDetailsSidebar macroId="abc12345" macro={macroNoCreator} />);

      expect(screen.getByText("-")).toBeInTheDocument();
    });

    it("renders a separator", () => {
      render(<MacroDetailsSidebar macroId="abc12345" macro={baseMacro} />);

      const separators = screen.getAllByRole("separator");
      expect(separators.length).toBeGreaterThanOrEqual(1);
    });
  });

  describe("creator vs non-creator behavior", () => {
    it("shows language select dropdown when user is the creator", () => {
      render(<MacroDetailsSidebar macroId="abc12345" macro={baseMacro} />);

      expect(screen.getByTestId("select-native")).toBeInTheDocument();
      expect(screen.getByTestId("select-native")).toHaveValue("python");
    });

    it("shows language as plain text when user is not the creator", () => {
      render(<MacroDetailsSidebar macroId="abc12345" macro={nonCreatorMacro} />);

      expect(screen.queryByTestId("select-native")).not.toBeInTheDocument();
      expect(screen.getByText("python")).toBeInTheDocument();
    });

    it("renders MacroCompatibleProtocolsCard with embedded prop when user is creator", () => {
      render(<MacroDetailsSidebar macroId="abc12345" macro={baseMacro} />);

      const protocolsCard = screen.getByTestId("macro-compatible-protocols-card");
      expect(protocolsCard).toBeInTheDocument();
      expect(protocolsCard).toHaveAttribute("data-macro-id", "abc12345");
      expect(protocolsCard).toHaveAttribute("data-embedded", "true");
    });

    it("shows compatible protocols count as text when user is not the creator", async () => {
      render(<MacroDetailsSidebar macroId="abc12345" macro={nonCreatorMacro} />);

      expect(screen.queryByTestId("macro-compatible-protocols-card")).not.toBeInTheDocument();
      expect(screen.getByText("macroSettings.compatibleProtocols")).toBeInTheDocument();
      await waitFor(() => {
        expect(screen.getByText("2 protocols")).toBeInTheDocument();
      });
    });

    it("shows singular 'protocol' when count is 1", async () => {
      server.mount(contract.macros.listCompatibleProtocols, {
        body: [
          {
            macroId: "abc12345-6789-0abc-def0-123456789abc",
            protocol: {
              id: "00000000-0000-0000-0000-000000000001",
              name: "Protocol 1",
              family: "multispeq",
              createdBy: "00000000-0000-0000-0000-000000000002",
            },
            addedAt: "2024-01-01T00:00:00.000Z",
          },
        ],
      });

      render(<MacroDetailsSidebar macroId="abc12345" macro={nonCreatorMacro} />);

      await waitFor(() => {
        expect(screen.getByText("1 protocol")).toBeInTheDocument();
      });
    });

    it("shows 'no compatible protocols' text when count is 0 for non-creator", async () => {
      server.mount(contract.macros.listCompatibleProtocols, { body: [] });

      render(<MacroDetailsSidebar macroId="abc12345" macro={nonCreatorMacro} />);

      await waitFor(() => {
        expect(screen.getByText("macroSettings.noCompatibleProtocols")).toBeInTheDocument();
      });
    });
  });

  describe("language change", () => {
    it("calls updateMacro when language is changed", async () => {
      const spy = server.mount(contract.macros.updateMacro, { body: baseMacro });

      render(<MacroDetailsSidebar macroId="abc12345" macro={baseMacro} />);

      const selectEl = screen.getByTestId("select-native");
      await userEvent.selectOptions(selectEl, "r");

      await waitFor(() => {
        expect(spy.callCount).toBe(1);
      });
      expect(spy.params).toEqual({ id: "abc12345" });
      expect(spy.body).toEqual({ language: "r" });
    });

    it("calls toast on successful language update", async () => {
      server.mount(contract.macros.updateMacro, { body: baseMacro });

      render(<MacroDetailsSidebar macroId="abc12345" macro={baseMacro} />);

      const selectEl = screen.getByTestId("select-native");
      await userEvent.selectOptions(selectEl, "javascript");

      const { toast } = await import("@repo/ui/hooks");
      await waitFor(() => {
        expect(toast).toHaveBeenCalledWith({
          description: "macros.macroUpdated",
        });
      });
    });

    it("calls toast with destructive variant on language update error", async () => {
      server.mount(contract.macros.updateMacro, { status: 400 });

      render(<MacroDetailsSidebar macroId="abc12345" macro={baseMacro} />);

      const selectEl = screen.getByTestId("select-native");
      await userEvent.selectOptions(selectEl, "r");

      const { toast } = await import("@repo/ui/hooks");
      await waitFor(
        () => {
          expect(toast).toHaveBeenCalledWith({
            description: expect.any(String) as unknown,
            variant: "destructive",
          });
        },
        { timeout: 5000 },
      );
    });
  });

  describe("danger zone / delete functionality", () => {
    it("does not show danger zone when user is not the creator", () => {
      render(<MacroDetailsSidebar macroId="abc12345" macro={nonCreatorMacro} />);

      expect(screen.queryByText("macroSettings.dangerZone")).not.toBeInTheDocument();
      expect(screen.queryByText("macroSettings.deleteMacro")).not.toBeInTheDocument();
    });

    it("does not show danger zone when deletion feature flag is disabled", () => {
      render(<MacroDetailsSidebar macroId="abc12345" macro={baseMacro} />);

      // By default, useFeatureFlagEnabled returns false
      expect(screen.queryByText("macroSettings.dangerZone")).not.toBeInTheDocument();
    });

    it("shows danger zone when user is creator and deletion flag is enabled", async () => {
      const { useFeatureFlagEnabled } = await import("posthog-js/react");
      vi.mocked(useFeatureFlagEnabled).mockReturnValue(true);

      render(<MacroDetailsSidebar macroId="abc12345" macro={baseMacro} />);

      expect(screen.getByText("macroSettings.dangerZone")).toBeInTheDocument();
      expect(screen.getByText("macroSettings.deleteWarning")).toBeInTheDocument();
    });

    it("shows delete button in danger zone", async () => {
      const { useFeatureFlagEnabled } = await import("posthog-js/react");
      vi.mocked(useFeatureFlagEnabled).mockReturnValue(true);

      render(<MacroDetailsSidebar macroId="abc12345" macro={baseMacro} />);

      const deleteButtons = screen.getAllByText("macroSettings.deleteMacro");
      expect(deleteButtons.length).toBeGreaterThanOrEqual(1);
    });

    it("shows delete confirmation dialog with macro name", async () => {
      const { useFeatureFlagEnabled } = await import("posthog-js/react");
      vi.mocked(useFeatureFlagEnabled).mockReturnValue(true);

      render(<MacroDetailsSidebar macroId="abc12345" macro={baseMacro} />);

      // Dialog content is rendered (our mock always shows it)
      const dialogDescription = screen.getByTestId("dialog-description");
      expect(dialogDescription.textContent).toContain("common.confirmDelete");
    });

    it("shows cancel and confirm delete buttons in dialog", async () => {
      const { useFeatureFlagEnabled } = await import("posthog-js/react");
      vi.mocked(useFeatureFlagEnabled).mockReturnValue(true);

      render(<MacroDetailsSidebar macroId="abc12345" macro={baseMacro} />);

      expect(screen.getByText("macroSettings.cancel")).toBeInTheDocument();
      expect(screen.getByText("macroSettings.delete")).toBeInTheDocument();
    });

    it("calls deleteMacro and navigates on confirm delete", async () => {
      const { useFeatureFlagEnabled } = await import("posthog-js/react");
      vi.mocked(useFeatureFlagEnabled).mockReturnValue(true);
      const spy = server.mount(contract.macros.deleteMacro, {});

      render(<MacroDetailsSidebar macroId="abc12345" macro={baseMacro} />);

      // Find the confirm delete button by its text content
      const confirmButton = screen.getByRole("button", { name: "macroSettings.delete" });

      await userEvent.click(confirmButton);

      await waitFor(() => {
        expect(spy.callCount).toBe(1);
      });
      expect(spy.params).toEqual({ id: "abc12345" });
      await waitFor(() => {
        expect(vi.mocked(useRouter).mock.results[0]?.value.push).toHaveBeenCalledWith(
          "/en-US/platform/macros",
        );
      });
    });

    it("shows deleting state when deletion is pending", async () => {
      const { useFeatureFlagEnabled } = await import("posthog-js/react");
      vi.mocked(useFeatureFlagEnabled).mockReturnValue(true);
      server.mount(contract.macros.deleteMacro, { delay: 999_999 });

      render(<MacroDetailsSidebar macroId="abc12345" macro={baseMacro} />);

      const confirmButton = screen.getByRole("button", { name: "macroSettings.delete" });
      await userEvent.click(confirmButton);

      await waitFor(() => {
        expect(screen.getByText("macroSettings.deleting")).toBeInTheDocument();
      });

      // Confirm button should be disabled
      const deletingButton = screen.getByRole("button", { name: "macroSettings.deleting" });
      expect(deletingButton).toBeDisabled();
    });

    it("renders additional separator before danger zone", async () => {
      const { useFeatureFlagEnabled } = await import("posthog-js/react");
      vi.mocked(useFeatureFlagEnabled).mockReturnValue(true);

      render(<MacroDetailsSidebar macroId="abc12345" macro={baseMacro} />);

      const separators = screen.getAllByRole("separator");
      // Should have at least 2 separators: one before compatible protocols, one before danger zone
      expect(separators.length).toBeGreaterThanOrEqual(2);
    });
  });

  describe("language display for different languages", () => {
    it("displays 'r' language as plain text for non-creator", () => {
      const rMacro: Macro = { ...nonCreatorMacro, language: "r" };
      render(<MacroDetailsSidebar macroId="abc12345" macro={rMacro} />);

      expect(screen.getByText("r")).toBeInTheDocument();
    });

    it("displays 'javascript' language as plain text for non-creator", () => {
      const jsMacro: Macro = { ...nonCreatorMacro, language: "javascript" };
      render(<MacroDetailsSidebar macroId="abc12345" macro={jsMacro} />);

      expect(screen.getByText("javascript")).toBeInTheDocument();
    });

    it("sets select value to current macro language for creator", () => {
      const rMacro: Macro = { ...baseMacro, language: "r" };
      render(<MacroDetailsSidebar macroId="abc12345" macro={rMacro} />);

      expect(screen.getByTestId("select-native")).toHaveValue("r");
    });
  });
});
