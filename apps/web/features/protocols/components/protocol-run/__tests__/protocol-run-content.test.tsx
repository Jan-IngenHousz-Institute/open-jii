import { createProtocol } from "@/test/factories";
import { server } from "@/test/msw/server";
import { render, screen, userEvent, waitFor } from "@/test/test-utils";
import type React from "react";
import { describe, it, expect, vi, beforeEach } from "vitest";

import { contract } from "@repo/api/contract";
import { useSession } from "@repo/auth/client";

import { ProtocolRunContent } from "../protocol-run-content";

vi.mock("@repo/ui/lib/utils", () => ({
  cn: (...args: unknown[]) => args.filter(Boolean).join(" "),
}));

let mockBrowserSupport = {
  bluetooth: true,
  serial: true,
  any: true,
  bluetoothReason: null,
  serialReason: null,
};
vi.mock("@/features/iot/hooks/useIotBrowserSupport", () => ({
  useIotBrowserSupport: () => mockBrowserSupport,
}));

let mockSession: { user: { id: string } } | null = null;

// Captured to drive the autosave path without the real CodeMirror pipeline.
let capturedOnChange: ((value: Record<string, unknown>[] | string | undefined) => void) | null =
  null;
vi.mock("@/features/protocols/components/protocol-code-editor", () => ({
  __esModule: true,
  default: ({
    headerActions,
    onChange,
  }: {
    headerActions?: React.ReactNode;
    onChange: (value: Record<string, unknown>[] | string | undefined) => void;
  }) => {
    capturedOnChange = onChange;
    return <div data-testid="code-editor">{headerActions}</div>;
  },
}));

vi.mock("@/features/protocols/components/json-code-viewer", () => ({
  JsonCodeViewer: ({
    onEditStart,
  }: {
    value: unknown;
    height?: string;
    onEditStart?: () => void;
  }) => (
    <div data-testid="json-viewer" onClick={onEditStart}>
      {onEditStart && <button data-testid="edit-trigger">Edit</button>}
    </div>
  ),
}));

vi.mock("@/shared/ui/code-editor-header-actions", () => ({
  CodeEditorHeaderActions: () => <div data-testid="editor-header-actions" />,
}));

vi.mock("@/features/protocols/components/iot-protocol-runner", () => ({
  IotProtocolRunner: () => <div data-testid="iot-runner" />,
}));

vi.mock("@repo/ui/hooks/use-mobile", async (importOriginal) => {
  const original = await importOriginal<Record<string, unknown>>();
  return {
    ...original,
    useIsMobile: () => false,
    useIsTablet: () => false,
    useIsLgTablet: () => false,
    useBreakpoint: () => ({ isMobile: false, isTablet: false, isLgTablet: false }),
  };
});

vi.mock("@repo/ui/components/resizable", async (importOriginal) => {
  const actual = await importOriginal<Record<string, unknown>>();
  return {
    ...actual,
    ResizablePanelGroup: ({ children }: { children: React.ReactNode }) => (
      <div data-testid="panel-group">{children}</div>
    ),
    ResizablePanel: ({ children }: { children: React.ReactNode }) => (
      <div data-testid="panel">{children}</div>
    ),
    ResizableHandle: () => <div data-testid="panel-handle" />,
  };
});

describe("<ProtocolRunContent />", () => {
  const mockProtocol = createProtocol({
    id: "proto-1",
    name: "Test Protocol",
    code: [{ averages: 1 }],
    family: "multispeq",
    createdBy: "user-1",
  });

  beforeEach(() => {
    vi.clearAllMocks();
    capturedOnChange = null;
    server.mount(contract.protocols.getProtocol, { body: mockProtocol });
    server.mount(contract.protocols.updateProtocol, { body: mockProtocol });
    mockBrowserSupport = {
      bluetooth: true,
      serial: true,
      any: true,
      bluetoothReason: null,
      serialReason: null,
    };
    mockSession = null;
    vi.mocked(useSession).mockImplementation(() => ({ data: mockSession }) as never);
  });

  it("should show loading state", () => {
    server.mount(contract.protocols.getProtocol, { delay: 999_999 });

    render(<ProtocolRunContent protocolId="proto-1" />);

    expect(screen.getByText("common.loading")).toBeInTheDocument();
  });

  it("should show not found when no data", async () => {
    server.mount(contract.protocols.getProtocol, { status: 404 });

    render(<ProtocolRunContent protocolId="proto-1" />);

    await waitFor(() => {
      expect(screen.getByText("protocols.notFound")).toBeInTheDocument();
    });
  });

  it("should render read-only json viewer and IoT runner by default", async () => {
    render(<ProtocolRunContent protocolId="proto-1" />);

    await waitFor(() => {
      expect(screen.getByTestId("json-viewer")).toBeInTheDocument();
    });
    expect(screen.queryByTestId("code-editor")).not.toBeInTheDocument();
    expect(screen.getByTestId("iot-runner")).toBeInTheDocument();
  });

  it("should show browser not supported message when no support", async () => {
    mockBrowserSupport = {
      bluetooth: false,
      serial: false,
      any: false,
      bluetoothReason: null,
      serialReason: null,
    };

    render(<ProtocolRunContent protocolId="proto-1" />);

    await waitFor(() => {
      expect(screen.getByText("iot.protocolRunner.browserNotSupported")).toBeInTheDocument();
    });
    expect(screen.queryByTestId("iot-runner")).not.toBeInTheDocument();
  });

  it("should show edit trigger for creators in read-only mode", async () => {
    mockSession = { user: { id: "user-1" } };
    vi.mocked(useSession).mockImplementation(() => ({ data: mockSession }) as never);

    render(<ProtocolRunContent protocolId="proto-1" />);

    await waitFor(() => {
      expect(screen.getByTestId("edit-trigger")).toBeInTheDocument();
    });
  });

  it("should not show edit trigger for non-creators", async () => {
    mockSession = { user: { id: "other-user" } };
    vi.mocked(useSession).mockImplementation(() => ({ data: mockSession }) as never);

    render(<ProtocolRunContent protocolId="proto-1" />);

    await waitFor(() => {
      expect(screen.getByTestId("json-viewer")).toBeInTheDocument();
    });
    expect(screen.queryByTestId("edit-trigger")).not.toBeInTheDocument();
  });

  it("should show code editor with header actions after the user clicks Edit", async () => {
    mockSession = { user: { id: "user-1" } };
    vi.mocked(useSession).mockImplementation(() => ({ data: mockSession }) as never);
    const user = userEvent.setup();

    render(<ProtocolRunContent protocolId="proto-1" />);

    await user.click(await screen.findByTestId("edit-trigger"));

    expect(await screen.findByTestId("code-editor")).toBeInTheDocument();
    expect(screen.getByTestId("editor-header-actions")).toBeInTheDocument();
    expect(screen.queryByTestId("json-viewer")).not.toBeInTheDocument();
  });

  it("should not show a separate save button when editing", async () => {
    mockSession = { user: { id: "user-1" } };
    vi.mocked(useSession).mockImplementation(() => ({ data: mockSession }) as never);
    const user = userEvent.setup();

    render(<ProtocolRunContent protocolId="proto-1" />);

    await user.click(await screen.findByTestId("edit-trigger"));

    expect(await screen.findByTestId("code-editor")).toBeInTheDocument();
    expect(screen.queryByText("common.save")).not.toBeInTheDocument();
  });

  it("autosaves the edited protocol code after the debounce window", async () => {
    mockSession = { user: { id: "user-1" } };
    vi.mocked(useSession).mockImplementation(() => ({ data: mockSession }) as never);
    const updateSpy = server.mount(contract.protocols.updateProtocol, { body: mockProtocol });
    const user = userEvent.setup();

    render(<ProtocolRunContent protocolId="proto-1" />);

    await user.click(await screen.findByTestId("edit-trigger"));
    await screen.findByTestId("code-editor");

    expect(capturedOnChange).not.toBeNull();
    capturedOnChange?.([{ averages: 2 }]);

    await waitFor(() => expect(updateSpy.callCount).toBe(1), { timeout: 4000 });
    expect(updateSpy.body).toEqual({ code: [{ averages: 2 }] });
  });
});
