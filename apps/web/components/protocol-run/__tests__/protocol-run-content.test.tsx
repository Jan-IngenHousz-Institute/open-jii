import "@testing-library/jest-dom/vitest";
import { render, screen } from "@testing-library/react";
import React from "react";
import { describe, it, expect, vi, beforeEach } from "vitest";

import { ProtocolRunContent } from "../protocol-run-content";

globalThis.React = React;

// --------------------
// Mocks
// --------------------

vi.mock("@repo/i18n", () => ({
  useTranslation: (ns?: string) => ({
    t: (k: string) => k,
    ...(ns === "iot" ? {} : {}),
  }),
}));

vi.mock("@repo/ui/lib/utils", () => ({
  cn: (...args: unknown[]) => args.filter(Boolean).join(" "),
}));

interface MockProtocolReturn {
  data: { body: Record<string, unknown> } | undefined;
  isLoading: boolean;
}

const mockUseProtocol = vi.fn<() => MockProtocolReturn>();
vi.mock("../../../hooks/protocol/useProtocol/useProtocol", () => ({
  useProtocol: () => mockUseProtocol(),
}));

const mockSaveProtocol = vi.fn();
vi.mock("../../../hooks/protocol/useProtocolUpdate/useProtocolUpdate", () => ({
  useProtocolUpdate: () => ({ mutate: mockSaveProtocol }),
}));

let mockBrowserSupport = { bluetooth: true, serial: true, any: true };
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
vi.mock("@repo/auth/client", () => ({
  useSession: () => ({ data: mockSession }),
}));

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

vi.mock("lucide-react", () => ({
  MonitorX: () => <span data-testid="monitor-x" />,
}));

vi.mock("@repo/ui/hooks", () => ({
  useIsMobile: () => false,
  useIsTablet: () => false,
  useIsLgTablet: () => false,
  useBreakpoint: () => ({ isMobile: false, isTablet: false, isLgTablet: false }),
}));

vi.mock("@repo/ui/components", () => ({
  ResizablePanelGroup: ({ children }: { children: React.ReactNode }) => (
    <div data-testid="panel-group">{children}</div>
  ),
  ResizablePanel: ({ children }: { children: React.ReactNode }) => (
    <div data-testid="panel">{children}</div>
  ),
  ResizableHandle: () => <div data-testid="panel-handle" />,
}));

// --------------------
// Tests
// --------------------
describe("<ProtocolRunContent />", () => {
  const mockProtocol = {
    id: "proto-1",
    name: "Test Protocol",
    code: [{ averages: 1 }],
    family: "multispeq",
    createdBy: "user-1",
  };

  beforeEach(() => {
    vi.clearAllMocks();
    mockBrowserSupport = { bluetooth: true, serial: true, any: true };
    mockSession = null;
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
    mockUseProtocol.mockReturnValue({ data: undefined, isLoading: true });

    render(<ProtocolRunContent protocolId="proto-1" />);

    expect(screen.getByText("common.loading")).toBeInTheDocument();
  });

  it("should show not found when no data", () => {
    mockUseProtocol.mockReturnValue({ data: undefined, isLoading: false });

    render(<ProtocolRunContent protocolId="proto-1" />);

    expect(screen.getByText("protocols.notFound")).toBeInTheDocument();
  });

  it("should render read-only json viewer and IoT runner by default", () => {
    mockUseProtocol.mockReturnValue({
      data: { body: mockProtocol },
      isLoading: false,
    });

    render(<ProtocolRunContent protocolId="proto-1" />);

    expect(screen.getByTestId("json-viewer")).toBeInTheDocument();
    expect(screen.queryByTestId("code-editor")).not.toBeInTheDocument();
    expect(screen.getByTestId("iot-runner")).toBeInTheDocument();
  });

  it("should show browser not supported message when no support", () => {
    mockBrowserSupport = { bluetooth: false, serial: false, any: false };
    mockUseProtocol.mockReturnValue({
      data: { body: mockProtocol },
      isLoading: false,
    });

    render(<ProtocolRunContent protocolId="proto-1" />);

    expect(screen.getByText("iot.protocolRunner.browserNotSupported")).toBeInTheDocument();
    expect(screen.queryByTestId("iot-runner")).not.toBeInTheDocument();
  });

  it("should show edit trigger for creators in read-only mode", () => {
    mockSession = { user: { id: "user-1" } };
    mockUseProtocol.mockReturnValue({
      data: { body: mockProtocol },
      isLoading: false,
    });

    render(<ProtocolRunContent protocolId="proto-1" />);

    expect(screen.getByTestId("edit-trigger")).toBeInTheDocument();
  });

  it("should not show edit trigger for non-creators", () => {
    mockSession = { user: { id: "other-user" } };
    mockUseProtocol.mockReturnValue({
      data: { body: mockProtocol },
      isLoading: false,
    });

    render(<ProtocolRunContent protocolId="proto-1" />);

    expect(screen.queryByTestId("edit-trigger")).not.toBeInTheDocument();
  });

  it("should show code editor with header actions when editing", () => {
    mockSession = { user: { id: "user-1" } };
    mockAutoSave = { ...mockAutoSave, isEditing: true, editedCode: [{ averages: 1 }] };
    mockUseProtocol.mockReturnValue({
      data: { body: mockProtocol },
      isLoading: false,
    });

    render(<ProtocolRunContent protocolId="proto-1" />);

    expect(screen.getByTestId("code-editor")).toBeInTheDocument();
    expect(screen.getByTestId("editor-header-actions")).toBeInTheDocument();
    expect(screen.queryByTestId("json-viewer")).not.toBeInTheDocument();
  });

  it("should not show a separate save button", () => {
    mockSession = { user: { id: "user-1" } };
    mockAutoSave = { ...mockAutoSave, isEditing: true };
    mockUseProtocol.mockReturnValue({
      data: { body: mockProtocol },
      isLoading: false,
    });

    render(<ProtocolRunContent protocolId="proto-1" />);

    expect(screen.queryByText("common.save")).not.toBeInTheDocument();
  });
});
