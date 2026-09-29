// @vitest-environment jsdom
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, renderHook, waitFor } from "@testing-library/react";
import React from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Device } from "~/shared/types/device";

import { useAutoReconnect } from "./use-auto-reconnect";
import { useDeviceSheetActions } from "./use-device-sheet-actions";

// Android numbers the replugged device 2002 again, so the remembered record
// and the device on the bus share an id.
const remembered: Device = { id: "2002", type: "usb", name: "MultispeQ #2002" };
const plugged: Device = { id: "2002", type: "usb", name: "1a86:55d4 #2002" };

const mocks = vi.hoisted(() => ({
  appStateListeners: [] as ((state: string) => void)[],
  transportConnect: vi.fn(),
}));

vi.mock("react-native", () => ({
  AppState: {
    currentState: "active",
    addEventListener: (_event: string, fn: (state: string) => void) => {
      mocks.appStateListeners.push(fn);
      return {
        remove: () => {
          mocks.appStateListeners = mocks.appStateListeners.filter((l) => l !== fn);
        },
      };
    },
  },
  Platform: { OS: "android" },
}));
vi.mock("react-native-bluetooth-classic", () => ({
  default: { onDeviceDiscovered: () => ({ remove: () => undefined }) },
}));
vi.mock("sonner-native", () => ({ toast: { error: vi.fn() } }));
vi.mock("~/shared/i18n", () => ({ useTranslation: () => ({ t: (key: string) => key }) }));
vi.mock(
  "~/features/connection/services/device-connection-manager/android-serial-port-connection/open-serial-port-connection",
  () => ({ listSerialPortDevices: () => Promise.resolve([]) }),
);
vi.mock("~/features/connection/services/device-connection-manager/serial-port-connection", () => ({
  closeAllSerialPorts: () => Promise.resolve(),
}));
vi.mock("~/features/connection/services/multispeq/mock-device/list-mock-devices", () => ({
  listMockDevices: () => Promise.resolve([]),
}));
vi.mock("~/features/connection/services/multispeq/mock-device/mock-device-registry", () => ({
  closeAllMockDevices: () => undefined,
}));
vi.mock("~/features/connection/services/multispeq/mock-device/mock-devices-enabled", () => ({
  mockDevicesEnabled: false,
}));
// Nothing is connected yet: the sheet's connect is still waiting on the dialog.
vi.mock("~/features/connection/services/device-connection-manager/device-queries", () => ({
  getConnectedDevices: () => Promise.resolve([]),
}));
vi.mock("~/features/connection/services/device-connection-manager/device-connection", () => ({
  connectToDevice: (device: Device) => mocks.transportConnect(device),
  disconnectFromDevice: () => Promise.resolve(),
  unpairDevice: () => Promise.resolve(),
}));
vi.mock("~/features/connection/stores/use-scanner-command-executor-store", () => {
  const state = {
    executors: new Map(),
    setDevice: () => Promise.resolve(),
    addDevice: () => Promise.resolve(),
    removeDevice: () => Promise.resolve(),
  };
  const hook = () => state;
  hook.getState = () => state;
  return { useScannerCommandExecutorStore: hook };
});
vi.mock("~/features/connection/hooks/use-device-connection-store", () => ({
  useDeviceConnectionStore: () => ({
    lastConnectedDevice: remembered,
    setLastConnectedDevice: () => undefined,
  }),
}));

function renderSheetWithAutoReconnect() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const wrapper = ({ children }: { children: React.ReactNode }) => (
    <QueryClientProvider client={client}>{children}</QueryClientProvider>
  );
  return renderHook(
    () => {
      useAutoReconnect();
      return useDeviceSheetActions();
    },
    { wrapper },
  );
}

/** The USB permission dialog: background, then Allow returns the app to active. */
function closePermissionDialog() {
  act(() => {
    mocks.appStateListeners.forEach((listener) => listener("background"));
    mocks.appStateListeners.forEach((listener) => listener("active"));
  });
}

describe("useAutoReconnect", () => {
  beforeEach(() => {
    mocks.transportConnect.mockReset();
    mocks.appStateListeners = [];
  });

  it("does not start a second connect while the sheet's connect waits on the permission dialog", async () => {
    let allow: () => void = () => undefined;
    mocks.transportConnect.mockImplementationOnce(
      () =>
        new Promise<void>((resolve) => {
          allow = resolve;
        }),
    );
    const { result, unmount } = renderSheetWithAutoReconnect();

    act(() => {
      void result.current.handleConnect(plugged);
    });
    await waitFor(() => expect(mocks.transportConnect).toHaveBeenCalledTimes(1));
    closePermissionDialog();

    // Give a racing reconnect every chance to reach the transport.
    await new Promise((resolve) => setTimeout(resolve, 20));
    expect(mocks.transportConnect).toHaveBeenCalledTimes(1);
    expect(mocks.transportConnect).toHaveBeenCalledWith(plugged);

    await act(async () => {
      allow();
      await Promise.resolve();
    });
    await waitFor(() => expect(result.current.connectingDeviceId).toBeUndefined());
    unmount();
  });

  it("reconnects the remembered device when the app returns and nothing is connecting", async () => {
    mocks.transportConnect.mockResolvedValue(undefined);
    const { unmount } = renderSheetWithAutoReconnect();
    // Let the connected-devices query settle to "nothing connected".
    await new Promise((resolve) => setTimeout(resolve, 0));

    closePermissionDialog();

    await waitFor(() => expect(mocks.transportConnect).toHaveBeenCalledWith(remembered));
    unmount();
  });
});
