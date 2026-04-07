import { render, screen, userEvent } from "@/test/test-utils";
import { describe, expect, it, vi, beforeEach } from "vitest";

import { DeviceStatusCard } from "./iot-device-status-card";

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
      expect(screen.getByText("iot.protocolRunner.device")).toBeInTheDocument();
    });

    it("shows 'Not Connected' status when disconnected", () => {
      render(<DeviceStatusCard {...defaultProps} />);
      expect(screen.getByText("iot.protocolRunner.notConnected")).toBeInTheDocument();
    });

    it("shows 'Connecting' status with animated text when connecting", () => {
      render(<DeviceStatusCard {...defaultProps} isConnecting={true} />);
      expect(screen.getAllByText(/iot\.protocolRunner\.connecting/).length).toBeGreaterThanOrEqual(
        1,
      );
    });

    it("shows 'Connected' status when connected", () => {
      render(<DeviceStatusCard {...defaultProps} isConnected={true} />);
      expect(screen.getByText("iot.protocolRunner.connected")).toBeInTheDocument();
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

      expect(screen.getByText("iot.protocolRunner.unknownDevice")).toBeInTheDocument();
    });

    it("displays device version when available", () => {
      const deviceInfo = {
        device_name: "MultispeQ V2",
        device_version: "2.0.5",
      };

      render(<DeviceStatusCard {...defaultProps} isConnected={true} deviceInfo={deviceInfo} />);

      expect(screen.getByText(/iot\.protocolRunner\.version/)).toBeInTheDocument();
    });

    it("displays battery level when available", () => {
      const deviceInfo = {
        device_name: "MultispeQ V2",
        device_battery: 85,
      };

      render(<DeviceStatusCard {...defaultProps} isConnected={true} deviceInfo={deviceInfo} />);

      expect(screen.getByText("85%")).toBeInTheDocument();
    });

    it("displays 0% battery level", () => {
      const deviceInfo = {
        device_name: "MultispeQ V2",
        device_battery: 0,
      };

      render(<DeviceStatusCard {...defaultProps} isConnected={true} deviceInfo={deviceInfo} />);

      expect(screen.getByText("0%")).toBeInTheDocument();
    });

    it("shows connection type label when not connected", () => {
      render(<DeviceStatusCard {...defaultProps} connectionType="bluetooth" />);
      expect(screen.getByText("iot.protocolRunner.wireless")).toBeInTheDocument();
    });

    it("shows USB connection type label when using serial", () => {
      render(<DeviceStatusCard {...defaultProps} connectionType="serial" />);
      expect(screen.getByText("iot.protocolRunner.usb")).toBeInTheDocument();
    });

    it("shows pairing message when connecting", () => {
      render(<DeviceStatusCard {...defaultProps} isConnecting={true} />);
      expect(screen.getByText("iot.protocolRunner.pairingWithDevice")).toBeInTheDocument();
    });
  });

  describe("user interactions", () => {
    it("calls onConnect when connect button is clicked", async () => {
      const user = userEvent.setup();
      render(<DeviceStatusCard {...defaultProps} />);

      const button = screen.getByRole("button", { name: /connect/i });
      await user.click(button);

      expect(mockOnConnect).toHaveBeenCalledTimes(1);
      expect(mockOnDisconnect).not.toHaveBeenCalled();
    });

    it("calls onDisconnect when disconnect button is clicked", async () => {
      const user = userEvent.setup();
      render(<DeviceStatusCard {...defaultProps} isConnected={true} />);

      const button = screen.getByRole("button", { name: /disconnect/i });
      await user.click(button);

      expect(mockOnDisconnect).toHaveBeenCalledTimes(1);
      expect(mockOnConnect).not.toHaveBeenCalled();
    });

    it("disables button when connecting", () => {
      render(<DeviceStatusCard {...defaultProps} isConnecting={true} />);

      const button = screen.getByRole("button");
      expect(button).toBeDisabled();
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
