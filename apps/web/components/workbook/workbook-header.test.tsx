import { createMarkdownCell, createMacroCell, createProtocolCell } from "@/test/factories";
import { render, screen, userEvent } from "@/test/test-utils";
import { describe, it, expect, vi } from "vitest";

import { WorkbookSaveProvider } from "../workbook-overview/workbook-save-context";
import { WorkbookHeader } from "./workbook-header";

const protocolCell = createProtocolCell({
  id: "p1",
  payload: { protocolId: "proto-1", version: 1, name: "Test Protocol" },
});
const macroCell = createMacroCell({
  id: "m1",
  payload: { macroId: "macro-1", language: "python", name: "Test Macro" },
});
const markdownCell = createMarkdownCell({ id: "md1", content: "# Hello" });

function renderHeader(overrides: Partial<Parameters<typeof WorkbookHeader>[0]> = {}) {
  const defaultProps = {
    title: "Test Workbook",
    cells: [markdownCell, protocolCell, macroCell],
    isConnected: false,
    isConnecting: false,
    connectionError: null,
    deviceInfo: null,
    sensorFamily: "multispeq" as const,
    onSensorFamilyChange: vi.fn(),
    connectionType: "serial" as const,
    onConnectionTypeChange: vi.fn(),
    onConnect: vi.fn(),
    onDisconnect: vi.fn(),
    isRunningAll: false,
    onRunAll: vi.fn(),
    onStopExecution: vi.fn(),
    onClearOutputs: vi.fn(),
    onToggleFlowchart: vi.fn(),
    ...overrides,
  };

  return {
    ...render(
      <WorkbookSaveProvider>
        <WorkbookHeader {...defaultProps} />
      </WorkbookSaveProvider>,
    ),
    props: defaultProps,
  };
}

describe("WorkbookHeader", () => {
  it("calls onConnect when user clicks the Connect button", async () => {
    const user = userEvent.setup();
    const { props } = renderHeader();

    const connectButton = screen.getByRole("button", { name: /connect/i });
    await user.click(connectButton);

    expect(props.onConnect).toHaveBeenCalledOnce();
  });

  it("calls onDisconnect when connected and user clicks Disconnect", async () => {
    const user = userEvent.setup();
    const { props } = renderHeader({
      isConnected: true,
      deviceInfo: { device_name: "MultispeQ v2" },
    });

    const disconnectButton = screen.getByRole("button", { name: /disconnect/i });
    await user.click(disconnectButton);

    expect(props.onDisconnect).toHaveBeenCalledOnce();
  });

  it("shows 'Disconnected' status when not connected", () => {
    renderHeader();
    expect(screen.getByText("Disconnected")).toBeInTheDocument();
  });

  it("shows device name when connected", () => {
    renderHeader({
      isConnected: true,
      deviceInfo: { device_name: "MultispeQ v2" },
    });
    expect(screen.getByText("MultispeQ v2")).toBeInTheDocument();
  });

  it("shows 'Connecting...' while connecting", () => {
    renderHeader({ isConnecting: true });
    expect(screen.getByText("Connecting...")).toBeInTheDocument();
  });

  it("calls onRunAll when user clicks Run all", async () => {
    const user = userEvent.setup();
    const { props } = renderHeader();

    const runAllButton = screen.getByRole("button", { name: /run all/i });
    await user.click(runAllButton);

    expect(props.onRunAll).toHaveBeenCalledOnce();
  });

  it("disables Run all when there are no cells", () => {
    renderHeader({ cells: [] });

    const runAllButton = screen.getByRole("button", { name: /run all/i });
    expect(runAllButton).toBeDisabled();
  });

  it("shows Stop button instead of Run all when running", async () => {
    const user = userEvent.setup();
    const { props } = renderHeader({ isRunningAll: true });

    expect(screen.queryByRole("button", { name: /run all/i })).not.toBeInTheDocument();
    const stopButton = screen.getByRole("button", { name: /stop/i });
    await user.click(stopButton);

    expect(props.onStopExecution).toHaveBeenCalledOnce();
  });

  it("calls onClearOutputs when user clicks Clear all", async () => {
    const user = userEvent.setup();
    const { props } = renderHeader();

    const clearButton = screen.getByRole("button", { name: /clear all/i });
    await user.click(clearButton);

    expect(props.onClearOutputs).toHaveBeenCalledOnce();
  });

  it("calls onToggleFlowchart when user clicks Flow button", async () => {
    const user = userEvent.setup();
    const { props } = renderHeader();

    const flowButton = screen.getByRole("button", { name: /flow/i });
    await user.click(flowButton);

    expect(props.onToggleFlowchart).toHaveBeenCalledOnce();
  });

  it("shows firmware version when connected with device info", () => {
    renderHeader({
      isConnected: true,
      deviceInfo: { device_name: "Device", device_version: "3.0.1" },
    });
    expect(screen.getByText("FW 3.0.1")).toBeInTheDocument();
  });

  it("displays connection error when present", () => {
    renderHeader({ connectionError: "USB not found" });
    expect(screen.getByText("USB not found")).toBeInTheDocument();
  });
});
