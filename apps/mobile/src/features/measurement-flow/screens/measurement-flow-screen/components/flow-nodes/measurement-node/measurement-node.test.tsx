import { render, screen, fireEvent, waitFor } from "@testing-library/react-native";
import React from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { MeasurementNode } from "./measurement-node";

// Only the network/native boundaries and deep state children are mocked; the
// start-scan guards run unmocked, and the command is passed via content.
const {
  executeScan,
  resetScan,
  cancelCommand,
  useConnectedDevice,
  refetchConnectedDevice,
  nextStep,
  setScanResult,
  setCommandId,
  navigateToQuestionFromOverview,
  openDeviceSheet,
  toastError,
  playSound,
  scanState,
} = vi.hoisted(() => ({
  executeScan: vi.fn(),
  resetScan: vi.fn(),
  cancelCommand: vi.fn(),
  useConnectedDevice: vi.fn(),
  refetchConnectedDevice: vi.fn(),
  nextStep: vi.fn(),
  setScanResult: vi.fn(),
  setCommandId: vi.fn(),
  navigateToQuestionFromOverview: vi.fn(),
  openDeviceSheet: vi.fn(),
  toastError: vi.fn(),
  playSound: vi.fn(),
  scanState: { isScanning: false },
}));

vi.mock("~/features/connection/hooks/use-scan-manager", () => ({
  useScanner: () => ({
    executeScan,
    isScanning: scanState.isScanning,
    reset: resetScan,
    result: undefined,
    error: undefined,
    cancelCommand,
  }),
}));

vi.mock("~/features/connection/hooks/use-device-connection", () => ({
  useConnectedDevice: () => useConnectedDevice(),
}));

vi.mock("~/features/connection/stores/use-device-sheet-store", () => ({
  useDeviceSheetStore: (selector: (s: { open: () => void }) => unknown) =>
    selector({ open: openDeviceSheet }),
}));

vi.mock("~/features/measurement-flow/stores/use-measurement-flow-store", () => ({
  useMeasurementFlowStore: () => ({
    nextStep,
    setScanResult,
    setCommandId,
    navigateToQuestionFromOverview,
  }),
}));

vi.mock("sonner-native", () => ({
  toast: { error: (...args: unknown[]) => toastError(...args) },
}));

vi.mock("~/features/measurement-flow/utils/play-sound", () => ({
  playSound: () => playSound(),
}));

vi.mock("~/shared/ui/hooks/use-theme", () => ({
  useTheme: () => ({
    classes: { textMuted: "" },
    colors: { brand: "#000", onPrimary: "#fff", primary: { dark: "#000" } },
  }),
}));

// i18n: echo the key so assertions are unambiguous about which toast fired.
vi.mock("~/shared/i18n", () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));

// The render-state children touch other stores; stub them so the tests focus on
// the Start button + start-scan guards that live in MeasurementNode itself.
vi.mock("./components/ready-state", () => ({ ReadyState: () => null }));
vi.mock("./components/error-state", () => ({ ErrorState: () => null }));
vi.mock("./components/scanning-state", () => ({ ScanningState: () => null }));
vi.mock("./components/no-device-state", () => ({ NoDeviceState: () => null }));

const COMMAND = { name: "Photosynthesis", code: [{ foo: 1 }] };
const START_KEY = "measurementFlow:measurementNode.startMeasurement";
const CANCEL_KEY = "measurementFlow:measurementNode.cancelMeasurement";
const COMMAND_UNAVAILABLE_KEY = "measurementFlow:measurementNode.toast.commandUnavailable";
const DEVICE_DISCONNECTED_KEY = "measurementFlow:measurementNode.toast.deviceDisconnected";
const SCAN_ERROR_KEY = "measurementFlow:measurementNode.toast.scanError";

const content = { params: {}, commandId: "proto-1", resolved: COMMAND };

beforeEach(() => {
  vi.clearAllMocks();
  scanState.isScanning = false;
  useConnectedDevice.mockReturnValue({ data: { id: "dev-1" }, refetch: refetchConnectedDevice });
  refetchConnectedDevice.mockResolvedValue({ data: { id: "dev-1" } });
});

describe("MeasurementNode start-scan guards", () => {
  it("shows the command-unavailable toast (not scan error) when the node has no command", () => {
    render(<MeasurementNode content={{ ...content, resolved: undefined }} nodeId="m1" />);
    fireEvent.press(screen.getByText(START_KEY));

    expect(toastError).toHaveBeenCalledWith(COMMAND_UNAVAILABLE_KEY);
    expect(executeScan).not.toHaveBeenCalled();
  });

  it("shows the no-command toast when the node has no commandId", () => {
    render(<MeasurementNode content={{ ...content, commandId: "" }} nodeId="m1" />);
    fireEvent.press(screen.getByText(START_KEY));

    expect(toastError).toHaveBeenCalledWith("measurementFlow:measurementNode.toast.noCommand");
    expect(executeScan).not.toHaveBeenCalled();
  });

  it("blocks the scan and shows device-disconnected when the liveness probe finds no device", async () => {
    refetchConnectedDevice.mockResolvedValue({ data: null });

    render(<MeasurementNode content={content} nodeId="m1" />);
    fireEvent.press(screen.getByText(START_KEY));

    await waitFor(() => expect(toastError).toHaveBeenCalledWith(DEVICE_DISCONNECTED_KEY));
    expect(executeScan).not.toHaveBeenCalled();
  });

  it("runs the scan and advances when the command and connection are available", async () => {
    executeScan.mockResolvedValue({ result: 42 });

    render(<MeasurementNode content={content} nodeId="m1" />);
    fireEvent.press(screen.getByText(START_KEY));

    await waitFor(() => expect(executeScan).toHaveBeenCalledWith(COMMAND));
    expect(setScanResult).toHaveBeenCalledWith({ result: 42 }, "m1");
    expect(nextStep).toHaveBeenCalled();
    expect(toastError).not.toHaveBeenCalled();
  });

  it("maps a transport failure to the device-disconnected toast", async () => {
    executeScan.mockRejectedValue(new Error("Failed to write to device"));

    render(<MeasurementNode content={content} nodeId="m1" />);
    fireEvent.press(screen.getByText(START_KEY));

    await waitFor(() => expect(toastError).toHaveBeenCalledWith(DEVICE_DISCONNECTED_KEY));
    expect(toastError).not.toHaveBeenCalledWith(SCAN_ERROR_KEY);
    expect(nextStep).not.toHaveBeenCalled();
  });

  it("shows the generic scan-error toast when the scan itself fails", async () => {
    executeScan.mockRejectedValue(new Error("Invalid result"));

    render(<MeasurementNode content={content} nodeId="m1" />);
    fireEvent.press(screen.getByText(START_KEY));

    await waitFor(() => expect(toastError).toHaveBeenCalledWith(SCAN_ERROR_KEY));
    expect(nextStep).not.toHaveBeenCalled();
  });

  it("stays silent when the measurement was cancelled", async () => {
    executeScan.mockRejectedValue(new Error("Measurement cancelled"));

    render(<MeasurementNode content={content} nodeId="m1" />);
    fireEvent.press(screen.getByText(START_KEY));

    await waitFor(() => expect(executeScan).toHaveBeenCalled());
    expect(toastError).not.toHaveBeenCalled();
    expect(nextStep).not.toHaveBeenCalled();
  });

  it("hides the Start button entirely when no device is connected", () => {
    useConnectedDevice.mockReturnValue({ data: undefined, refetch: refetchConnectedDevice });

    render(<MeasurementNode content={content} nodeId="m1" />);

    expect(screen.queryByText(START_KEY)).toBeNull();
  });

  it("ignores a second Start tap while the first scan is starting", async () => {
    let resolveScan: (value: unknown) => void = () => undefined;
    executeScan.mockReturnValue(
      new Promise((resolve) => {
        resolveScan = resolve;
      }),
    );

    render(<MeasurementNode content={content} nodeId="m1" />);
    const button = screen.getByText(START_KEY);
    fireEvent.press(button);
    fireEvent.press(button);

    await waitFor(() => expect(executeScan).toHaveBeenCalledTimes(1));
    resolveScan({ result: 1 });
  });
});

describe("MeasurementNode in-scan controls", () => {
  it("awaits cancel before resetting when the measurement is cancelled", async () => {
    scanState.isScanning = true;
    cancelCommand.mockResolvedValue(undefined);

    render(<MeasurementNode content={content} nodeId="m1" />);
    fireEvent.press(screen.getByText(CANCEL_KEY));

    await waitFor(() => expect(cancelCommand).toHaveBeenCalled());
    expect(resetScan).toHaveBeenCalled();
  });

  it("aborts and resets the scan when the device drops mid-measurement", async () => {
    scanState.isScanning = true;
    cancelCommand.mockResolvedValue(undefined);

    const { rerender } = render(<MeasurementNode content={content} nodeId="m1" />);
    expect(cancelCommand).not.toHaveBeenCalled();

    useConnectedDevice.mockReturnValue({ data: undefined, refetch: refetchConnectedDevice });
    rerender(<MeasurementNode content={content} nodeId="m1" />);

    await waitFor(() => expect(cancelCommand).toHaveBeenCalled());
    expect(resetScan).toHaveBeenCalled();
  });
});
