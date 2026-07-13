import { createCommand } from "@/test/factories";
import { server } from "@/test/msw/server";
import { render, screen, userEvent, waitFor } from "@/test/test-utils";
import type React from "react";
import { describe, it, expect, vi, beforeEach } from "vitest";

import { contract } from "@repo/api/contract";
import { useSession } from "@repo/auth/client";

import { CommandRunContent } from "../command-run-content";

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

let mockSession: { user: { id: string } } | null = null;

// Captured to drive the autosave path without the real CodeMirror pipeline.
let capturedOnChange: ((value: Record<string, unknown>[] | string | undefined) => void) | null =
  null;
vi.mock("../../command-code-editor", () => ({
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

vi.mock("../../iot/iot-command-runner", () => ({
  IotCommandRunner: () => <div data-testid="iot-runner" />,
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

describe("<CommandRunContent />", () => {
  const mockCommand = createCommand({
    id: "proto-1",
    name: "Test Command",
    code: [{ averages: 1 }],
    family: "multispeq",
    createdBy: "user-1",
  });

  beforeEach(() => {
    vi.clearAllMocks();
    capturedOnChange = null;
    server.mount(contract.commands.getCommand, { body: mockCommand });
    server.mount(contract.commands.updateCommand, { body: mockCommand });
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
    server.mount(contract.commands.getCommand, { delay: 999_999 });

    render(<CommandRunContent commandId="proto-1" />);

    expect(screen.getByText("common.loading")).toBeInTheDocument();
  });

  it("should show not found when no data", async () => {
    server.mount(contract.commands.getCommand, { status: 404 });

    render(<CommandRunContent commandId="proto-1" />);

    await waitFor(() => {
      expect(screen.getByText("commands.notFound")).toBeInTheDocument();
    });
  });

  it("should render read-only json viewer and IoT runner by default", async () => {
    render(<CommandRunContent commandId="proto-1" />);

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

    render(<CommandRunContent commandId="proto-1" />);

    await waitFor(() => {
      expect(screen.getByText("iot.commandRunner.browserNotSupported")).toBeInTheDocument();
    });
    expect(screen.queryByTestId("iot-runner")).not.toBeInTheDocument();
  });

  it("should show edit trigger for creators in read-only mode", async () => {
    mockSession = { user: { id: "user-1" } };
    vi.mocked(useSession).mockImplementation(() => ({ data: mockSession }) as never);

    render(<CommandRunContent commandId="proto-1" />);

    await waitFor(() => {
      expect(screen.getByTestId("edit-trigger")).toBeInTheDocument();
    });
  });

  it("should not show edit trigger for non-creators", async () => {
    mockSession = { user: { id: "other-user" } };
    vi.mocked(useSession).mockImplementation(() => ({ data: mockSession }) as never);

    render(<CommandRunContent commandId="proto-1" />);

    await waitFor(() => {
      expect(screen.getByTestId("json-viewer")).toBeInTheDocument();
    });
    expect(screen.queryByTestId("edit-trigger")).not.toBeInTheDocument();
  });

  it("should show code editor with header actions after the user clicks Edit", async () => {
    mockSession = { user: { id: "user-1" } };
    vi.mocked(useSession).mockImplementation(() => ({ data: mockSession }) as never);
    const user = userEvent.setup();

    render(<CommandRunContent commandId="proto-1" />);

    await user.click(await screen.findByTestId("edit-trigger"));

    expect(await screen.findByTestId("code-editor")).toBeInTheDocument();
    expect(screen.getByTestId("editor-header-actions")).toBeInTheDocument();
    expect(screen.queryByTestId("json-viewer")).not.toBeInTheDocument();
  });

  it("should not show a separate save button when editing", async () => {
    mockSession = { user: { id: "user-1" } };
    vi.mocked(useSession).mockImplementation(() => ({ data: mockSession }) as never);
    const user = userEvent.setup();

    render(<CommandRunContent commandId="proto-1" />);

    await user.click(await screen.findByTestId("edit-trigger"));

    expect(await screen.findByTestId("code-editor")).toBeInTheDocument();
    expect(screen.queryByText("common.save")).not.toBeInTheDocument();
  });

  it("autosaves the edited command code after the debounce window", async () => {
    mockSession = { user: { id: "user-1" } };
    vi.mocked(useSession).mockImplementation(() => ({ data: mockSession }) as never);
    const updateSpy = server.mount(contract.commands.updateCommand, { body: mockCommand });
    const user = userEvent.setup();

    render(<CommandRunContent commandId="proto-1" />);

    await user.click(await screen.findByTestId("edit-trigger"));
    await screen.findByTestId("code-editor");

    expect(capturedOnChange).not.toBeNull();
    capturedOnChange?.([{ averages: 2 }]);

    await waitFor(() => expect(updateSpy.callCount).toBe(1), { timeout: 4000 });
    expect(updateSpy.body).toEqual({ code: [{ averages: 2 }] });
  });
});
