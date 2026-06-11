// @vitest-environment jsdom
import { renderHook } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { useDeviceSheetActions } from "~/features/connection/hooks/use-device-sheet-actions";
import type { Device } from "~/shared/types/device";

const { mockToastError, mockConnect, mockDisconnect } = vi.hoisted(() => ({
  mockToastError: vi.fn(),
  mockConnect: vi.fn(),
  mockDisconnect: vi.fn(),
}));

vi.mock("sonner-native", () => ({ toast: { error: mockToastError } }));
vi.mock("~/shared/i18n", () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));
vi.mock("~/features/connection/hooks/use-device-connection", () => ({
  useConnectToDevice: () => ({
    connectToDevice: mockConnect,
    disconnectFromDevice: mockDisconnect,
    connectingDeviceId: "dev-1",
  }),
}));

const device: Device = { type: "bluetooth-classic", id: "dev-1", name: "MultispeQ" };

describe("useDeviceSheetActions", () => {
  beforeEach(() => {
    mockToastError.mockReset();
    mockConnect.mockReset();
    mockDisconnect.mockReset();
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
  });

  it("shows the disconnect error toast when disconnecting fails", async () => {
    mockDisconnect.mockRejectedValue(new Error("ble down"));
    const { result } = renderHook(() => useDeviceSheetActions());

    await result.current.handleDisconnect(device);

    expect(mockToastError).toHaveBeenCalledWith("setup.errorDisconnect");
  });

  it("exposes connectingDeviceId from the connection hook", () => {
    const { result } = renderHook(() => useDeviceSheetActions());
    expect(result.current.connectingDeviceId).toBe("dev-1");
  });
});
