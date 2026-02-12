import "@testing-library/jest-dom/vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import React from "react";
import { describe, expect, it, vi, beforeEach } from "vitest";

import { DeviceStatusCard } from "./iot-device-status-card";

globalThis.React = React;

// Mock i18n
vi.mock("@repo/i18n", () => ({
  useTranslation: () => ({
    t: (key: string) => key,
  }),
}));

// Mock Lucide icons
vi.mock("lucide-react", () => ({
  Bluetooth: () => <span data-testid="bluetooth-icon">📶</span>,
  Usb: () => <span data-testid="usb-icon">🔌</span>,
  Loader2: () => <span data-testid="loader-icon">⏳</span>,
  Battery: () => <span data-testid="battery-icon">🔋</span>,
  AlertCircle: () => <span data-testid="alert-circle-icon">⚠️</span>,
  Zap: () => <span data-testid="zap-icon">⚡</span>,
  CheckCircle2: () => <span data-testid="check-circle-icon">✓</span>,
}));

describe("DeviceStatusCard", () => {
  const mockOnConnect = vi.fn();
  const mockOnDisconnect = vi.fn();

  const defaultProps = {
    isConnected: false,
    isConnecting: false,
    error: null,
    deviceInfo: null,
    connectionType: "bluetooth" as const,
    onConnect: mockOnConnect,
    onDisconnect: mockOnDisconnect,
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("rendering", () => {
    it("renders the component with title", () => {
      render(<DeviceStatusCard {...defaultProps} />);
      expect(screen.getByText("iot.protocolTester.device")).toBeInTheDocument();
    });

    it("shows 'Not Connected' status when disconnected", () => {
      render(<DeviceStatusCard {...defaultProps} />);
      expect(screen.getByText("iot.protocolTester.notConnected")).toBeInTheDocument();
    });

    it("shows 'Connecting' status with animated text when connecting", () => {
      render(<DeviceStatusCard {...defaultProps} isConnecting={true} />);
      expect(screen.getByText(/iot\.protocolTester\.connecting/)).toBeInTheDocument();
    });

    it("shows 'Connected' status when connected", () => {
      render(<DeviceStatusCard {...defaultProps} isConnected={true} />);
      expect(screen.getByText("iot.protocolTester.connected")).toBeInTheDocument();
    });
  });

  describe("device information", () => {
    it("displays device name when connected", () => {
      const deviceInfo = {
        device_name: "MultispeQ V2",
        device_version: "2.0.5",
        device_battery: 85,
      };

      render(<DeviceStatusCard {...defaultProps} isConnected={true} deviceInfo={deviceInfo} />);

      expect(screen.getByText("MultispeQ V2")).toBeInTheDocument();
    });

    it("displays unknown device when name is not available", () => {
      const deviceInfo = {
        device_version: "2.0.5",
        device_battery: 85,
      };

      render(<DeviceStatusCard {...defaultProps} isConnected={true} deviceInfo={deviceInfo} />);

      expect(screen.getByText("iot.protocolTester.unknownDevice")).toBeInTheDocument();
    });

    it("displays device version when available", () => {
      const deviceInfo = {
        device_name: "MultispeQ V2",
        device_version: "2.0.5",
      };

      render(<DeviceStatusCard {...defaultProps} isConnected={true} deviceInfo={deviceInfo} />);

      expect(screen.getByText(/iot\.protocolTester\.version/)).toBeInTheDocument();
    });

    it("displays battery level when available", () => {
      const deviceInfo = {
        device_name: "MultispeQ V2",
        device_battery: 85,
      };

      render(<DeviceStatusCard {...defaultProps} isConnected={true} deviceInfo={deviceInfo} />);

      expect(screen.getByText("85%")).toBeInTheDocument();
      expect(screen.getByTestId("battery-icon")).toBeInTheDocument();
    });

    it("shows connection type label when not connected", () => {
      render(<DeviceStatusCard {...defaultProps} connectionType="bluetooth" />);
      expect(screen.getByText("iot.protocolTester.wireless")).toBeInTheDocument();
    });

    it("shows pairing message when connecting", () => {
      render(<DeviceStatusCard {...defaultProps} isConnecting={true} />);
      expect(screen.getByText("iot.protocolTester.pairingWithDevice")).toBeInTheDocument();
    });
  });

  describe("user interactions", () => {
    it("calls onConnect when connect button is clicked", () => {
      render(<DeviceStatusCard {...defaultProps} />);

      const button = screen.getByRole("button", { name: /connect/i });
      fireEvent.click(button);

      expect(mockOnConnect).toHaveBeenCalledTimes(1);
      expect(mockOnDisconnect).not.toHaveBeenCalled();
    });

    it("calls onDisconnect when disconnect button is clicked", () => {
      render(<DeviceStatusCard {...defaultProps} isConnected={true} />);

      const button = screen.getByRole("button", { name: /disconnect/i });
      fireEvent.click(button);

      expect(mockOnDisconnect).toHaveBeenCalledTimes(1);
      expect(mockOnConnect).not.toHaveBeenCalled();
    });

    it("disables button when connecting", () => {
      render(<DeviceStatusCard {...defaultProps} isConnecting={true} />);

      const button = screen.getByRole("button");
      expect(button).toBeDisabled();
    });

    it("shows loader icon when connecting", () => {
      render(<DeviceStatusCard {...defaultProps} isConnecting={true} />);
      expect(screen.getByTestId("loader-icon")).toBeInTheDocument();
    });
  });

  describe("error handling", () => {
    it("displays error alert when error is present", () => {
      render(
        <DeviceStatusCard
          {...defaultProps}
          error="Failed to connect to device. Please try again."
        />,
      );

      expect(screen.getByRole("alert")).toBeInTheDocument();
      expect(
        screen.getByText("Failed to connect to device. Please try again."),
      ).toBeInTheDocument();
    });

    it("does not display error alert when no error", () => {
      render(<DeviceStatusCard {...defaultProps} />);
      expect(screen.queryByRole("alert")).not.toBeInTheDocument();
    });

    it("shows alert icon when error is present", () => {
      render(<DeviceStatusCard {...defaultProps} error="Connection error" />);
      expect(screen.getByTestId("alert-circle-icon")).toBeInTheDocument();
    });
  });

  describe("button variants", () => {
    it("shows connect button when disconnected", () => {
      render(<DeviceStatusCard {...defaultProps} />);
      const button = screen.getByRole("button", { name: /connect/i });
      expect(button).toBeInTheDocument();
    });

    it("shows disconnect button when connected", () => {
      render(<DeviceStatusCard {...defaultProps} isConnected={true} />);
      const button = screen.getByRole("button", { name: /disconnect/i });
      expect(button).toBeInTheDocument();
    });
  });
});
