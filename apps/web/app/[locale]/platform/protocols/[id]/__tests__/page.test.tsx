import { createProtocol } from "@/test/factories";
import { server } from "@/test/msw/server";
import { render, screen, userEvent, waitFor } from "@/test/test-utils";
import { use } from "react";
import type React from "react";
import { describe, it, expect, vi, beforeEach } from "vitest";

import { contract } from "@repo/api";
import { useSession } from "@repo/auth/client";
import { toast } from "@repo/ui/hooks";

import ProtocolOverviewPage from "../page";

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
      <button
        data-testid="description-save-btn"
        onClick={() => void onSave("updated description").catch(() => {})}
      >
        Save
      </button>
    </div>
  ),
}));

// --------------------
// Test data
// --------------------

const mockProtocol = createProtocol({
  id: "proto-1",
  name: "Water Quality Protocol",
  description: "Measures water quality parameters",
  family: "multispeq",
  code: [{ averages: 1 }],
  createdAt: "2025-01-01T00:00:00Z",
  updatedAt: "2025-06-15T00:00:00Z",
  createdByName: "Dr. Smith",
  createdBy: "other-user",
});

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

    // Mount both endpoints by default so auto-save doesn't fail
    server.mount(contract.protocols.getProtocol, { body: mockProtocol });
    server.mount(contract.protocols.updateProtocol, { body: mockProtocol });
  });

  it("should render loading state", () => {
    server.mount(contract.protocols.getProtocol, { body: mockProtocol, delay: 999_999 });

    render(<ProtocolOverviewPage params={Promise.resolve({ id: "proto-1" })} />);

    expect(screen.getByText("common.loading")).toBeInTheDocument();
  });

  it("should render error state", async () => {
    server.mount(contract.protocols.getProtocol, { status: 500 });

    render(<ProtocolOverviewPage params={Promise.resolve({ id: "proto-1" })} />);

    await waitFor(() => {
      expect(screen.getByTestId("error-display")).toBeInTheDocument();
    });
    expect(screen.getByText("errors.failedToLoadProtocol")).toBeInTheDocument();
  });

  it("should render the sidebar and main content area on success", async () => {
    server.mount(contract.protocols.getProtocol, { body: mockProtocol });

    render(<ProtocolOverviewPage params={Promise.resolve({ id: "proto-1" })} />);

    await waitFor(() => {
      expect(screen.getByTestId("protocol-details-sidebar")).toBeInTheDocument();
    });
    expect(screen.getByTestId("sidebar-protocol-id")).toHaveTextContent("proto-1");
    expect(screen.getByTestId("sidebar-protocol-name")).toHaveTextContent("Water Quality Protocol");
  });

  it("should render the inline editable description with correct props", async () => {
    server.mount(contract.protocols.getProtocol, { body: mockProtocol });

    render(<ProtocolOverviewPage params={Promise.resolve({ id: "proto-1" })} />);

    await waitFor(() => {
      expect(screen.getByTestId("inline-editable-description")).toBeInTheDocument();
    });
    expect(screen.getByTestId("description-title")).toHaveTextContent("protocols.descriptionTitle");
    expect(screen.getByTestId("description-content")).toHaveTextContent(
      "Measures water quality parameters",
    );
  });

  it("should pass hasAccess=false to description when user is not the creator", async () => {
    server.mount(contract.protocols.getProtocol, {
      body: createProtocol({ ...mockProtocol, createdBy: "other-user" }),
    });

    render(<ProtocolOverviewPage params={Promise.resolve({ id: "proto-1" })} />);

    await waitFor(() => {
      expect(screen.getByTestId("description-has-access")).toHaveTextContent("false");
    });
  });

  it("should pass hasAccess=true to description when user is the creator", async () => {
    server.mount(contract.protocols.getProtocol, {
      body: createProtocol({ ...mockProtocol, createdBy: "user-123" }),
    });

    render(<ProtocolOverviewPage params={Promise.resolve({ id: "proto-1" })} />);

    await waitFor(() => {
      expect(screen.getByTestId("description-has-access")).toHaveTextContent("true");
    });
  });

  it("should render the code viewer with title", async () => {
    server.mount(contract.protocols.getProtocol, { body: mockProtocol });

    render(<ProtocolOverviewPage params={Promise.resolve({ id: "proto-1" })} />);

    await waitFor(() => {
      expect(screen.getByTestId("viewer-title")).toHaveTextContent("protocols.codeTitle");
    });
  });

  it("should render JsonCodeViewer with protocol code when not editing", async () => {
    server.mount(contract.protocols.getProtocol, { body: mockProtocol });

    render(<ProtocolOverviewPage params={Promise.resolve({ id: "proto-1" })} />);

    await waitFor(() => {
      expect(screen.getByTestId("json-viewer")).toBeInTheDocument();
    });
    expect(screen.queryByTestId("protocol-code-editor")).not.toBeInTheDocument();
  });

  it("should show the edit button for the creator when not editing", async () => {
    server.mount(contract.protocols.getProtocol, {
      body: createProtocol({ ...mockProtocol, createdBy: "user-123" }),
    });

    render(<ProtocolOverviewPage params={Promise.resolve({ id: "proto-1" })} />);

    await waitFor(() => {
      expect(screen.getByRole("button", { name: /common\.edit/i })).toBeInTheDocument();
    });
    expect(screen.getByTestId("pencil-icon")).toBeInTheDocument();
  });

  it("should not show the edit button for non-creators", async () => {
    server.mount(contract.protocols.getProtocol, {
      body: createProtocol({ ...mockProtocol, createdBy: "other-user" }),
    });

    render(<ProtocolOverviewPage params={Promise.resolve({ id: "proto-1" })} />);

    await waitFor(() => {
      expect(screen.getByTestId("json-viewer")).toBeInTheDocument();
    });
    expect(screen.queryByRole("button", { name: /common\.edit/i })).not.toBeInTheDocument();
    expect(screen.queryByTestId("pencil-icon")).not.toBeInTheDocument();
  });

  it("should handle null description gracefully", async () => {
    server.mount(contract.protocols.getProtocol, {
      body: createProtocol({ ...mockProtocol, description: null }),
    });

    render(<ProtocolOverviewPage params={Promise.resolve({ id: "proto-1" })} />);

    await waitFor(() => {
      expect(screen.getByTestId("description-content")).toHaveTextContent("");
    });
  });

  it("should call toast with success message when description save succeeds", async () => {
    server.mount(contract.protocols.getProtocol, {
      body: createProtocol({ ...mockProtocol, createdBy: "user-123" }),
    });
    const updateSpy = server.mount(contract.protocols.updateProtocol, { body: mockProtocol });

    render(<ProtocolOverviewPage params={Promise.resolve({ id: "proto-1" })} />);

    await waitFor(() => {
      expect(screen.getByTestId("description-save-btn")).toBeInTheDocument();
    });

    const user = userEvent.setup();
    await user.click(screen.getByTestId("description-save-btn"));

    await waitFor(() => {
      expect(updateSpy.called).toBe(true);
    });
    expect(updateSpy.body).toMatchObject({ description: "updated description" });
    expect(updateSpy.params).toMatchObject({ id: "proto-1" });
    expect(toast).toHaveBeenCalledWith({ description: "protocols.protocolUpdated" });
  });

  it("should call toast with destructive variant when description save fails", async () => {
    server.mount(contract.protocols.getProtocol, {
      body: createProtocol({ ...mockProtocol, createdBy: "user-123" }),
    });
    server.mount(contract.protocols.updateProtocol, { status: 400 });

    render(<ProtocolOverviewPage params={Promise.resolve({ id: "proto-1" })} />);

    await waitFor(() => {
      expect(screen.getByTestId("description-save-btn")).toBeInTheDocument();
    });

    const user = userEvent.setup();
    await user.click(screen.getByTestId("description-save-btn"));

    await waitFor(() => {
      expect(toast).toHaveBeenCalledWith(expect.objectContaining({ variant: "destructive" }));
    });
  });

  it("should switch to ProtocolCodeEditor when creator clicks edit button", async () => {
    server.mount(contract.protocols.getProtocol, {
      body: createProtocol({ ...mockProtocol, createdBy: "user-123" }),
    });

    render(<ProtocolOverviewPage params={Promise.resolve({ id: "proto-1" })} />);

    await waitFor(() => {
      expect(screen.getByTestId("json-viewer")).toBeInTheDocument();
    });
    expect(screen.queryByTestId("protocol-code-editor")).not.toBeInTheDocument();

    const user = userEvent.setup();
    await user.click(screen.getByRole("button", { name: /common\.edit/i }));

    expect(screen.getByTestId("protocol-code-editor")).toBeInTheDocument();
    expect(screen.queryByTestId("json-viewer")).not.toBeInTheDocument();
  });
});
