import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, waitFor } from "@testing-library/react-native";
import React from "react";
import { View } from "react-native";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Device } from "~/shared/types/device";

import { DeviceSheet } from "./device-sheet";

const mocks = vi.hoisted(() => ({
  lastConnectedDevice: undefined as Device | undefined,
  simulatedExperiment: undefined as string | undefined,
  refreshDevices: vi.fn<() => Promise<void>>(),
  hasBluetoothPermission: vi.fn<() => Promise<boolean>>(),
}));

vi.mock("@gorhom/bottom-sheet", () => ({
  BottomSheetModal: ({ children }: { children: React.ReactNode }) => <View>{children}</View>,
  BottomSheetView: ({ children }: { children: React.ReactNode }) => <View>{children}</View>,
}));
vi.mock("react-native-gesture-handler", () => ({
  ScrollView: ({ children }: { children: React.ReactNode }) => <View>{children}</View>,
}));
vi.mock("react-native-safe-area-context", () => ({
  useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }),
}));
vi.mock("~/shared/i18n", () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));
vi.mock("~/shared/ui/hooks/use-theme", () => ({
  useTheme: () => ({ colors: { inactive: "#999", card: "#fff", onSurface: "#000" } }),
}));
vi.mock("~/shared/ui/hooks/use-bottom-sheet-controller", () => ({
  useBottomSheetController: () => ({ sheetRef: { current: null }, renderBackdrop: () => null }),
}));
vi.mock("~/features/connection/stores/use-device-sheet-store", () => {
  const state = { isOpen: true, close: () => undefined };
  return { useDeviceSheetStore: (select: (s: typeof state) => unknown) => select(state) };
});
vi.mock("~/features/connection/stores/use-scanner-command-executor-store", () => {
  const state = { executors: new Map() };
  return {
    useScannerCommandExecutorStore: (select: (s: typeof state) => unknown) => select(state),
  };
});
vi.mock("~/features/connection/hooks/use-device-connection-store", () => {
  return {
    useDeviceConnectionStore: (select: (s: { lastConnectedDevice?: Device }) => unknown) =>
      select({ lastConnectedDevice: mocks.lastConnectedDevice }),
  };
});
vi.mock("~/features/connection/hooks/use-simulated-experiment", () => ({
  useSimulatedExperiment: () => mocks.simulatedExperiment,
}));
vi.mock("~/features/connection/hooks/use-battery-level", () => ({
  useBatteryLevel: () => undefined,
}));
vi.mock("~/features/connection/hooks/use-device-sheet-actions", () => ({
  useDeviceSheetActions: () => ({
    handleConnect: () => Promise.resolve(),
    handleDisconnect: () => Promise.resolve(),
    connectingDeviceId: undefined,
  }),
}));
vi.mock("~/features/connection/hooks/use-device-connection", () => ({
  useConnectedDevices: () => ({ data: [] }),
  useAllDevices: () => ({ data: [], refetch: mocks.refreshDevices, isFetching: false }),
}));
vi.mock("~/features/connection/services/request-bluetooth-permissions", () => ({
  hasBluetoothPermission: () => mocks.hasBluetoothPermission(),
  requestBluetoothPermission: () => Promise.resolve(false),
}));

function renderSheet() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={client}>
      <DeviceSheet />
    </QueryClientProvider>,
  );
}

describe("DeviceSheet Bluetooth permission", () => {
  beforeEach(() => {
    mocks.lastConnectedDevice = undefined;
    mocks.simulatedExperiment = undefined;
    mocks.refreshDevices.mockReset().mockResolvedValue(undefined);
    mocks.hasBluetoothPermission.mockReset();
  });

  it.each([undefined, "demo"])(
    "offers the remembered simulated reconnect only in demo context %s",
    (experiment) => {
      mocks.simulatedExperiment = experiment;
      mocks.lastConnectedDevice = {
        id: "simulated:multispeq",
        name: "Simulated MultispeQ",
        type: "simulated-device",
      };
      mocks.hasBluetoothPermission.mockReturnValue(new Promise<boolean>(() => undefined));
      renderSheet();
      if (experiment) {
        expect(screen.getByText("deviceSheet.reconnectTitle")).toBeTruthy();
        expect(screen.getByText("deviceSheet.reconnect")).toBeTruthy();
      } else {
        expect(screen.queryByText("deviceSheet.reconnectTitle")).toBeNull();
        expect(screen.queryByText("deviceSheet.reconnect")).toBeNull();
        expect(screen.getByText("deviceSheet.noDeviceTitle")).toBeTruthy();
      }
    },
  );

  it("does not scan or ask for Bluetooth while the permission check is pending", () => {
    mocks.hasBluetoothPermission.mockReturnValue(new Promise<boolean>(() => undefined));

    renderSheet();

    expect(mocks.refreshDevices).not.toHaveBeenCalled();
    expect(screen.queryByText("deviceSheet.allowBluetooth")).toBeNull();
  });

  it("asks for Bluetooth and lists USB devices when the permission is denied", async () => {
    mocks.hasBluetoothPermission.mockResolvedValue(false);

    renderSheet();

    expect(await screen.findAllByText("deviceSheet.allowBluetooth")).not.toHaveLength(0);
    expect(mocks.refreshDevices).toHaveBeenCalledTimes(1);
  });

  it("scans without the permission prompt once Bluetooth is allowed", async () => {
    mocks.hasBluetoothPermission.mockResolvedValue(true);

    renderSheet();

    await waitFor(() => expect(mocks.refreshDevices).toHaveBeenCalledTimes(1));
    expect(screen.queryByText("deviceSheet.allowBluetooth")).toBeNull();
  });
});
