import { render, screen, userEvent, waitFor } from "@/test/test-utils";
import { useRouter } from "next/navigation";
import React from "react";
import { describe, it, expect, vi, beforeEach } from "vitest";

import type { Protocol } from "@repo/api";
import { useSession } from "@repo/auth/client";

import { ProtocolDetailsSidebar } from "../protocol-details-sidebar";

// ---------- Hoisted mocks ----------
const mockUpdateProtocol = vi.fn().mockResolvedValue({});
const mockDeleteProtocol = vi.fn().mockResolvedValue({});
const useFeatureFlagEnabledMock = vi.hoisted(() => vi.fn());
const useProtocolDeleteMock = vi.hoisted(() => vi.fn());
const useProtocolCompatibleMacrosMock = vi.hoisted(() => vi.fn());

// ---------- Mocks ----------

vi.mock("@/util/date", () => ({
  formatDate: (dateString: string) => `formatted-${dateString}`,
}));

vi.mock("posthog-js/react", () => ({
  useFeatureFlagEnabled: useFeatureFlagEnabledMock,
}));

vi.mock("@repo/analytics", () => ({
  FEATURE_FLAGS: {
    PROTOCOL_DELETION: "protocol-deletion",
  },
}));

vi.mock("@/hooks/protocol/useProtocolUpdate/useProtocolUpdate", () => ({
  useProtocolUpdate: () => ({
    mutateAsync: mockUpdateProtocol,
    isPending: false,
  }),
}));

vi.mock("../../../hooks/protocol/useProtocolDelete/useProtocolDelete", () => ({
  useProtocolDelete: useProtocolDeleteMock,
}));

vi.mock("../../../hooks/protocol/useProtocolCompatibleMacros/useProtocolCompatibleMacros", () => ({
  useProtocolCompatibleMacros: useProtocolCompatibleMacrosMock,
}));

vi.mock("~/util/apiError", () => ({
  parseApiError: (err: unknown) => ({ message: String(err) }),
}));

// Dialog mock that properly responds to React-managed open/onOpenChange state.
// The component uses <Dialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>,
// so Dialog receives the controlled open prop. DialogTrigger with asChild makes the child
// button call onOpenChange(true). We wire DialogTrigger clicks to onOpenChange via context.
const DialogContext = React.createContext<{
  open?: boolean;
  onOpenChange?: (v: boolean) => void;
}>({});

vi.mock("@repo/ui/components", () => ({
  Button: ({
    children,
    variant: _variant,
    ...props
  }: React.PropsWithChildren<
    React.ButtonHTMLAttributes<HTMLButtonElement> & { variant?: string }
  >) => <button {...props}>{children}</button>,
  Dialog: ({
    children,
    open,
    onOpenChange,
  }: {
    children: React.ReactNode;
    open?: boolean;
    onOpenChange?: (v: boolean) => void;
  }) => (
    <DialogContext.Provider value={{ open, onOpenChange }}>
      <div data-testid="dialog" data-open={open}>
        {children}
      </div>
    </DialogContext.Provider>
  ),
  DialogTrigger: ({ children }: { children: React.ReactNode; asChild?: boolean }) => {
    const { onOpenChange } = React.useContext(DialogContext);
    return (
      <div data-testid="dialog-trigger" onClick={() => onOpenChange?.(true)}>
        {children}
      </div>
    );
  },
  DialogContent: ({ children }: { children: React.ReactNode }) => {
    const { open } = React.useContext(DialogContext);
    if (!open) return null;
    return (
      <div role="dialog" data-testid="dialog-content">
        {children}
      </div>
    );
  },
  DialogHeader: ({ children }: { children: React.ReactNode }) => (
    <div data-testid="dialog-header">{children}</div>
  ),
  DialogTitle: ({ children, className }: { children: React.ReactNode; className?: string }) => (
    <h2 data-testid="dialog-title" className={className}>
      {children}
    </h2>
  ),
  DialogDescription: ({ children }: { children: React.ReactNode }) => (
    <p data-testid="dialog-description">{children}</p>
  ),
  DialogFooter: ({ children, className }: { children: React.ReactNode; className?: string }) => (
    <div data-testid="dialog-footer" className={className}>
      {children}
    </div>
  ),
  Select: ({
    children,
    value,
    onValueChange,
    disabled,
  }: {
    children: React.ReactNode;
    value: string;
    onValueChange: (val: string) => void;
    disabled?: boolean;
  }) => (
    <div data-testid="select" data-value={value} data-disabled={disabled}>
      <select
        data-testid="select-native"
        value={value}
        disabled={disabled}
        onChange={(e) => onValueChange(e.target.value)}
      >
        <option value="multispeq">MultispeQ</option>
        <option value="ambit">Ambit</option>
      </select>
      {children}
    </div>
  ),
  SelectContent: ({ children }: { children: React.ReactNode }) => (
    <div data-testid="select-content">{children}</div>
  ),
  SelectItem: ({ children, value }: { children: React.ReactNode; value: string }) => (
    <div data-testid={`select-item-${value}`}>{children}</div>
  ),
  SelectTrigger: ({ children, className }: { children: React.ReactNode; className?: string }) => (
    <div data-testid="select-trigger" className={className}>
      {children}
    </div>
  ),
  SelectValue: () => <span data-testid="select-value" />,
  Card: ({ children, className }: { children: React.ReactNode; className?: string }) => (
    <div data-testid="card" className={className}>
      {children}
    </div>
  ),
  CardContent: ({ children, className }: { children: React.ReactNode; className?: string }) => (
    <div data-testid="card-content" className={className}>
      {children}
    </div>
  ),
  CardHeader: ({ children }: { children: React.ReactNode }) => (
    <div data-testid="card-header">{children}</div>
  ),
}));

vi.mock("../../protocol-settings/protocol-compatible-macros-card", () => ({
  ProtocolCompatibleMacrosCard: ({
    protocolId,
    embedded,
  }: {
    protocolId: string;
    embedded?: boolean;
  }) => (
    <div data-testid="protocol-compatible-macros-card" data-embedded={embedded}>
      {protocolId}
    </div>
  ),
}));

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
    <div data-testid="details-sidebar-card" data-collapsed-summary={collapsedSummary}>
      <h3>{title}</h3>
      {children}
    </div>
  ),
}));

// ---------- Test Data ----------
const mockProtocol: Protocol = {
  id: "550e8400-e29b-41d4-a716-446655440000",
  name: "Test Protocol",
  description: "A test protocol description",
  code: [{ averages: 1 }],
  family: "multispeq",
  sortOrder: null,
  createdBy: "user-123",
  createdByName: "John Doe",
  createdAt: "2024-01-01T00:00:00.000Z",
  updatedAt: "2024-06-15T12:00:00.000Z",
};

// ---------- Helpers ----------
function renderComponent(props: Partial<React.ComponentProps<typeof ProtocolDetailsSidebar>> = {}) {
  const defaultProps: React.ComponentProps<typeof ProtocolDetailsSidebar> = {
    protocolId: "550e8400-e29b-41d4-a716-446655440000",
    protocol: mockProtocol,
    ...props,
  };

  return render(<ProtocolDetailsSidebar {...defaultProps} />);
}

// ---------- Tests ----------
describe("ProtocolDetailsSidebar", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Default: user is the creator, feature flag enabled
    vi.mocked(useSession).mockReturnValue({ data: { user: { id: "user-123" } } } as never);
    useFeatureFlagEnabledMock.mockReturnValue(true);
    useProtocolDeleteMock.mockReturnValue({
      mutateAsync: mockDeleteProtocol,
      isPending: false,
    });
    useProtocolCompatibleMacrosMock.mockReturnValue({
      data: { body: [{ macro: { id: "macro-1" } }, { macro: { id: "macro-2" } }] },
    });
  });

  // ---- Basic rendering ----

  it("renders the sidebar with the details title", () => {
    renderComponent();
    expect(screen.getByText("protocols.detailsTitle")).toBeInTheDocument();
  });

  it("renders protocol ID", () => {
    renderComponent();
    expect(screen.getByText("protocols.protocolId")).toBeInTheDocument();
    // The ID appears both in the protocol ID section and in the compatible macros card mock
    const idElements = screen.getAllByText("550e8400-e29b-41d4-a716-446655440000");
    expect(idElements.length).toBeGreaterThanOrEqual(1);
    // The first match is the protocol ID display (in a <p> with font-mono class)
    expect(idElements[0]).toHaveClass("font-mono");
  });

  it("renders updated date", () => {
    renderComponent();
    expect(screen.getByText("common.updated")).toBeInTheDocument();
    expect(screen.getByText("formatted-2024-06-15T12:00:00.000Z")).toBeInTheDocument();
  });

  it("renders created date", () => {
    renderComponent();
    expect(screen.getByText("common.created")).toBeInTheDocument();
    expect(screen.getByText("formatted-2024-01-01T00:00:00.000Z")).toBeInTheDocument();
  });

  it("renders creator name", () => {
    renderComponent();
    expect(screen.getByText("experiments.createdBy")).toBeInTheDocument();
    expect(screen.getByText("John Doe")).toBeInTheDocument();
  });

  it("renders dash when creator name is not available", () => {
    const protocolNoCreator = { ...mockProtocol, createdByName: undefined };
    renderComponent({ protocol: protocolNoCreator });
    expect(screen.getByText("-")).toBeInTheDocument();
  });

  it("passes collapsed summary to DetailsSidebarCard", () => {
    renderComponent();
    const sidebarCard = screen.getByTestId("details-sidebar-card");
    expect(sidebarCard.dataset.collapsedSummary).toContain("common.updated");
    expect(sidebarCard.dataset.collapsedSummary).toContain("formatted-2024-06-15T12:00:00.000Z");
    expect(sidebarCard.dataset.collapsedSummary).toContain("protocols.protocolId");
    expect(sidebarCard.dataset.collapsedSummary).toContain("550e8400...");
  });

  // ---- Creator vs Non-Creator: Family selector ----

  it("renders a Select component for family when user is the creator", () => {
    renderComponent();
    expect(screen.getByTestId("select")).toBeInTheDocument();
    expect(screen.getByTestId("select-native")).toBeInTheDocument();
  });

  it("renders family as plain text when user is not the creator", () => {
    vi.mocked(useSession).mockReturnValue({ data: { user: { id: "other-user" } } } as never);
    renderComponent();
    expect(screen.queryByTestId("select")).not.toBeInTheDocument();
    expect(screen.getByText("MultispeQ")).toBeInTheDocument();
  });

  it("renders Ambit text when family is ambit and user is not the creator", () => {
    vi.mocked(useSession).mockReturnValue({ data: { user: { id: "other-user" } } } as never);
    renderComponent({
      protocol: { ...mockProtocol, family: "ambit" },
    });
    expect(screen.getByText("Ambit")).toBeInTheDocument();
  });

  it("calls updateProtocol when family is changed", async () => {
    renderComponent();

    const selectNative = screen.getByTestId("select-native");
    const user = userEvent.setup();
    await user.selectOptions(selectNative, "ambit");

    await waitFor(() => {
      expect(mockUpdateProtocol).toHaveBeenCalledWith(
        {
          params: { id: "550e8400-e29b-41d4-a716-446655440000" },
          body: { family: "ambit" },
        },
        expect.objectContaining({
          onSuccess: expect.any(Function) as unknown,
          onError: expect.any(Function) as unknown,
        }),
      );
    });
  });

  it("shows toast on successful family update", async () => {
    mockUpdateProtocol.mockImplementation(
      (_args: unknown, opts: { onSuccess?: () => void; onError?: (err: unknown) => void }) => {
        opts.onSuccess?.();
      },
    );

    const { toast } = await import("@repo/ui/hooks");

    renderComponent();

    const selectNative = screen.getByTestId("select-native");
    const user = userEvent.setup();
    await user.selectOptions(selectNative, "ambit");

    await waitFor(() => {
      expect(toast).toHaveBeenCalledWith({
        description: "protocols.protocolUpdated",
      });
    });
  });

  it("shows destructive toast on family update error", async () => {
    mockUpdateProtocol.mockImplementation(
      (_args: unknown, opts: { onSuccess?: () => void; onError?: (err: unknown) => void }) => {
        opts.onError?.(new Error("Update failed"));
      },
    );

    const { toast } = await import("@repo/ui/hooks");

    renderComponent();

    const selectNative = screen.getByTestId("select-native");
    const user = userEvent.setup();
    await user.selectOptions(selectNative, "ambit");

    await waitFor(() => {
      expect(toast).toHaveBeenCalledWith({
        description: expect.any(String) as unknown,
        variant: "destructive",
      });
    });
  });

  // ---- Creator vs Non-Creator: Compatible Macros ----

  it("renders ProtocolCompatibleMacrosCard when user is the creator", () => {
    renderComponent();
    const card = screen.getByTestId("protocol-compatible-macros-card");
    expect(card).toBeInTheDocument();
    expect(card).toHaveTextContent("550e8400-e29b-41d4-a716-446655440000");
    expect(card.dataset.embedded).toBe("true");
  });

  it("renders compatible macros count text when user is not the creator", () => {
    vi.mocked(useSession).mockReturnValue({ data: { user: { id: "other-user" } } } as never);
    renderComponent();
    expect(screen.queryByTestId("protocol-compatible-macros-card")).not.toBeInTheDocument();
    expect(screen.getByText("protocolSettings.compatibleMacros")).toBeInTheDocument();
    expect(screen.getByText("2 macros")).toBeInTheDocument();
  });

  it("renders singular 'macro' for single compatible macro", () => {
    vi.mocked(useSession).mockReturnValue({ data: { user: { id: "other-user" } } } as never);
    useProtocolCompatibleMacrosMock.mockReturnValue({
      data: { body: [{ macro: { id: "macro-1" } }] },
    });

    renderComponent();
    expect(screen.getByText("1 macro")).toBeInTheDocument();
  });

  it("renders 'no compatible macros' text when count is zero and user is not creator", () => {
    vi.mocked(useSession).mockReturnValue({ data: { user: { id: "other-user" } } } as never);
    useProtocolCompatibleMacrosMock.mockReturnValue({
      data: { body: [] },
    });

    renderComponent();
    expect(screen.getByText("protocolSettings.noCompatibleMacros")).toBeInTheDocument();
  });

  it("renders 'no compatible macros' when data is undefined and user is not creator", () => {
    vi.mocked(useSession).mockReturnValue({ data: { user: { id: "other-user" } } } as never);
    useProtocolCompatibleMacrosMock.mockReturnValue({
      data: undefined,
    });

    renderComponent();
    expect(screen.getByText("protocolSettings.noCompatibleMacros")).toBeInTheDocument();
  });

  // ---- Danger Zone (Delete) ----

  it("renders danger zone when user is creator and feature flag is enabled", () => {
    renderComponent();
    expect(screen.getByText("protocolSettings.dangerZone")).toBeInTheDocument();
    expect(screen.getByText("protocolSettings.deleteWarning")).toBeInTheDocument();
    // The trigger button shows "protocolSettings.deleteProtocol"
    // DialogContent is hidden (dialog starts closed), so only one instance appears
    expect(screen.getByText("protocolSettings.deleteProtocol")).toBeInTheDocument();
  });

  it("does not render danger zone when user is not the creator", () => {
    vi.mocked(useSession).mockReturnValue({ data: { user: { id: "other-user" } } } as never);
    renderComponent();
    expect(screen.queryByText("protocolSettings.dangerZone")).not.toBeInTheDocument();
    expect(screen.queryByText("protocolSettings.deleteProtocol")).not.toBeInTheDocument();
  });

  it("does not render danger zone when feature flag is disabled", () => {
    useFeatureFlagEnabledMock.mockReturnValue(false);
    renderComponent();
    expect(screen.queryByText("protocolSettings.dangerZone")).not.toBeInTheDocument();
    expect(screen.queryByText("protocolSettings.deleteProtocol")).not.toBeInTheDocument();
  });

  it("does not render danger zone when both non-creator and flag disabled", () => {
    vi.mocked(useSession).mockReturnValue({ data: { user: { id: "other-user" } } } as never);
    useFeatureFlagEnabledMock.mockReturnValue(false);
    renderComponent();
    expect(screen.queryByText("protocolSettings.dangerZone")).not.toBeInTheDocument();
  });

  it("opens delete dialog when delete trigger is clicked", async () => {
    renderComponent();

    // Dialog starts closed
    const dialog = screen.getByTestId("dialog");
    expect(dialog.dataset.open).toBe("false");
    // Dialog content should not be visible when closed
    expect(screen.queryByTestId("dialog-content")).not.toBeInTheDocument();

    // Click the dialog trigger area (which calls onOpenChange(true))
    const trigger = screen.getByTestId("dialog-trigger");
    const user = userEvent.setup();
    await user.click(trigger);

    // Dialog should now be open
    expect(dialog.dataset.open).toBe("true");
    expect(screen.getByTestId("dialog-content")).toBeInTheDocument();
    expect(screen.getByTestId("dialog-description")).toHaveTextContent("common.confirmDelete");
  });

  it("closes delete dialog when cancel is clicked", async () => {
    renderComponent();

    const dialog = screen.getByTestId("dialog");

    // Open dialog
    const trigger = screen.getByTestId("dialog-trigger");
    const user = userEvent.setup();
    await user.click(trigger);
    expect(dialog.dataset.open).toBe("true");

    // Click cancel
    const cancelButton = screen.getByText("protocolSettings.cancel");
    await user.click(cancelButton);

    // Dialog should be closed
    expect(dialog.dataset.open).toBe("false");
    expect(screen.queryByTestId("dialog-content")).not.toBeInTheDocument();
  });

  it("calls deleteProtocol and navigates on confirm delete", async () => {
    renderComponent();

    // Open dialog
    const trigger = screen.getByTestId("dialog-trigger");
    const user = userEvent.setup();
    await user.click(trigger);

    // Click confirm delete
    const confirmButton = screen.getByText("protocolSettings.delete");
    await user.click(confirmButton);

    await waitFor(() => {
      expect(mockDeleteProtocol).toHaveBeenCalledWith({
        params: { id: "550e8400-e29b-41d4-a716-446655440000" },
      });
    });

    await waitFor(() => {
      expect(vi.mocked(useRouter).mock.results[0]?.value.push).toHaveBeenCalledWith(
        "/en-US/platform/protocols",
      );
    });
  });

  it("shows deleting text when delete is in progress", async () => {
    useProtocolDeleteMock.mockReturnValue({
      mutateAsync: mockDeleteProtocol,
      isPending: true,
    });

    renderComponent();

    // Open dialog to see the deleting text
    const trigger = screen.getByTestId("dialog-trigger");
    const user = userEvent.setup();
    await user.click(trigger);

    // The deleting text replaces the delete button text when isPending is true
    expect(screen.getByText("protocolSettings.deleting")).toBeInTheDocument();
  });

  it("disables confirm delete button when delete is in progress", async () => {
    useProtocolDeleteMock.mockReturnValue({
      mutateAsync: mockDeleteProtocol,
      isPending: true,
    });

    renderComponent();

    // Open dialog
    const trigger = screen.getByTestId("dialog-trigger");
    const user = userEvent.setup();
    await user.click(trigger);

    // The confirm delete button should be disabled
    const deletingButton = screen.getByText("protocolSettings.deleting");
    expect(deletingButton).toBeDisabled();
  });

  // ---- Separator rendering ----

  it("renders separators", () => {
    renderComponent();
    const separators = screen.getAllByRole("separator");
    // One for compatible macros section, one for danger zone
    expect(separators.length).toBeGreaterThanOrEqual(2);
  });

  it("renders only one separator when danger zone is hidden", () => {
    useFeatureFlagEnabledMock.mockReturnValue(false);
    renderComponent();
    const separators = screen.getAllByRole("separator");
    expect(separators).toHaveLength(1);
  });

  // ---- Session edge case ----

  it("treats user as non-creator when session is null", () => {
    vi.mocked(useSession).mockReturnValue({ data: null } as never);
    renderComponent();

    // Should show plain text family, not a Select
    expect(screen.queryByTestId("select")).not.toBeInTheDocument();
    expect(screen.getByText("MultispeQ")).toBeInTheDocument();

    // Should not show danger zone
    expect(screen.queryByText("protocolSettings.dangerZone")).not.toBeInTheDocument();
  });

  it("renders family label", () => {
    renderComponent();
    expect(screen.getByText("protocols.family")).toBeInTheDocument();
  });
});
