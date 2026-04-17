import { createProtocol } from "@/test/factories";
import { server } from "@/test/msw/server";
import { render, screen, waitFor } from "@/test/test-utils";
import type React from "react";
import { describe, it, expect, vi, beforeEach } from "vitest";

import { contract } from "@repo/api";
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
vi.mock("~/hooks/iot/useIotBrowserSupport", () => ({
  useIotBrowserSupport: () => mockBrowserSupport,
}));

const mockStartEditing = vi.fn();
const mockCloseEditing = vi.fn();
const mockHandleChange = vi.fn();
let mockAutoSave = {
  editedCode: null as unknown,
  syncStatus: "synced" as string,
  startEditing: mockStartEditing,
  closeEditing: mockCloseEditing,
  handleChange: mockHandleChange,
  isEditing: false,
};
vi.mock("../../../hooks/useCodeAutoSave", () => ({
  useCodeAutoSave: () => mockAutoSave,
}));

let mockSession: { user: { id: string } } | null = null;

vi.mock("../../protocol-code-editor", () => ({
  __esModule: true,
  default: ({ headerActions }: { headerActions?: React.ReactNode }) => (
    <div data-testid="code-editor">{headerActions}</div>
  ),
}));

vi.mock("../../json-code-viewer", () => ({
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

vi.mock("../../shared/code-editor-header-actions", () => ({
  CodeEditorHeaderActions: () => <div data-testid="editor-header-actions" />,
}));

vi.mock("../../iot/iot-protocol-runner", () => ({
  IotProtocolRunner: () => <div data-testid="iot-runner" />,
}));

vi.mock("@repo/ui/hooks", async (importOriginal) => {
  const original = await importOriginal<Record<string, unknown>>();
  return {
    ...original,
    useIsMobile: () => false,
    useIsTablet: () => false,
    useIsLgTablet: () => false,
    useBreakpoint: () => ({ isMobile: false, isTablet: false, isLgTablet: false }),
  };
});

vi.mock("@repo/ui/components", async (importOriginal) => {
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
    mockAutoSave = {
      editedCode: null,
      syncStatus: "synced",
      startEditing: mockStartEditing,
      closeEditing: mockCloseEditing,
      handleChange: mockHandleChange,
      isEditing: false,
    };
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

  it("should show code editor with header actions when editing", async () => {
    mockSession = { user: { id: "user-1" } };
    vi.mocked(useSession).mockImplementation(() => ({ data: mockSession }) as never);
    mockAutoSave = { ...mockAutoSave, isEditing: true, editedCode: [{ averages: 1 }] };

    render(<ProtocolRunContent protocolId="proto-1" />);

    await waitFor(() => {
      expect(screen.getByTestId("code-editor")).toBeInTheDocument();
    });
    expect(screen.getByTestId("editor-header-actions")).toBeInTheDocument();
    expect(screen.queryByTestId("json-viewer")).not.toBeInTheDocument();
  });

  it("should not show a separate save button", async () => {
    mockSession = { user: { id: "user-1" } };
    vi.mocked(useSession).mockImplementation(() => ({ data: mockSession }) as never);
    mockAutoSave = { ...mockAutoSave, isEditing: true };

    render(<ProtocolRunContent protocolId="proto-1" />);

    await waitFor(() => {
      expect(screen.getByTestId("code-editor")).toBeInTheDocument();
    });
    expect(screen.queryByText("common.save")).not.toBeInTheDocument();
  });
});
