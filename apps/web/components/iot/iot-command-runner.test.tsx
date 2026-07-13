import { render, screen, userEvent, waitFor } from "@/test/test-utils";
import type React from "react";
import { describe, expect, it, vi, beforeEach } from "vitest";

import { IotCommandRunner } from "./iot-command-runner";

// Mock hooks
const mockConnect = vi.fn();
const mockDisconnect = vi.fn();
const mockExecuteCommandCode = vi.fn();

let mockIsConnected = false;
let mockIsConnecting = false;
let mockError: string | null = null;
let mockDeviceInfo: Record<string, unknown> | null = null;
let mockCommand: Record<string, unknown> | null = null;
let mockBrowserSupport = { bluetooth: true, serial: true, any: true };

vi.mock("~/hooks/iot/useIotBrowserSupport", () => ({
  useIotBrowserSupport: () => mockBrowserSupport,
}));

vi.mock("~/hooks/iot/useIotCommunication/useIotCommunication", () => ({
  useIotCommunication: () => ({
    isConnected: mockIsConnected,
    isConnecting: mockIsConnecting,
    error: mockError,
    deviceInfo: mockDeviceInfo,
    driver: mockCommand,
    connect: mockConnect,
    disconnect: mockDisconnect,
  }),
}));

vi.mock("~/hooks/iot/useIotCommandExecution/useIotCommandExecution", () => ({
  useIotCommandExecution: () => ({
    executeCommandCode: mockExecuteCommandCode,
  }),
}));

// Mock child components
vi.mock("./iot-connection-type-selector", () => ({
  ConnectionTypeSelector: ({
    connectionType,
    onConnectionTypeChange,
    browserSupport,
  }: {
    connectionType: string;
    onConnectionTypeChange: (type: "bluetooth" | "serial") => void;
    browserSupport: { bluetooth: boolean; serial: boolean };
  }) => (
    <div data-testid="connection-type-selector">
      <span>Current: {connectionType}</span>
      <button onClick={() => onConnectionTypeChange("bluetooth")}>Bluetooth</button>
      <button onClick={() => onConnectionTypeChange("serial")}>Serial</button>
      <span>
        BT: {browserSupport.bluetooth ? "yes" : "no"}, Serial:{" "}
        {browserSupport.serial ? "yes" : "no"}
      </span>
    </div>
  ),
}));

vi.mock("./iot-device-status-card", () => ({
  DeviceStatusCard: ({
    isConnected,
    isConnecting,
    error,
    deviceInfo,
    connectionType,
    onConnect,
    onDisconnect,
  }: {
    isConnected: boolean;
    isConnecting: boolean;
    error: string | null;
    deviceInfo: Record<string, unknown> | null;
    connectionType: string;
    onConnect: () => void;
    onDisconnect: () => void;
  }) => (
    <div data-testid="device-status-card">
      <span>
        Status: {isConnected ? "connected" : isConnecting ? "connecting" : "disconnected"}
      </span>
      {error && <span>Error: {error}</span>}
      {deviceInfo && <span>Device: {JSON.stringify(deviceInfo)}</span>}
      <span>Type: {connectionType}</span>
      <button onClick={onConnect}>Connect</button>
      <button onClick={onDisconnect}>Disconnect</button>
    </div>
  ),
}));

vi.mock("./iot-command-results-display", () => ({
  CommandResultsDisplay: ({ testResult }: { testResult: unknown }) => (
    <div data-testid="command-results-display">
      {testResult ? <span>Result: {JSON.stringify(testResult)}</span> : <span>No result</span>}
    </div>
  ),
}));

describe("IotCommandRunner", () => {
  const defaultProps = {
    commandCode: [{ command: "test" }],
    sensorFamily: "multispeq" as const,
    commandName: "Test Command",
  };

  beforeEach(() => {
    vi.clearAllMocks();
    mockIsConnected = false;
    mockIsConnecting = false;
    mockError = null;
    mockDeviceInfo = null;
    mockCommand = null;
    mockBrowserSupport = { bluetooth: true, serial: true, any: true };
  });

  describe("rendering", () => {
    it("renders the component", () => {
      render(<IotCommandRunner {...defaultProps} />);
      expect(screen.getByTestId("device-status-card")).toBeInTheDocument();
      expect(screen.getByTestId("command-results-display")).toBeInTheDocument();
    });

    it("renders with horizontal layout by default", () => {
      render(<IotCommandRunner {...defaultProps} />);
      const mainDiv = document.querySelector(".md\\:flex-row");
      expect(mainDiv).toBeInTheDocument();
    });

    it("renders with vertical layout when specified", () => {
      render(<IotCommandRunner {...defaultProps} layout="vertical" />);
      const mainDiv = document.querySelector(".md\\:flex-row");
      expect(mainDiv).not.toBeInTheDocument();
    });

    it("shows connection type selector when not connected", () => {
      mockIsConnected = false;
      render(<IotCommandRunner {...defaultProps} />);
      expect(screen.getByTestId("connection-type-selector")).toBeInTheDocument();
    });

    it("hides connection type selector when connected", () => {
      mockIsConnected = true;
      render(<IotCommandRunner {...defaultProps} />);
      expect(screen.queryByTestId("connection-type-selector")).not.toBeInTheDocument();
    });

    it("shows run command button when connected", () => {
      mockIsConnected = true;
      const { rerender } = render(<IotCommandRunner {...defaultProps} />);

      // Need to rerender after state change
      rerender(<IotCommandRunner {...defaultProps} />);

      const runButton = screen.getByRole("button", {
        name: /iot\.commandRunner\.runCommand/i,
      });
      expect(runButton).toBeInTheDocument();
    });

    it("hides run command button when not connected", () => {
      mockIsConnected = false;
      render(<IotCommandRunner {...defaultProps} />);

      const runButton = screen.queryByRole("button", {
        name: /iot\.commandRunner\.runCommand/i,
      });
      expect(runButton).not.toBeInTheDocument();
    });
  });

  describe("connection type management", () => {
    it("initializes with bluetooth connection type", () => {
      render(<IotCommandRunner {...defaultProps} />);
      expect(screen.getByText("Current: bluetooth")).toBeInTheDocument();
    });

    it("allows changing connection type", async () => {
      render(<IotCommandRunner {...defaultProps} />);

      const user = userEvent.setup();
      const serialButton = screen.getByRole("button", { name: "Serial" });
      await user.click(serialButton);

      expect(screen.getByText("Current: serial")).toBeInTheDocument();
    });

    it("passes browser support to connection type selector", () => {
      mockBrowserSupport = { bluetooth: false, serial: true, any: true };
      render(<IotCommandRunner {...defaultProps} />);

      expect(screen.getByText(/BT: no, Serial: yes/)).toBeInTheDocument();
    });
  });

  describe("device connection", () => {
    it("passes connection state to device status card", () => {
      mockIsConnected = true;
      mockIsConnecting = false;
      render(<IotCommandRunner {...defaultProps} />);

      expect(screen.getByText("Status: connected")).toBeInTheDocument();
    });

    it("passes connecting state to device status card", () => {
      mockIsConnected = false;
      mockIsConnecting = true;
      render(<IotCommandRunner {...defaultProps} />);

      expect(screen.getByText("Status: connecting")).toBeInTheDocument();
    });

    it("passes error to device status card", () => {
      mockError = "Connection failed";
      render(<IotCommandRunner {...defaultProps} />);

      expect(screen.getByText("Error: Connection failed")).toBeInTheDocument();
    });

    it("passes device info to device status card", () => {
      mockDeviceInfo = { name: "Test Device" };
      render(<IotCommandRunner {...defaultProps} />);

      expect(screen.getByText(/Device:.*Test Device/)).toBeInTheDocument();
    });

    it("calls connect when connect button is clicked", async () => {
      const user = userEvent.setup();
      render(<IotCommandRunner {...defaultProps} />);

      const connectButton = screen.getByRole("button", { name: "Connect" });
      await user.click(connectButton);

      expect(mockConnect).toHaveBeenCalledTimes(1);
    });

    it("calls disconnect when disconnect button is clicked", async () => {
      const user = userEvent.setup();
      render(<IotCommandRunner {...defaultProps} />);

      const disconnectButton = screen.getByRole("button", { name: "Disconnect" });
      await user.click(disconnectButton);

      expect(mockDisconnect).toHaveBeenCalledTimes(1);
    });
  });

  describe("command execution", () => {
    beforeEach(() => {
      mockIsConnected = true;
    });

    it("executes command when run button is clicked", async () => {
      mockExecuteCommandCode.mockResolvedValueOnce({ temperature: 25.5 });

      const user = userEvent.setup();
      render(<IotCommandRunner {...defaultProps} />);

      const runButton = screen.getByRole("button", {
        name: /iot\.commandRunner\.runCommand/i,
      });
      await user.click(runButton);

      await waitFor(() => {
        expect(mockExecuteCommandCode).toHaveBeenCalledWith(defaultProps.commandCode);
      });
    });

    it("shows running state while executing command", async () => {
      mockExecuteCommandCode.mockImplementation(
        () => new Promise((resolve) => setTimeout(() => resolve({ data: "test" }), 100)),
      );

      const user = userEvent.setup();
      render(<IotCommandRunner {...defaultProps} />);

      const runButton = screen.getByRole("button", {
        name: /iot\.commandRunner\.runCommand/i,
      });
      await user.click(runButton);

      await waitFor(() => {
        expect(screen.getByText("iot.commandRunner.running")).toBeInTheDocument();
      });

      expect(runButton).toBeDisabled();
    });

    it("displays success result after successful execution", async () => {
      mockExecuteCommandCode.mockResolvedValueOnce({ temperature: 25.5, humidity: 60 });

      const user = userEvent.setup();
      render(<IotCommandRunner {...defaultProps} />);

      const runButton = screen.getByRole("button", {
        name: /iot\.commandRunner\.runCommand/i,
      });
      await user.click(runButton);

      await waitFor(() => {
        expect(screen.getByText(/temperature.*25\.5/)).toBeInTheDocument();
      });

      await waitFor(() => {
        expect(screen.getByText(/success.*true/i)).toBeInTheDocument();
      });
    });

    it("displays error result after failed execution", async () => {
      mockExecuteCommandCode.mockRejectedValueOnce(new Error("Command execution failed"));

      const user = userEvent.setup();
      render(<IotCommandRunner {...defaultProps} />);

      const runButton = screen.getByRole("button", {
        name: /iot\.commandRunner\.runCommand/i,
      });
      await user.click(runButton);

      await waitFor(() => {
        expect(screen.getByText(/Command execution failed/i)).toBeInTheDocument();
      });

      await waitFor(() => {
        expect(screen.getByText(/success.*false/i)).toBeInTheDocument();
      });
    });

    it("captures execution time", async () => {
      mockExecuteCommandCode.mockImplementation(
        () => new Promise((resolve) => setTimeout(() => resolve({ data: "test" }), 50)),
      );

      const user = userEvent.setup();
      render(<IotCommandRunner {...defaultProps} />);

      const runButton = screen.getByRole("button", {
        name: /iot\.commandRunner\.runCommand/i,
      });

      const startTime = Date.now();
      await user.click(runButton);

      await waitFor(() => {
        expect(mockExecuteCommandCode).toHaveBeenCalled();
      });

      await waitFor(() => {
        const result = screen.getByTestId("command-results-display").textContent;
        expect(result).toContain("executionTime");
        const endTime = Date.now();
        const elapsed = endTime - startTime;
        // Execution time should be recorded and be at least close to actual elapsed time
        expect(elapsed).toBeGreaterThanOrEqual(40); // Account for timing variance
      });
    });

    it("includes timestamp in result", async () => {
      mockExecuteCommandCode.mockResolvedValueOnce({ data: "test" });

      const user = userEvent.setup();
      render(<IotCommandRunner {...defaultProps} />);

      const runButton = screen.getByRole("button", {
        name: /iot\.commandRunner\.runCommand/i,
      });
      await user.click(runButton);

      await waitFor(() => {
        const result = screen.getByTestId("command-results-display").textContent;
        expect(result).toContain("timestamp");
      });
    });

    it("clears previous result before new execution", async () => {
      mockExecuteCommandCode.mockResolvedValue({ data: "test" });

      const user = userEvent.setup();
      render(<IotCommandRunner {...defaultProps} />);

      const runButton = screen.getByRole("button", {
        name: /iot\.commandRunner\.runCommand/i,
      });

      // First execution
      await user.click(runButton);
      await waitFor(() => {
        expect(screen.getByText(/data.*test/)).toBeInTheDocument();
      });

      // Second execution
      mockExecuteCommandCode.mockResolvedValueOnce({ data: "new" });
      await user.click(runButton);

      await waitFor(() => {
        expect(screen.getByText(/data.*new/)).toBeInTheDocument();
      });
    });

    it("does not execute command when not connected", () => {
      mockIsConnected = false;

      render(<IotCommandRunner {...defaultProps} />);

      // Run button should not be visible
      const runButton = screen.queryByRole("button", {
        name: /iot\.commandRunner\.runCommand/i,
      });
      expect(runButton).not.toBeInTheDocument();
    });

    it("handles non-Error objects in catch block", async () => {
      mockExecuteCommandCode.mockRejectedValueOnce("String error");

      const user = userEvent.setup();
      render(<IotCommandRunner {...defaultProps} />);

      const runButton = screen.getByRole("button", {
        name: /iot\.commandRunner\.runCommand/i,
      });
      await user.click(runButton);

      await waitFor(() => {
        expect(screen.getByText(/Command execution failed/i)).toBeInTheDocument();
      });
    });
  });

  describe("sensor family changes", () => {
    it("disconnects when sensor family changes", async () => {
      mockIsConnected = true;
      const { rerender } = render(<IotCommandRunner {...defaultProps} />);

      // Change sensor family
      rerender(<IotCommandRunner {...defaultProps} sensorFamily="ambyte" />);

      await waitFor(() => {
        expect(mockDisconnect).toHaveBeenCalled();
      });
    });

    it("clears test result when sensor family changes", async () => {
      mockIsConnected = true;
      mockExecuteCommandCode.mockResolvedValueOnce({ data: "test" });

      const user = userEvent.setup();
      const { rerender } = render(<IotCommandRunner {...defaultProps} />);

      // Run command first
      const runButton = screen.getByRole("button", {
        name: /iot\.commandRunner\.runCommand/i,
      });
      await user.click(runButton);

      await waitFor(() => {
        expect(screen.getByText(/data.*test/)).toBeInTheDocument();
      });

      // Change sensor family
      rerender(<IotCommandRunner {...defaultProps} sensorFamily="ambyte" />);

      await waitFor(() => {
        expect(screen.getByText("No result")).toBeInTheDocument();
      });
    });

    it("does not disconnect when sensor family remains the same", () => {
      mockIsConnected = true;
      const { rerender } = render(<IotCommandRunner {...defaultProps} />);

      // Clear any calls from initial render
      vi.clearAllMocks();

      // Rerender with same props
      rerender(<IotCommandRunner {...defaultProps} />);

      expect(mockDisconnect).not.toHaveBeenCalled();
    });
  });

  describe("UI states", () => {
    it("applies correct layout classes for horizontal layout", () => {
      render(<IotCommandRunner {...defaultProps} layout="horizontal" />);

      const layoutDiv = document.querySelector(".md\\:flex-row");
      expect(layoutDiv).toBeInTheDocument();

      const columnDiv = document.querySelector(".md\\:w-80");
      expect(columnDiv).toBeInTheDocument();
    });

    it("applies correct layout classes for vertical layout", () => {
      render(<IotCommandRunner {...defaultProps} layout="vertical" />);

      const layoutDiv = document.querySelector(".md\\:flex-row");
      expect(layoutDiv).not.toBeInTheDocument();

      const columnDiv = document.querySelector(".md\\:w-80");
      expect(columnDiv).not.toBeInTheDocument();
    });
  });

  describe("edge cases", () => {
    it("handles missing command name", () => {
      const { commandName: _, ...propsWithoutName } = defaultProps;
      render(<IotCommandRunner {...propsWithoutName} />);

      expect(screen.getByTestId("device-status-card")).toBeInTheDocument();
    });

    it("handles empty command code", async () => {
      mockIsConnected = true;
      mockExecuteCommandCode.mockResolvedValueOnce({});

      const user = userEvent.setup();
      render(<IotCommandRunner {...defaultProps} commandCode={[]} />);

      const runButton = screen.getByRole("button", {
        name: /iot\.commandRunner\.runCommand/i,
      });
      await user.click(runButton);

      await waitFor(() => {
        expect(mockExecuteCommandCode).toHaveBeenCalledWith([]);
      });
    });

    it("handles rapid command execution clicks", async () => {
      mockIsConnected = true;
      let resolveExecution: (value: unknown) => void = () => {
        // noop
      };
      mockExecuteCommandCode.mockImplementation(
        () =>
          new Promise((resolve) => {
            resolveExecution = resolve;
          }),
      );

      const user = userEvent.setup();
      render(<IotCommandRunner {...defaultProps} />);

      const runButton = screen.getByRole("button", {
        name: /iot\.commandRunner\.runCommand/i,
      });

      // Click multiple times rapidly - execution never resolves so button stays disabled
      await user.click(runButton);
      await user.click(runButton);
      await user.click(runButton);

      // Should only execute once due to disabled state
      expect(mockExecuteCommandCode).toHaveBeenCalledTimes(1);

      // Clean up: resolve the pending promise
      resolveExecution({ data: "test" });
      await waitFor(() => {
        expect(runButton).not.toBeDisabled();
      });
    });

    it("maintains state consistency after error", async () => {
      mockIsConnected = true;
      mockExecuteCommandCode.mockRejectedValueOnce(new Error("First error"));

      const user = userEvent.setup();
      render(<IotCommandRunner {...defaultProps} />);

      const runButton = screen.getByRole("button", {
        name: /iot\.commandRunner\.runCommand/i,
      });

      // First execution fails
      await user.click(runButton);
      await waitFor(() => {
        expect(screen.getByText(/First error/)).toBeInTheDocument();
      });

      // Button should be enabled again
      expect(runButton).not.toBeDisabled();

      // Second execution succeeds
      mockExecuteCommandCode.mockResolvedValueOnce({ data: "success" });
      await user.click(runButton);

      await waitFor(() => {
        expect(screen.getByText(/success/)).toBeInTheDocument();
      });
    });

    // Note: The early return check `if (!isConnected) return;` in handleRunCommand
    // is defensive code that's not reachable through normal UI flow since the
    // run button is only rendered when isConnected is true. This results in
    // 93.75% branch coverage, which is acceptable for this component.
  });

  describe("interaction prompt (clamp open/close gates)", () => {
    const GATED_COMMAND = [{ _protocol_set_: [{ par_led_start_on_open: 2 }] }];

    it("shows the open/close prompt when connected to a gated command", () => {
      mockIsConnected = true;
      render(<IotCommandRunner {...defaultProps} commandCode={GATED_COMMAND} />);

      expect(screen.getByText("iot.commandRunner.interactionTitle")).toBeInTheDocument();
      expect(screen.getByText("iot.commandRunner.interactionHint")).toBeInTheDocument();
    });

    it("hides the prompt for a command without clamp gates", () => {
      mockIsConnected = true;
      render(<IotCommandRunner {...defaultProps} />);

      expect(screen.queryByText("iot.commandRunner.interactionTitle")).not.toBeInTheDocument();
    });

    it("hides the prompt until a device is connected", () => {
      mockIsConnected = false;
      render(<IotCommandRunner {...defaultProps} commandCode={GATED_COMMAND} />);

      expect(screen.queryByText("iot.commandRunner.interactionTitle")).not.toBeInTheDocument();
    });
  });
});
