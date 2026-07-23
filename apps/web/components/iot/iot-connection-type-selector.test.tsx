import { render, screen, userEvent } from "@/test/test-utils";
import { describe, expect, it, vi, beforeEach } from "vitest";

import { ConnectionTypeSelector } from "./iot-connection-type-selector";

describe("ConnectionTypeSelector", () => {
  const mockOnConnectionTypeChange = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("rendering", () => {
    it("renders the component with title", () => {
      render(
        <ConnectionTypeSelector
          connectionType="bluetooth"
          onConnectionTypeChange={mockOnConnectionTypeChange}
          browserSupport={{
            bluetooth: true,
            serial: true,
            bluetoothReason: null,
            serialReason: null,
          }}
        />,
      );

      expect(screen.getByText("iot.protocolRunner.connectionType")).toBeInTheDocument();
    });

    it("renders bluetooth and serial buttons", () => {
      render(
        <ConnectionTypeSelector
          connectionType="bluetooth"
          onConnectionTypeChange={mockOnConnectionTypeChange}
          browserSupport={{
            bluetooth: true,
            serial: true,
            bluetoothReason: null,
            serialReason: null,
          }}
        />,
      );

      expect(screen.getByText("iot.protocolRunner.bluetooth")).toBeInTheDocument();
      expect(screen.getByText("iot.protocolRunner.serial")).toBeInTheDocument();
    });
  });

  describe("user interactions", () => {
    it("calls onConnectionTypeChange when bluetooth button is clicked", async () => {
      const user = userEvent.setup();
      render(
        <ConnectionTypeSelector
          connectionType="serial"
          onConnectionTypeChange={mockOnConnectionTypeChange}
          browserSupport={{
            bluetooth: true,
            serial: true,
            bluetoothReason: null,
            serialReason: null,
          }}
        />,
      );

      const buttons = screen.getAllByRole("button");
      const bluetoothButton = buttons.find((btn) => btn.textContent.includes("bluetooth"));

      expect(bluetoothButton).toBeDefined();
      if (!bluetoothButton) return;
      await user.click(bluetoothButton);
      expect(mockOnConnectionTypeChange).toHaveBeenCalledWith("bluetooth");
    });

    it("calls onConnectionTypeChange when serial button is clicked", async () => {
      const user = userEvent.setup();
      render(
        <ConnectionTypeSelector
          connectionType="bluetooth"
          onConnectionTypeChange={mockOnConnectionTypeChange}
          browserSupport={{
            bluetooth: true,
            serial: true,
            bluetoothReason: null,
            serialReason: null,
          }}
        />,
      );

      const buttons = screen.getAllByRole("button");
      const serialButton = buttons.find((btn) => btn.textContent.includes("serial"));

      expect(serialButton).toBeDefined();
      if (!serialButton) return;
      await user.click(serialButton);
      expect(mockOnConnectionTypeChange).toHaveBeenCalledWith("serial");
    });
  });

  describe("browser support", () => {
    it("disables bluetooth button when not supported", () => {
      render(
        <ConnectionTypeSelector
          connectionType="serial"
          onConnectionTypeChange={mockOnConnectionTypeChange}
          browserSupport={{
            bluetooth: false,
            serial: true,
            bluetoothReason: "browser",
            serialReason: null,
          }}
        />,
      );

      const buttons = screen.getAllByRole("button");
      const bluetoothButton = buttons.find((btn) => btn.textContent.includes("bluetooth"));

      expect(bluetoothButton).toBeDisabled();
    });

    it("disables serial button when not supported", () => {
      render(
        <ConnectionTypeSelector
          connectionType="bluetooth"
          onConnectionTypeChange={mockOnConnectionTypeChange}
          browserSupport={{
            bluetooth: true,
            serial: false,
            bluetoothReason: null,
            serialReason: "browser",
          }}
        />,
      );

      const buttons = screen.getAllByRole("button");
      const serialButton = buttons.find((btn) => btn.textContent.includes("serial"));

      expect(serialButton).toBeDisabled();
    });

    it("enables both buttons when both are supported", () => {
      render(
        <ConnectionTypeSelector
          connectionType="bluetooth"
          onConnectionTypeChange={mockOnConnectionTypeChange}
          browserSupport={{
            bluetooth: true,
            serial: true,
            bluetoothReason: null,
            serialReason: null,
          }}
        />,
      );

      const buttons = screen.getAllByRole("button");
      buttons.forEach((button) => {
        expect(button).not.toBeDisabled();
      });
    });
  });

  describe("bluetooth classic guidance", () => {
    it("shows the Bluetooth Classic hint when the device is Classic-only and BLE is unavailable", async () => {
      const user = userEvent.setup();
      render(
        <ConnectionTypeSelector
          connectionType="serial"
          onConnectionTypeChange={mockOnConnectionTypeChange}
          browserSupport={{
            bluetooth: false,
            serial: true,
            bluetoothReason: "device",
            serialReason: null,
          }}
          bluetoothClassicOnly={true}
        />,
      );

      const bluetoothButton = screen
        .getAllByRole("button")
        .find((btn) => btn.textContent.includes("bluetooth"));
      if (!bluetoothButton) throw new Error("bluetooth button not found");
      await user.hover(bluetoothButton);

      expect(
        await screen.findAllByText("iot.protocolRunner.bluetoothClassicHint"),
      ).not.toHaveLength(0);
    });

    it("shows the generic no-BLE message when the device lacks BLE but is not Classic-only", async () => {
      const user = userEvent.setup();
      render(
        <ConnectionTypeSelector
          connectionType="serial"
          onConnectionTypeChange={mockOnConnectionTypeChange}
          browserSupport={{
            bluetooth: false,
            serial: true,
            bluetoothReason: "device",
            serialReason: null,
          }}
          bluetoothClassicOnly={false}
        />,
      );

      const bluetoothButton = screen
        .getAllByRole("button")
        .find((btn) => btn.textContent.includes("bluetooth"));
      if (!bluetoothButton) throw new Error("bluetooth button not found");
      await user.hover(bluetoothButton);

      expect(await screen.findAllByText("iot.protocolRunner.deviceNoBLE")).not.toHaveLength(0);
    });
  });

  describe("button variant", () => {
    it("highlights bluetooth button when selected", () => {
      render(
        <ConnectionTypeSelector
          connectionType="bluetooth"
          onConnectionTypeChange={mockOnConnectionTypeChange}
          browserSupport={{
            bluetooth: true,
            serial: true,
            bluetoothReason: null,
            serialReason: null,
          }}
        />,
      );

      const buttons = screen.getAllByRole("button");
      const bluetoothButton = buttons.find((btn) => btn.textContent.includes("bluetooth"));

      expect(bluetoothButton).toBeDefined();
    });

    it("highlights serial button when selected", () => {
      render(
        <ConnectionTypeSelector
          connectionType="serial"
          onConnectionTypeChange={mockOnConnectionTypeChange}
          browserSupport={{
            bluetooth: true,
            serial: true,
            bluetoothReason: null,
            serialReason: null,
          }}
        />,
      );

      const buttons = screen.getAllByRole("button");
      const serialButton = buttons.find((btn) => btn.textContent.includes("serial"));

      expect(serialButton).toBeDefined();
    });
  });
});
