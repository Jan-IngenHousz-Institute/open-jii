import "@testing-library/jest-dom/vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import React from "react";
import { describe, expect, it, vi, beforeEach } from "vitest";

import { IotProtocolTester } from "./iot-protocol-tester";

globalThis.React = React;

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
  Bluetooth: () => <span data-testid="bluetooth-icon">📶</span>,
  Usb: () => <span data-testid="usb-icon">🔌</span>,
  Zap: () => <span data-testid="zap-icon">⚡</span>,
  CheckCircle2: () => <span data-testid="check-circle-icon">✓</span>,
  AlertCircle: () => <span data-testid="alert-circle-icon">⚠️</span>,
  Copy: () => <span data-testid="copy-icon">📋</span>,
  Check: () => <span data-testid="check-icon">✓</span>,
  Battery: () => <span data-testid="battery-icon">🔋</span>,
}));

// Mock the hook
const mockConnect = vi.fn();
const mockDisconnect = vi.fn();
const mockExecuteProtocol = vi.fn();

vi.mock("~/hooks/iot/useIotProtocolConnection", () => ({
  useIotProtocolConnection: vi.fn(() => ({
    isConnected: false,
    isConnecting: false,
    error: null,
    deviceInfo: null,
    connect: mockConnect,
    disconnect: mockDisconnect,
    executeProtocol: mockExecuteProtocol,
  })),
}));

// Import the mock after declaring it
const { useIotProtocolConnection } = await import("~/hooks/iot/useIotProtocolConnection");

describe("IotProtocolTester", () => {
  const defaultProps = {
    protocolCode: [{ command: "test" }],
    sensorFamily: "multispeq" as const,
    protocolName: "Test Protocol",
  };

  beforeEach(() => {
    vi.clearAllMocks();
    // Reset to default mock implementation
    vi.mocked(useIotProtocolConnection).mockReturnValue({
      isConnected: false,
      isConnecting: false,
      error: null,
      deviceInfo: null,
      connect: mockConnect,
      disconnect: mockDisconnect,
      executeProtocol: mockExecuteProtocol,
    });
  });

  describe("initial render", () => {
    it("renders connection type selector when not connected", () => {
      render(<IotProtocolTester {...defaultProps} />);

      expect(screen.getByText("iot.protocolTester.connectionType")).toBeInTheDocument();
      expect(screen.getByText("iot.protocolTester.bluetooth")).toBeInTheDocument();
      expect(screen.getByText("iot.protocolTester.serial")).toBeInTheDocument();
    });

    it("renders device status card", () => {
      render(<IotProtocolTester {...defaultProps} />);

      expect(screen.getByText("iot.protocolTester.device")).toBeInTheDocument();
    });

    it("does not show run protocol button when disconnected", () => {
      render(<IotProtocolTester {...defaultProps} />);

      expect(screen.queryByText("iot.protocolTester.runProtocol")).not.toBeInTheDocument();
    });

    it("renders protocol results display", () => {
      render(<IotProtocolTester {...defaultProps} />);

      expect(screen.getByText("iot.protocolTester.results")).toBeInTheDocument();
    });
  });

  describe("connection type selection", () => {
    it("allows switching connection type when disconnected", () => {
      render(<IotProtocolTester {...defaultProps} />);

      const serialButton = screen.getByRole("button", { name: /serial/i });
      fireEvent.click(serialButton);

      // Connection type selector should still be visible
      expect(screen.getByText("iot.protocolTester.serial")).toBeInTheDocument();
    });

    it("hides connection type selector when connected", () => {
      vi.mocked(useIotProtocolConnection).mockReturnValue({
        isConnected: true,
        isConnecting: false,
        error: null,
        deviceInfo: { device_name: "MultispeQ" },
        connect: mockConnect,
        disconnect: mockDisconnect,
        executeProtocol: mockExecuteProtocol,
      });

      render(<IotProtocolTester {...defaultProps} />);

      expect(screen.queryByText("iot.protocolTester.connectionType")).not.toBeInTheDocument();
    });
  });

  describe("device connection", () => {
    it("calls connect when connect button is clicked", () => {
      render(<IotProtocolTester {...defaultProps} />);

      const connectButton = screen.getByRole("button", { name: /connect/i });
      fireEvent.click(connectButton);

      expect(mockConnect).toHaveBeenCalledTimes(1);
    });

    it("shows run protocol button when connected", () => {
      vi.mocked(useIotProtocolConnection).mockReturnValue({
        isConnected: true,
        isConnecting: false,
        error: null,
        deviceInfo: { device_name: "MultispeQ" },
        connect: mockConnect,
        disconnect: mockDisconnect,
        executeProtocol: mockExecuteProtocol,
      });

      render(<IotProtocolTester {...defaultProps} />);

      expect(screen.getByText("iot.protocolTester.runProtocol")).toBeInTheDocument();
    });

    it("displays device info when connected", () => {
      vi.mocked(useIotProtocolConnection).mockReturnValue({
        isConnected: true,
        isConnecting: false,
        error: null,
        deviceInfo: { device_name: "MultispeQ V2", device_version: "2.0.5" },
        connect: mockConnect,
        disconnect: mockDisconnect,
        executeProtocol: mockExecuteProtocol,
      });

      render(<IotProtocolTester {...defaultProps} />);

      expect(screen.getByText("MultispeQ V2")).toBeInTheDocument();
    });

    it("calls disconnect when disconnect button is clicked", () => {
      vi.mocked(useIotProtocolConnection).mockReturnValue({
        isConnected: true,
        isConnecting: false,
        error: null,
        deviceInfo: { device_name: "MultispeQ" },
        connect: mockConnect,
        disconnect: mockDisconnect,
        executeProtocol: mockExecuteProtocol,
      });

      render(<IotProtocolTester {...defaultProps} />);

      const disconnectButton = screen.getByRole("button", { name: /disconnect/i });
      fireEvent.click(disconnectButton);

      expect(mockDisconnect).toHaveBeenCalledTimes(1);
    });
  });

  describe("protocol execution", () => {
    beforeEach(() => {
      vi.mocked(useIotProtocolConnection).mockReturnValue({
        isConnected: true,
        isConnecting: false,
        error: null,
        deviceInfo: { device_name: "MultispeQ" },
        connect: mockConnect,
        disconnect: mockDisconnect,
        executeProtocol: mockExecuteProtocol,
      });
    });

    it("executes protocol when run button is clicked", async () => {
      mockExecuteProtocol.mockResolvedValueOnce({ temperature: 25.5 });

      render(<IotProtocolTester {...defaultProps} />);

      const runButton = screen.getByRole("button", { name: /runProtocol/i });
      fireEvent.click(runButton);

      await waitFor(() => {
        expect(mockExecuteProtocol).toHaveBeenCalledWith(defaultProps.protocolCode);
      });
    });

    it("shows loading state while protocol is running", async () => {
      mockExecuteProtocol.mockImplementation(
        () => new Promise((resolve) => setTimeout(() => resolve({ test: "data" }), 100)),
      );

      render(<IotProtocolTester {...defaultProps} />);

      const runButton = screen.getByRole("button", { name: /runProtocol/i });
      fireEvent.click(runButton);

      expect(screen.getByText("iot.protocolTester.running")).toBeInTheDocument();
      expect(runButton).toBeDisabled();

      await waitFor(() => {
        expect(screen.getByText("iot.protocolTester.runProtocol")).toBeInTheDocument();
      });
    });

    it("displays success result after protocol execution", async () => {
      mockExecuteProtocol.mockResolvedValueOnce({ temperature: 25.5 });

      render(<IotProtocolTester {...defaultProps} />);

      const runButton = screen.getByRole("button", { name: /runProtocol/i });
      fireEvent.click(runButton);

      await waitFor(() => {
        expect(screen.getByText("iot.protocolTester.success")).toBeInTheDocument();
      });
    });

    it("displays error result when protocol execution fails", async () => {
      mockExecuteProtocol.mockRejectedValueOnce(new Error("Device timeout"));

      render(<IotProtocolTester {...defaultProps} />);

      const runButton = screen.getByRole("button", { name: /runProtocol/i });
      fireEvent.click(runButton);

      await waitFor(() => {
        expect(screen.getByText("Device timeout")).toBeInTheDocument();
      });
    });

    it("clears previous results when running new protocol", async () => {
      mockExecuteProtocol.mockResolvedValueOnce({ test: "first" });

      render(<IotProtocolTester {...defaultProps} />);

      const runButton = screen.getByRole("button", { name: /runProtocol/i });
      fireEvent.click(runButton);

      await waitFor(() => {
        expect(screen.getByText("iot.protocolTester.success")).toBeInTheDocument();
      });

      mockExecuteProtocol.mockResolvedValueOnce({ test: "second" });
      fireEvent.click(runButton);

      // Results should be cleared while running
      expect(screen.queryByText("iot.protocolTester.success")).not.toBeInTheDocument();

      await waitFor(() => {
        expect(screen.getByText("iot.protocolTester.success")).toBeInTheDocument();
      });
    });

    it("does not execute protocol when disconnected", () => {
      vi.mocked(useIotProtocolConnection).mockReturnValue({
        isConnected: false,
        isConnecting: false,
        error: null,
        deviceInfo: null,
        connect: mockConnect,
        disconnect: mockDisconnect,
        executeProtocol: mockExecuteProtocol,
      });

      render(<IotProtocolTester {...defaultProps} />);

      // Run button should not be visible when disconnected
      expect(screen.queryByText("iot.protocolTester.runProtocol")).not.toBeInTheDocument();
    });
  });

  describe("error handling", () => {
    it("displays connection error", () => {
      vi.mocked(useIotProtocolConnection).mockReturnValue({
        isConnected: false,
        isConnecting: false,
        error: "Failed to connect to device",
        deviceInfo: null,
        connect: mockConnect,
        disconnect: mockDisconnect,
        executeProtocol: mockExecuteProtocol,
      });

      render(<IotProtocolTester {...defaultProps} />);

      expect(screen.getByText("Failed to connect to device")).toBeInTheDocument();
    });

    it("shows connecting state", () => {
      vi.mocked(useIotProtocolConnection).mockReturnValue({
        isConnected: false,
        isConnecting: true,
        error: null,
        deviceInfo: null,
        connect: mockConnect,
        disconnect: mockDisconnect,
        executeProtocol: mockExecuteProtocol,
      });

      render(<IotProtocolTester {...defaultProps} />);

      expect(screen.getByText("iot.protocolTester.pairingWithDevice")).toBeInTheDocument();
    });
  });

  describe("browser support", () => {
    it("checks for Web Bluetooth API support", () => {
      const originalBluetooth = navigator.bluetooth;
      Object.defineProperty(navigator, "bluetooth", {
        value: {},
        configurable: true,
      });

      render(<IotProtocolTester {...defaultProps} />);

      // Connection type selector should be rendered (testing browser support check runs)
      expect(screen.getByText("iot.protocolTester.bluetooth")).toBeInTheDocument();

      Object.defineProperty(navigator, "bluetooth", {
        value: originalBluetooth,
        configurable: true,
      });
    });

    it("checks for Web Serial API support", () => {
      const originalSerial = navigator.serial;
      Object.defineProperty(navigator, "serial", {
        value: {},
        configurable: true,
      });

      render(<IotProtocolTester {...defaultProps} />);

      // Connection type selector should be rendered (testing browser support check runs)
      expect(screen.getByText("iot.protocolTester.serial")).toBeInTheDocument();

      Object.defineProperty(navigator, "serial", {
        value: originalSerial,
        configurable: true,
      });
    });
  });
});
