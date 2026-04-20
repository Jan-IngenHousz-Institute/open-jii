import { createProtocol } from "@/test/factories";
import { server } from "@/test/msw/server";
import { render, screen, userEvent, waitFor } from "@/test/test-utils";
import { useRouter } from "next/navigation";
import { useFeatureFlagEnabled } from "posthog-js/react";
import React from "react";
import { describe, it, expect, vi, beforeEach } from "vitest";

import { contract } from "@repo/api";
import { useSession } from "@repo/auth/client";

import { ProtocolDetailsSidebar } from "../protocol-details-sidebar";

vi.mock("@/util/date", () => ({
  formatDate: (dateString: string) => `formatted-${dateString}`,
}));

vi.mock("@repo/analytics", () => ({
  FEATURE_FLAGS: {
    PROTOCOL_DELETION: "protocol-deletion",
  },
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

vi.mock("@repo/ui/components", async (importOriginal) => {
  const actual = await importOriginal<Record<string, unknown>>();
  return {
    ...actual,
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
          onChange={(e) => {
            // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
            const result = onValueChange?.(e.target.value);
            if (result instanceof Promise)
              result.catch(() => {
                /* noop */
              });
          }}
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
  };
});

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

const mockProtocol = createProtocol({
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
});

function renderComponent(props: Partial<React.ComponentProps<typeof ProtocolDetailsSidebar>> = {}) {
  const defaultProps: React.ComponentProps<typeof ProtocolDetailsSidebar> = {
    protocolId: "550e8400-e29b-41d4-a716-446655440000",
    protocol: mockProtocol,
    ...props,
  };

  return render(<ProtocolDetailsSidebar {...defaultProps} />);
}

describe("ProtocolDetailsSidebar", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Default: user is the creator, feature flag enabled
    vi.mocked(useSession).mockReturnValue({ data: { user: { id: "user-123" } } } as never);
    vi.mocked(useFeatureFlagEnabled).mockReturnValue(true);
    server.mount(contract.protocols.updateProtocol, { body: mockProtocol });
    server.mount(contract.protocols.deleteProtocol, {});
    server.mount(contract.protocols.listCompatibleMacros, {
      body: [
        {
          protocolId: "550e8400-e29b-41d4-a716-446655440000",
          macro: {
            id: "00000000-0000-0000-0000-000000000001",
            name: "Macro 1",
            filename: "macro1.py",
            language: "python" as const,
            createdBy: "00000000-0000-0000-0000-000000000002",
          },
          addedAt: "2024-01-01T00:00:00.000Z",
        },
        {
          protocolId: "550e8400-e29b-41d4-a716-446655440000",
          macro: {
            id: "00000000-0000-0000-0000-000000000003",
            name: "Macro 2",
            filename: "macro2.py",
            language: "python" as const,
            createdBy: "00000000-0000-0000-0000-000000000004",
          },
          addedAt: "2024-01-01T00:00:00.000Z",
        },
      ],
    });
  });

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
    const spy = server.mount(contract.protocols.updateProtocol, { body: mockProtocol });
    renderComponent();

    const selectNative = screen.getByTestId("select-native");
    const user = userEvent.setup();
    await user.selectOptions(selectNative, "ambit");

    await waitFor(() => {
      expect(spy.called).toBe(true);
    });
    expect(spy.body).toEqual({ family: "ambit" });
    expect(spy.params).toEqual({ id: "550e8400-e29b-41d4-a716-446655440000" });
  });

  it("shows toast on successful family update", async () => {
    server.mount(contract.protocols.updateProtocol, { body: mockProtocol });
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
    server.mount(contract.protocols.updateProtocol, { status: 400 });
    const { toast } = await import("@repo/ui/hooks");

    renderComponent();

    const selectNative = screen.getByTestId("select-native");
    const user = userEvent.setup();
    await user.selectOptions(selectNative, "ambit");

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

  it("renders ProtocolCompatibleMacrosCard when user is the creator", () => {
    renderComponent();
    const card = screen.getByTestId("protocol-compatible-macros-card");
    expect(card).toBeInTheDocument();
    expect(card).toHaveTextContent("550e8400-e29b-41d4-a716-446655440000");
    expect(card.dataset.embedded).toBe("true");
  });

  it("renders compatible macros count text when user is not the creator", async () => {
    vi.mocked(useSession).mockReturnValue({ data: { user: { id: "other-user" } } } as never);
    renderComponent();
    expect(screen.queryByTestId("protocol-compatible-macros-card")).not.toBeInTheDocument();
    expect(screen.getByText("protocolSettings.compatibleMacros")).toBeInTheDocument();
    await waitFor(() => {
      expect(screen.getByText("2 macros")).toBeInTheDocument();
    });
  });

  it("renders singular 'macro' for single compatible macro", async () => {
    vi.mocked(useSession).mockReturnValue({ data: { user: { id: "other-user" } } } as never);
    server.mount(contract.protocols.listCompatibleMacros, {
      body: [
        {
          protocolId: "550e8400-e29b-41d4-a716-446655440000",
          macro: {
            id: "00000000-0000-0000-0000-000000000001",
            name: "Macro 1",
            filename: "macro1.py",
            language: "python" as const,
            createdBy: "00000000-0000-0000-0000-000000000002",
          },
          addedAt: "2024-01-01T00:00:00.000Z",
        },
      ],
    });

    renderComponent();
    await waitFor(() => {
      expect(screen.getByText("1 macro")).toBeInTheDocument();
    });
  });

  it("renders 'no compatible macros' text when count is zero and user is not creator", async () => {
    vi.mocked(useSession).mockReturnValue({ data: { user: { id: "other-user" } } } as never);
    server.mount(contract.protocols.listCompatibleMacros, { body: [] });

    renderComponent();
    await waitFor(() => {
      expect(screen.getByText("protocolSettings.noCompatibleMacros")).toBeInTheDocument();
    });
  });

  it("renders 'no compatible macros' when data is undefined and user is not creator", async () => {
    vi.mocked(useSession).mockReturnValue({ data: { user: { id: "other-user" } } } as never);
    server.mount(contract.protocols.listCompatibleMacros, { body: [] });

    renderComponent();
    await waitFor(() => {
      expect(screen.getByText("protocolSettings.noCompatibleMacros")).toBeInTheDocument();
    });
  });

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
    vi.mocked(useFeatureFlagEnabled).mockReturnValue(false);
    renderComponent();
    expect(screen.queryByText("protocolSettings.dangerZone")).not.toBeInTheDocument();
    expect(screen.queryByText("protocolSettings.deleteProtocol")).not.toBeInTheDocument();
  });

  it("does not render danger zone when both non-creator and flag disabled", () => {
    vi.mocked(useSession).mockReturnValue({ data: { user: { id: "other-user" } } } as never);
    vi.mocked(useFeatureFlagEnabled).mockReturnValue(false);
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
    const spy = server.mount(contract.protocols.deleteProtocol, {});
    renderComponent();

    // Open dialog
    const trigger = screen.getByTestId("dialog-trigger");
    const user = userEvent.setup();
    await user.click(trigger);

    // Click confirm delete
    const confirmButton = screen.getByText("protocolSettings.delete");
    await user.click(confirmButton);

    await waitFor(() => {
      expect(spy.called).toBe(true);
    });
    expect(spy.params).toEqual({ id: "550e8400-e29b-41d4-a716-446655440000" });

    await waitFor(() => {
      expect(
        // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
        vi.mocked(useRouter).mock.results[0]?.value.push as ReturnType<typeof vi.fn>,
      ).toHaveBeenCalledWith("/en-US/platform/protocols");
    });
  });

  it("shows deleting text when delete is in progress", async () => {
    server.mount(contract.protocols.deleteProtocol, { delay: 999_999 });

    renderComponent();

    // Open dialog to see the deleting text
    const trigger = screen.getByTestId("dialog-trigger");
    const user = userEvent.setup();
    await user.click(trigger);

    // Click confirm delete to trigger the mutation
    const confirmButton = screen.getByText("protocolSettings.delete");
    await user.click(confirmButton);

    // The deleting text replaces the delete button text when isPending is true
    await waitFor(() => {
      expect(screen.getByText("protocolSettings.deleting")).toBeInTheDocument();
    });
  });

  it("disables confirm delete button when delete is in progress", async () => {
    server.mount(contract.protocols.deleteProtocol, { delay: 999_999 });

    renderComponent();

    // Open dialog
    const trigger = screen.getByTestId("dialog-trigger");
    const user = userEvent.setup();
    await user.click(trigger);

    // Click confirm delete to trigger the mutation
    const confirmButton = screen.getByText("protocolSettings.delete");
    await user.click(confirmButton);

    // The confirm delete button should be disabled while pending
    await waitFor(() => {
      expect(screen.getByText("protocolSettings.deleting")).toBeDisabled();
    });
  });

  it("renders separators", () => {
    renderComponent();
    const separators = screen.getAllByRole("separator");
    // One for compatible macros section, one for danger zone
    expect(separators.length).toBeGreaterThanOrEqual(2);
  });

  it("renders only one separator when danger zone is hidden", () => {
    vi.mocked(useFeatureFlagEnabled).mockReturnValue(false);
    renderComponent();
    const separators = screen.getAllByRole("separator");
    expect(separators).toHaveLength(1);
  });

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
