// @vitest-environment jsdom
import { renderHook } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { useDeviceSheetActions } from "~/features/connection/hooks/use-device-sheet-actions";
import type { Device } from "~/shared/types/device";

const { mockToastError, mockConnect, mockDisconnect, mockExecutorGetState, mockT } = vi.hoisted(
  () => ({
    mockToastError: vi.fn(),
    mockConnect: vi.fn(),
    mockDisconnect: vi.fn(),
    mockExecutorGetState: vi.fn(),
    mockT: vi.fn((key: string, values?: Record<string, unknown>) => {
      if (key === "identity.unknownDevice") return "Unknown device";
      if (key === "identity.identifier") return `ID ${String(values?.id)}`;
      return key;
    }),
  }),
);

vi.mock("sonner-native", () => ({ toast: { error: mockToastError } }));
vi.mock("~/shared/i18n", () => ({
  useTranslation: () => ({ t: mockT }),
}));
vi.mock("~/features/connection/hooks/use-device-connection", () => ({
  useConnectToDevice: () => ({
    connectToDevice: mockConnect,
    disconnectFromDevice: mockDisconnect,
    connectingDeviceId: "dev-1",
  }),
}));
vi.mock("~/features/connection/stores/use-scanner-command-executor-store", () => ({
  useScannerCommandExecutorStore: { getState: mockExecutorGetState },
}));

const device: Device = { type: "bluetooth-classic", id: "dev-1", name: "MultispeQ" };

describe("useDeviceSheetActions", () => {
  beforeEach(() => {
    mockToastError.mockReset();
    mockConnect.mockReset();
    mockDisconnect.mockReset();
    mockExecutorGetState.mockReset();
    mockExecutorGetState.mockReturnValue({ executors: new Map() });
    mockT.mockClear();
  });

  it("connects without a toast on success", async () => {
    mockConnect.mockResolvedValue(undefined);
    const { result } = renderHook(() => useDeviceSheetActions());

    await result.current.handleConnect(device);

    expect(mockConnect).toHaveBeenCalledWith(device);
    expect(mockToastError).not.toHaveBeenCalled();
  });

  it("shows the connect error toast when connecting fails", async () => {
    mockConnect.mockRejectedValue(new Error("ble down"));
    const { result } = renderHook(() => useDeviceSheetActions());

    await result.current.handleConnect(device);

    expect(mockToastError).toHaveBeenCalledWith("setup.errorConnect");
    expect(mockT).toHaveBeenCalledWith("setup.errorConnect", { name: "MultispeQ" });
  });

  it("shows the disconnect error toast when disconnecting fails", async () => {
    mockDisconnect.mockRejectedValue(new Error("ble down"));
    const { result } = renderHook(() => useDeviceSheetActions());

    await result.current.handleDisconnect(device);

    expect(mockToastError).toHaveBeenCalledWith("setup.errorDisconnect");
    expect(mockT).toHaveBeenCalledWith("setup.errorDisconnect", { name: "MultispeQ" });
  });

  it("uses the captured identity name for a disconnect failure", async () => {
    mockExecutorGetState.mockReturnValue({
      executors: new Map([
        [
          device.id,
          { identity: { family: "multispeq", name: "Plot probe", deviceId: "SN-42", raw: {} } },
        ],
      ]),
    });
    mockDisconnect.mockRejectedValue(new Error("bluetooth down"));
    const { result } = renderHook(() => useDeviceSheetActions());

    await result.current.handleDisconnect(device);

    expect(mockT).toHaveBeenCalledWith("setup.errorDisconnect", { name: "Plot probe" });
  });

  it("uses product plus stable ID for an unnamed disconnect failure", async () => {
    const unnamedDevice: Device = { ...device, name: device.id };
    mockExecutorGetState.mockReturnValue({
      executors: new Map([
        [device.id, { identity: { family: "multispeq", deviceId: "SN-42", raw: {} } }],
      ]),
    });
    mockDisconnect.mockRejectedValue(new Error("bluetooth down"));
    const { result } = renderHook(() => useDeviceSheetActions());

    await result.current.handleDisconnect(unnamedDevice);

    expect(mockT).toHaveBeenCalledWith("setup.errorDisconnect", {
      name: "MultispeQ (ID SN-42)",
    });
  });

  it("uses unknown plus stable ID for an unnamed connect failure", async () => {
    const unnamedDevice: Device = { ...device, name: device.id };
    mockConnect.mockRejectedValue(new Error("bluetooth down"));
    const { result } = renderHook(() => useDeviceSheetActions());

    await result.current.handleConnect(unnamedDevice);

    expect(mockT).toHaveBeenCalledWith("setup.errorConnect", {
      name: "Unknown device (ID dev-1)",
    });
  });

  it("exposes connectingDeviceId from the connection hook", () => {
    const { result } = renderHook(() => useDeviceSheetActions());
    expect(result.current.connectingDeviceId).toBe("dev-1");
  });
});
