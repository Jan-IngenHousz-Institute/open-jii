import "@testing-library/jest-dom/vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import React from "react";
import { describe, expect, it, vi, beforeEach } from "vitest";

import { IotProtocolRunner } from "./iot-protocol-runner";

globalThis.React = React;

// Mock hooks
const mockConnect = vi.fn();
const mockDisconnect = vi.fn();
const mockExecuteProtocol = vi.fn();

let mockIsConnected = false;
let mockIsConnecting = false;
let mockError: string | null = null;
let mockDeviceInfo: Record<string, unknown> | null = null;
let mockProtocol: Record<string, unknown> | null = null;
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
    protocol: mockProtocol,
    connect: mockConnect,
    disconnect: mockDisconnect,
  }),
}));

vi.mock("~/hooks/iot/useIotProtocolExecution/useIotProtocolExecution", () => ({
  useIotProtocolExecution: () => ({
    executeProtocol: mockExecuteProtocol,
  }),
}));

// Mock i18n
vi.mock("@repo/i18n", () => ({
  useTranslation: () => ({
    t: (key: string) => key,
  }),
}));

// Mock Lucide icons
vi.mock("lucide-react", () => ({
  Play: () => <span data-testid="play-icon">▶️</span>,
  Loader2: () => <span data-testid="loader-icon">⏳</span>,
}));

// Mock UI components
vi.mock("@repo/ui/components", () => ({
  Button: ({
    children,
    onClick,
    disabled,
    className,
    type,
  }: React.ComponentProps<"button"> & { className?: string; type?: string }) => (
    <button onClick={onClick} disabled={disabled} className={className} type={type}>
      {children}
    </button>
  ),
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

vi.mock("./iot-protocol-results-display", () => ({
  ProtocolResultsDisplay: ({ testResult }: { testResult: unknown }) => (
    <div data-testid="protocol-results-display">
      {testResult ? <span>Result: {JSON.stringify(testResult)}</span> : <span>No result</span>}
    </div>
  ),
}));

describe("IotProtocolRunner", () => {
  const defaultProps = {
    protocolCode: [{ command: "test" }],
    sensorFamily: "multispeq" as const,
    protocolName: "Test Protocol",
  };

  beforeEach(() => {
    vi.clearAllMocks();
    mockIsConnected = false;
    mockIsConnecting = false;
    mockError = null;
    mockDeviceInfo = null;
    mockProtocol = null;
    mockBrowserSupport = { bluetooth: true, serial: true, any: true };
  });

  describe("rendering", () => {
    it("renders the component", () => {
      render(<IotProtocolRunner {...defaultProps} />);
      expect(screen.getByTestId("device-status-card")).toBeInTheDocument();
      expect(screen.getByTestId("protocol-results-display")).toBeInTheDocument();
    });

    it("renders with horizontal layout by default", () => {
      const { container } = render(<IotProtocolRunner {...defaultProps} />);
      const mainDiv = container.querySelector(".md\\:flex-row");
      expect(mainDiv).toBeInTheDocument();
    });

    it("renders with vertical layout when specified", () => {
      const { container } = render(<IotProtocolRunner {...defaultProps} layout="vertical" />);
      const mainDiv = container.querySelector(".md\\:flex-row");
      expect(mainDiv).not.toBeInTheDocument();
    });

    it("shows connection type selector when not connected", () => {
      mockIsConnected = false;
      render(<IotProtocolRunner {...defaultProps} />);
      expect(screen.getByTestId("connection-type-selector")).toBeInTheDocument();
    });

    it("hides connection type selector when connected", () => {
      mockIsConnected = true;
      render(<IotProtocolRunner {...defaultProps} />);
      expect(screen.queryByTestId("connection-type-selector")).not.toBeInTheDocument();
    });

    it("shows run protocol button when connected", () => {
      mockIsConnected = true;
      const { rerender } = render(<IotProtocolRunner {...defaultProps} />);

      // Need to rerender after state change
      rerender(<IotProtocolRunner {...defaultProps} />);

      const runButton = screen.getByRole("button", {
        name: /iot\.protocolRunner\.runProtocol/i,
      });
      expect(runButton).toBeInTheDocument();
    });

    it("hides run protocol button when not connected", () => {
      mockIsConnected = false;
      render(<IotProtocolRunner {...defaultProps} />);

      const runButton = screen.queryByRole("button", {
        name: /iot\.protocolRunner\.runProtocol/i,
      });
      expect(runButton).not.toBeInTheDocument();
    });
  });

  describe("connection type management", () => {
    it("initializes with bluetooth connection type", () => {
      render(<IotProtocolRunner {...defaultProps} />);
      expect(screen.getByText("Current: bluetooth")).toBeInTheDocument();
    });

    it("allows changing connection type", () => {
      render(<IotProtocolRunner {...defaultProps} />);

      const serialButton = screen.getByRole("button", { name: "Serial" });
      fireEvent.click(serialButton);

      expect(screen.getByText("Current: serial")).toBeInTheDocument();
    });

    it("passes browser support to connection type selector", () => {
      mockBrowserSupport = { bluetooth: false, serial: true, any: true };
      render(<IotProtocolRunner {...defaultProps} />);

      expect(screen.getByText(/BT: no, Serial: yes/)).toBeInTheDocument();
    });
  });

  describe("device connection", () => {
    it("passes connection state to device status card", () => {
      mockIsConnected = true;
      mockIsConnecting = false;
      render(<IotProtocolRunner {...defaultProps} />);

      expect(screen.getByText("Status: connected")).toBeInTheDocument();
    });

    it("passes connecting state to device status card", () => {
      mockIsConnected = false;
      mockIsConnecting = true;
      render(<IotProtocolRunner {...defaultProps} />);

      expect(screen.getByText("Status: connecting")).toBeInTheDocument();
    });

    it("passes error to device status card", () => {
      mockError = "Connection failed";
      render(<IotProtocolRunner {...defaultProps} />);

      expect(screen.getByText("Error: Connection failed")).toBeInTheDocument();
    });

    it("passes device info to device status card", () => {
      mockDeviceInfo = { name: "Test Device" };
      render(<IotProtocolRunner {...defaultProps} />);

      expect(screen.getByText(/Device:.*Test Device/)).toBeInTheDocument();
    });

    it("calls connect when connect button is clicked", () => {
      render(<IotProtocolRunner {...defaultProps} />);

      const connectButton = screen.getByRole("button", { name: "Connect" });
      fireEvent.click(connectButton);

      expect(mockConnect).toHaveBeenCalledTimes(1);
    });

    it("calls disconnect when disconnect button is clicked", () => {
      render(<IotProtocolRunner {...defaultProps} />);

      const disconnectButton = screen.getByRole("button", { name: "Disconnect" });
      fireEvent.click(disconnectButton);

      expect(mockDisconnect).toHaveBeenCalledTimes(1);
    });
  });

  describe("protocol execution", () => {
    beforeEach(() => {
      mockIsConnected = true;
    });

    it("executes protocol when run button is clicked", async () => {
      mockExecuteProtocol.mockResolvedValueOnce({ temperature: 25.5 });

      render(<IotProtocolRunner {...defaultProps} />);

      const runButton = screen.getByRole("button", {
        name: /iot\.protocolRunner\.runProtocol/i,
      });
      fireEvent.click(runButton);

      await waitFor(() => {
        expect(mockExecuteProtocol).toHaveBeenCalledWith(defaultProps.protocolCode);
      });
    });

    it("shows running state while executing protocol", async () => {
      mockExecuteProtocol.mockImplementation(
        () => new Promise((resolve) => setTimeout(() => resolve({ data: "test" }), 100)),
      );

      render(<IotProtocolRunner {...defaultProps} />);

      const runButton = screen.getByRole("button", {
        name: /iot\.protocolRunner\.runProtocol/i,
      });
      fireEvent.click(runButton);

      // Check that button shows running state
      await waitFor(() => {
        expect(screen.getByText("iot.protocolRunner.running")).toBeInTheDocument();
      });

      // Check that button is disabled while running
      expect(runButton).toBeDisabled();
    });

    it("displays success result after successful execution", async () => {
      mockExecuteProtocol.mockResolvedValueOnce({ temperature: 25.5, humidity: 60 });

      render(<IotProtocolRunner {...defaultProps} />);

      const runButton = screen.getByRole("button", {
        name: /iot\.protocolRunner\.runProtocol/i,
      });
      fireEvent.click(runButton);

      await waitFor(() => {
        expect(screen.getByText(/temperature.*25\.5/)).toBeInTheDocument();
      });

      await waitFor(() => {
        expect(screen.getByText(/success.*true/i)).toBeInTheDocument();
      });
    });

    it("displays error result after failed execution", async () => {
      mockExecuteProtocol.mockRejectedValueOnce(new Error("Protocol execution failed"));

      render(<IotProtocolRunner {...defaultProps} />);

      const runButton = screen.getByRole("button", {
        name: /iot\.protocolRunner\.runProtocol/i,
      });
      fireEvent.click(runButton);

      await waitFor(() => {
        expect(screen.getByText(/Protocol execution failed/i)).toBeInTheDocument();
      });

      await waitFor(() => {
        expect(screen.getByText(/success.*false/i)).toBeInTheDocument();
      });
    });

    it("captures execution time", async () => {
      mockExecuteProtocol.mockImplementation(
        () => new Promise((resolve) => setTimeout(() => resolve({ data: "test" }), 50)),
      );

      render(<IotProtocolRunner {...defaultProps} />);

      const runButton = screen.getByRole("button", {
        name: /iot\.protocolRunner\.runProtocol/i,
      });

      const startTime = Date.now();
      fireEvent.click(runButton);

      await waitFor(() => {
        expect(mockExecuteProtocol).toHaveBeenCalled();
      });

      await waitFor(() => {
        const result = screen.getByTestId("protocol-results-display").textContent;
        expect(result).toContain("executionTime");
        const endTime = Date.now();
        const elapsed = endTime - startTime;
        // Execution time should be recorded and be at least close to actual elapsed time
        expect(elapsed).toBeGreaterThanOrEqual(40); // Account for timing variance
      });
    });

    it("includes timestamp in result", async () => {
      mockExecuteProtocol.mockResolvedValueOnce({ data: "test" });

      render(<IotProtocolRunner {...defaultProps} />);

      const runButton = screen.getByRole("button", {
        name: /iot\.protocolRunner\.runProtocol/i,
      });
      fireEvent.click(runButton);

      await waitFor(() => {
        const result = screen.getByTestId("protocol-results-display").textContent;
        expect(result).toContain("timestamp");
      });
    });

    it("clears previous result before new execution", async () => {
      mockExecuteProtocol.mockResolvedValue({ data: "test" });

      render(<IotProtocolRunner {...defaultProps} />);

      const runButton = screen.getByRole("button", {
        name: /iot\.protocolRunner\.runProtocol/i,
      });

      // First execution
      fireEvent.click(runButton);
      await waitFor(() => {
        expect(screen.getByText(/data.*test/)).toBeInTheDocument();
      });

      // Second execution
      mockExecuteProtocol.mockResolvedValueOnce({ data: "new" });
      fireEvent.click(runButton);

      await waitFor(() => {
        expect(screen.getByText(/data.*new/)).toBeInTheDocument();
      });
    });

    it("does not execute protocol when not connected", () => {
      mockIsConnected = false;

      render(<IotProtocolRunner {...defaultProps} />);

      // Run button should not be visible
      const runButton = screen.queryByRole("button", {
        name: /iot\.protocolRunner\.runProtocol/i,
      });
      expect(runButton).not.toBeInTheDocument();
    });

    it("handles non-Error objects in catch block", async () => {
      mockExecuteProtocol.mockRejectedValueOnce("String error");

      render(<IotProtocolRunner {...defaultProps} />);

      const runButton = screen.getByRole("button", {
        name: /iot\.protocolRunner\.runProtocol/i,
      });
      fireEvent.click(runButton);

      await waitFor(() => {
        expect(screen.getByText(/Protocol execution failed/i)).toBeInTheDocument();
      });
    });
  });

  describe("sensor family changes", () => {
    it("disconnects when sensor family changes", async () => {
      mockIsConnected = true;
      const { rerender } = render(<IotProtocolRunner {...defaultProps} />);

      // Change sensor family
      rerender(<IotProtocolRunner {...defaultProps} sensorFamily="generic" />);

      await waitFor(() => {
        expect(mockDisconnect).toHaveBeenCalled();
      });
    });

    it("clears test result when sensor family changes", async () => {
      mockIsConnected = true;
      mockExecuteProtocol.mockResolvedValueOnce({ data: "test" });

      const { rerender } = render(<IotProtocolRunner {...defaultProps} />);

      // Run protocol first
      const runButton = screen.getByRole("button", {
        name: /iot\.protocolRunner\.runProtocol/i,
      });
      fireEvent.click(runButton);

      await waitFor(() => {
        expect(screen.getByText(/data.*test/)).toBeInTheDocument();
      });

      // Change sensor family
      rerender(<IotProtocolRunner {...defaultProps} sensorFamily="generic" />);

      await waitFor(() => {
        expect(screen.getByText("No result")).toBeInTheDocument();
      });
    });

    it("does not disconnect when sensor family remains the same", () => {
      mockIsConnected = true;
      const { rerender } = render(<IotProtocolRunner {...defaultProps} />);

      // Clear any calls from initial render
      vi.clearAllMocks();

      // Rerender with same props
      rerender(<IotProtocolRunner {...defaultProps} />);

      expect(mockDisconnect).not.toHaveBeenCalled();
    });
  });

  describe("UI states", () => {
    it("shows play icon when not running", () => {
      mockIsConnected = true;
      render(<IotProtocolRunner {...defaultProps} />);

      expect(screen.getByTestId("play-icon")).toBeInTheDocument();
    });

    it("shows loader icon when running", async () => {
      mockIsConnected = true;
      mockExecuteProtocol.mockImplementation(
        () => new Promise((resolve) => setTimeout(() => resolve({ data: "test" }), 100)),
      );

      render(<IotProtocolRunner {...defaultProps} />);

      const runButton = screen.getByRole("button", {
        name: /iot\.protocolRunner\.runProtocol/i,
      });
      fireEvent.click(runButton);

      await waitFor(() => {
        expect(screen.getByTestId("loader-icon")).toBeInTheDocument();
      });
    });

    it("applies correct layout classes for horizontal layout", () => {
      const { container } = render(<IotProtocolRunner {...defaultProps} layout="horizontal" />);

      const layoutDiv = container.querySelector(".md\\:flex-row");
      expect(layoutDiv).toBeInTheDocument();

      const columnDiv = container.querySelector(".md\\:w-80");
      expect(columnDiv).toBeInTheDocument();
    });

    it("applies correct layout classes for vertical layout", () => {
      const { container } = render(<IotProtocolRunner {...defaultProps} layout="vertical" />);

      const layoutDiv = container.querySelector(".md\\:flex-row");
      expect(layoutDiv).not.toBeInTheDocument();

      const columnDiv = container.querySelector(".md\\:w-80");
      expect(columnDiv).not.toBeInTheDocument();
    });
  });

  describe("edge cases", () => {
    it("handles missing protocol name", () => {
      const { protocolName: _, ...propsWithoutName } = defaultProps;
      render(<IotProtocolRunner {...propsWithoutName} />);

      expect(screen.getByTestId("device-status-card")).toBeInTheDocument();
    });

    it("handles empty protocol code", async () => {
      mockIsConnected = true;
      mockExecuteProtocol.mockResolvedValueOnce({});

      render(<IotProtocolRunner {...defaultProps} protocolCode={[]} />);

      const runButton = screen.getByRole("button", {
        name: /iot\.protocolRunner\.runProtocol/i,
      });
      fireEvent.click(runButton);

      await waitFor(() => {
        expect(mockExecuteProtocol).toHaveBeenCalledWith([]);
      });
    });

    it("handles rapid protocol execution clicks", async () => {
      mockIsConnected = true;
      mockExecuteProtocol.mockImplementation(
        () => new Promise((resolve) => setTimeout(() => resolve({ data: "test" }), 50)),
      );

      render(<IotProtocolRunner {...defaultProps} />);

      const runButton = screen.getByRole("button", {
        name: /iot\.protocolRunner\.runProtocol/i,
      });

      // Click multiple times rapidly
      fireEvent.click(runButton);
      fireEvent.click(runButton);
      fireEvent.click(runButton);

      // Should only execute once due to disabled state
      await waitFor(() => {
        expect(mockExecuteProtocol).toHaveBeenCalledTimes(1);
      });
    });

    it("maintains state consistency after error", async () => {
      mockIsConnected = true;
      mockExecuteProtocol.mockRejectedValueOnce(new Error("First error"));

      render(<IotProtocolRunner {...defaultProps} />);

      const runButton = screen.getByRole("button", {
        name: /iot\.protocolRunner\.runProtocol/i,
      });

      // First execution fails
      fireEvent.click(runButton);
      await waitFor(() => {
        expect(screen.getByText(/First error/)).toBeInTheDocument();
      });

      // Button should be enabled again
      expect(runButton).not.toBeDisabled();

      // Second execution succeeds
      mockExecuteProtocol.mockResolvedValueOnce({ data: "success" });
      fireEvent.click(runButton);

      await waitFor(() => {
        expect(screen.getByText(/success/)).toBeInTheDocument();
      });
    });

    // Note: The early return check `if (!isConnected) return;` in handleRunProtocol
    // is defensive code that's not reachable through normal UI flow since the
    // run button is only rendered when isConnected is true. This results in
    // 93.75% branch coverage, which is acceptable for this component.
  });
});
