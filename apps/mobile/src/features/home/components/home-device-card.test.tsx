import { fireEvent, render, screen } from "@testing-library/react-native";
import React from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Device } from "~/shared/types/device";

import type { DeviceIdentity } from "@repo/iot";

import { HomeDeviceCard } from "./home-device-card";

const state = vi.hoisted(() => ({
  connectedDevice: null as Device | null,
  lastConnectedDevice: undefined as Device | undefined,
  batteryLevel: undefined as number | undefined,
  identities: new Map<string, DeviceIdentity>(),
  open: vi.fn(),
}));

vi.mock("~/features/connection/hooks/use-battery-level", () => ({
  useBatteryLevel: () => state.batteryLevel,
}));
vi.mock("~/features/connection/hooks/use-device-connection", () => ({
  useConnectedDevice: () => ({ data: state.connectedDevice }),
}));
vi.mock("~/features/connection/hooks/use-device-connection-store", () => ({
  useDeviceConnectionStore: (selector: (value: { lastConnectedDevice?: Device }) => unknown) =>
    selector({ lastConnectedDevice: state.lastConnectedDevice }),
}));
vi.mock("~/features/connection/stores/use-device-sheet-store", () => ({
  useDeviceSheetStore: { getState: () => ({ open: state.open }) },
}));
vi.mock("~/features/connection/stores/use-scanner-command-executor-store", () => ({
  useScannerCommandExecutorStore: (
    selector: (value: { executors: ReadonlyMap<string, { identity: DeviceIdentity }> }) => unknown,
  ) =>
    selector({
      executors: new Map(
        [...state.identities].map(([id, identity]) => [id, { identity }] as const),
      ),
    }),
}));
vi.mock("~/shared/constants/colors", () => ({ colors: { jii: { darkGreen: "#004000" } } }));
vi.mock("~/shared/ui/hooks/use-theme-colors", () => ({
  useThemeColors: () => ({ inactive: "#777777" }),
}));
vi.mock("~/shared/i18n", () => ({
  useTranslation: (namespace: string) => ({
    t: (key: string, values?: Record<string, unknown>) => {
      if (namespace === "connection" && key === "identity.unknownDevice") {
        return "Unknown device";
      }
      if (namespace === "connection" && key === "identity.identifier") {
        return `ID ${String(values?.id)}`;
      }
      if (namespace === "connection" && key === "identity.measurementDevice") {
        return "Measurement device";
      }
      if (namespace === "home" && key === "device.reconnectTitle") {
        return `Reconnect ${String(values?.name)}`;
      }
      if (namespace === "home" && key === "device.reconnectSub") {
        return "Tap to reconnect your last device";
      }
      if (namespace === "home" && key === "device.battery") {
        return `Battery ${String(values?.battery)}%`;
      }
      if (namespace === "home" && key === "device.connectedViaBluetooth") {
        return "Connected via Bluetooth";
      }
      if (namespace === "home" && key === "device.connectedViaCable") {
        return "Connected via cable";
      }
      if (namespace === "home" && key === "device.disconnectedTitle") {
        return "No device connected";
      }
      if (namespace === "home" && key === "device.disconnectedSub") {
        return "Tap to connect a device";
      }
      return key;
    },
  }),
}));

describe("HomeDeviceCard reconnect identity", () => {
  beforeEach(() => {
    state.connectedDevice = null;
    state.lastConnectedDevice = undefined;
    state.batteryLevel = undefined;
    state.identities.clear();
    state.open.mockClear();
  });

  it("shows connected Bluetooth identity and opens the device sheet", () => {
    state.connectedDevice = {
      type: "bluetooth-classic",
      id: "BT-1",
      name: "BT-1",
    };
    state.identities.set("BT-1", {
      family: "multispeq",
      name: "Plot probe",
      raw: {},
    });

    render(<HomeDeviceCard />);

    expect(screen.getByText("Plot probe")).toBeTruthy();
    expect(
      screen.getByText("MultispeQ · Measurement device · ID BT-1 · Connected via Bluetooth"),
    ).toBeTruthy();

    fireEvent.press(screen.getByText("Plot probe"));
    expect(state.open).toHaveBeenCalledOnce();
  });

  it("shows battery state for a connected USB device", () => {
    state.connectedDevice = { type: "usb", id: "USB-42", name: "Field unit" };
    state.batteryLevel = 74;

    render(<HomeDeviceCard />);

    expect(screen.getByText("Field unit")).toBeTruthy();
    expect(screen.getByText("Measurement device · ID USB-42 · Battery 74%")).toBeTruthy();
  });

  it("labels an unmetered USB connection as cable", () => {
    state.connectedDevice = { type: "usb", id: "USB-42", name: "Field unit" };

    render(<HomeDeviceCard />);

    expect(screen.getByText("Measurement device · ID USB-42 · Connected via cable")).toBeTruthy();
  });

  it("shows a generic disconnected prompt without remembered hardware", () => {
    render(<HomeDeviceCard />);

    expect(screen.getByText("No device connected")).toBeTruthy();
    expect(screen.getByText("Tap to connect a device")).toBeTruthy();
  });

  it("keeps the stable ID visible when the remembered device has no usable name", () => {
    state.lastConnectedDevice = {
      type: "bluetooth-classic",
      id: "AA:BB:CC:DD:EE:FF",
      name: "AA:BB:CC:DD:EE:FF",
    };

    render(<HomeDeviceCard />);

    expect(screen.getByText("Reconnect Unknown device")).toBeTruthy();
    expect(
      screen.getByText("Tap to reconnect your last device · ID AA:BB:CC:DD:EE:FF"),
    ).toBeTruthy();
  });

  it("does not duplicate the ID when the remembered device has a usable name", () => {
    state.lastConnectedDevice = {
      type: "usb",
      id: "USB-42",
      name: "Field unit",
    };

    render(<HomeDeviceCard />);

    expect(screen.getByText("Reconnect Field unit")).toBeTruthy();
    expect(screen.getByText("Tap to reconnect your last device")).toBeTruthy();
    expect(screen.queryByText(/ID USB-42/u)).toBeNull();
  });
});
