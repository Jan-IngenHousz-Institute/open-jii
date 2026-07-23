import { render, screen } from "@testing-library/react-native";
import React from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Device } from "~/shared/types/device";

import { HomeDeviceCard } from "./home-device-card";

const state = vi.hoisted(() => ({
  connectedDevice: null as Device | null,
  lastConnectedDevice: undefined as Device | undefined,
}));

vi.mock("~/features/connection/hooks/use-battery-level", () => ({
  useBatteryLevel: () => undefined,
}));
vi.mock("~/features/connection/hooks/use-device-connection", () => ({
  useConnectedDevice: () => ({ data: state.connectedDevice }),
}));
vi.mock("~/features/connection/hooks/use-device-connection-store", () => ({
  useDeviceConnectionStore: (selector: (value: { lastConnectedDevice?: Device }) => unknown) =>
    selector({ lastConnectedDevice: state.lastConnectedDevice }),
}));
vi.mock("~/features/connection/stores/use-device-sheet-store", () => ({
  useDeviceSheetStore: { getState: () => ({ open: vi.fn() }) },
}));
vi.mock("~/features/connection/stores/use-scanner-command-executor-store", () => ({
  useScannerCommandExecutorStore: (
    selector: (value: { executors: ReadonlyMap<string, never> }) => unknown,
  ) => selector({ executors: new Map<string, never>() }),
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
      if (namespace === "home" && key === "device.reconnectTitle") {
        return `Reconnect ${String(values?.name)}`;
      }
      if (namespace === "home" && key === "device.reconnectSub") {
        return "Tap to reconnect your last device";
      }
      return key;
    },
  }),
}));

describe("HomeDeviceCard reconnect identity", () => {
  beforeEach(() => {
    state.connectedDevice = null;
    state.lastConnectedDevice = undefined;
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
