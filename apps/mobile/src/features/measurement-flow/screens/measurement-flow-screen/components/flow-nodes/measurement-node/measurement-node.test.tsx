import { render, screen, fireEvent, waitFor } from "@testing-library/react-native";
import React from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { MeasurementNode } from "./measurement-node";

// Only the network/native boundaries and deep state children are mocked; the
// start-scan guards run unmocked, and the protocol is passed via content.
const {
  executeScanAll,
  resetScan,
  cancelAll,
  useConnectedDevices,
  refetchConnectedDevices,
  nextStep,
  setScanResults,
  navigateToQuestionFromOverview,
  openDeviceSheet,
  toastError,
  playSound,
  scanState,
} = vi.hoisted(() => ({
  executeScanAll: vi.fn(),
  resetScan: vi.fn(),
  cancelAll: vi.fn(),
  useConnectedDevices: vi.fn(),
  refetchConnectedDevices: vi.fn(),
  nextStep: vi.fn(),
  setScanResults: vi.fn(),
  navigateToQuestionFromOverview: vi.fn(),
  openDeviceSheet: vi.fn(),
  toastError: vi.fn(),
  playSound: vi.fn(),
  scanState: {
    isScanning: false,
    lastRound: undefined as { successes: unknown[]; failures: unknown[] } | undefined,
  },
}));

vi.mock("~/features/connection/hooks/use-multi-scanner", () => ({
  useMultiScanner: () => ({
    executeScanAll,
    isScanning: scanState.isScanning,
    deviceStates: [],
    lastRound: scanState.lastRound,
    reset: resetScan,
    cancelAll,
  }),
}));

vi.mock("~/features/connection/hooks/use-device-connection", () => ({
  useConnectedDevices: () => useConnectedDevices(),
}));

// The capture hook reads the Primary device's live progress off the store.
vi.mock("~/features/connection/stores/use-scanner-command-executor-store", () => ({
  useScannerCommandExecutorStore: (selector: (s: object) => unknown) =>
    selector({ progress: undefined, scanStartedAt: undefined, estimatedMs: undefined }),
}));

vi.mock("~/features/connection/stores/use-device-sheet-store", () => ({
  useDeviceSheetStore: (selector: (s: { open: () => void }) => unknown) =>
    selector({ open: openDeviceSheet }),
}));

vi.mock("~/features/measurement-flow/stores/use-measurement-flow-store", () => ({
  useMeasurementFlowStore: () => ({
    nextStep,
    setScanResults,
    navigateToQuestionFromOverview,
  }),
}));

vi.mock("sonner-native", () => ({
  toast: { error: (...args: unknown[]) => toastError(...args) },
}));

vi.mock("~/features/measurement-flow/utils/play-sound", () => ({
  playSound: () => {
    playSound();
    return Promise.resolve();
  },
}));

vi.mock("~/shared/ui/hooks/use-theme", () => ({
  useTheme: () => ({
    classes: { text: "", textMuted: "" },
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
vi.mock("./components/device-scan-progress-list", () => ({
  DeviceScanProgressList: () => null,
}));

const PROTOCOL = { name: "Photosynthesis", code: [{ foo: 1 }] };
const START_KEY = "measurementFlow:measurementNode.startMeasurement";
const CANCEL_KEY = "measurementFlow:measurementNode.cancelMeasurement";
const PROTOCOL_UNAVAILABLE_KEY = "measurementFlow:measurementNode.toast.protocolUnavailable";
const DEVICE_DISCONNECTED_KEY = "measurementFlow:measurementNode.toast.deviceDisconnected";
const SCAN_ERROR_KEY = "measurementFlow:measurementNode.toast.scanError";

const content = { params: {}, protocolId: "proto-1", protocol: PROTOCOL };
const DEVICE = { id: "dev-1", name: "MultispeQ #1", type: "usb" };
const DEVICE_B = { id: "dev-2", name: "MultispeQ #2", type: "usb" };

function round(successes: unknown[], failures: unknown[]) {
  return { successes, failures };
}

beforeEach(() => {
  vi.clearAllMocks();
  scanState.isScanning = false;
  scanState.lastRound = undefined;
  useConnectedDevices.mockReturnValue({ data: [DEVICE], refetch: refetchConnectedDevices });
  refetchConnectedDevices.mockResolvedValue({ data: [DEVICE] });
});

describe("MeasurementNode start-scan guards", () => {
  it("shows the protocol-unavailable toast (not scan error) when the node has no protocol", () => {
    render(<MeasurementNode content={{ ...content, protocol: undefined }} nodeId="m1" />);
    fireEvent.press(screen.getByText(START_KEY));

    expect(toastError).toHaveBeenCalledWith(PROTOCOL_UNAVAILABLE_KEY);
    expect(executeScanAll).not.toHaveBeenCalled();
  });

  it("shows the no-protocol toast when the node has no protocolId", () => {
    render(<MeasurementNode content={{ ...content, protocolId: "" }} nodeId="m1" />);
    fireEvent.press(screen.getByText(START_KEY));

    expect(toastError).toHaveBeenCalledWith("measurementFlow:measurementNode.toast.noProtocol");
    expect(executeScanAll).not.toHaveBeenCalled();
  });

  it("blocks the scan and shows device-disconnected when the liveness probe finds no device", async () => {
    refetchConnectedDevices.mockResolvedValue({ data: [] });

    render(<MeasurementNode content={content} nodeId="m1" />);
    fireEvent.press(screen.getByText(START_KEY));

    await waitFor(() => expect(toastError).toHaveBeenCalledWith(DEVICE_DISCONNECTED_KEY));
    expect(executeScanAll).not.toHaveBeenCalled();
  });

  it("runs the scan and advances when the protocol and connection are available", async () => {
    executeScanAll.mockResolvedValue(round([{ device: DEVICE, result: { result: 42 } }], []));

    render(<MeasurementNode content={content} nodeId="m1" />);
    fireEvent.press(screen.getByText(START_KEY));

    await waitFor(() => expect(executeScanAll).toHaveBeenCalledWith(PROTOCOL, [DEVICE]));
    expect(setScanResults).toHaveBeenCalledWith(
      [{ device: { id: "dev-1", name: "MultispeQ #1" }, result: { result: 42 } }],
      "m1",
    );
    expect(nextStep).toHaveBeenCalled();
    expect(toastError).not.toHaveBeenCalled();
  });

  it("maps an all-failed transport round to the device-disconnected toast", async () => {
    executeScanAll.mockResolvedValue(
      round([], [{ device: DEVICE, error: new Error("Failed to write to device") }]),
    );

    render(<MeasurementNode content={content} nodeId="m1" />);
    fireEvent.press(screen.getByText(START_KEY));

    await waitFor(() => expect(toastError).toHaveBeenCalledWith(DEVICE_DISCONNECTED_KEY));
    expect(toastError).not.toHaveBeenCalledWith(SCAN_ERROR_KEY);
    expect(nextStep).not.toHaveBeenCalled();
  });

  it("shows the generic scan-error toast when every device fails the scan itself", async () => {
    executeScanAll.mockResolvedValue(
      round([], [{ device: DEVICE, error: new Error("Invalid result") }]),
    );

    render(<MeasurementNode content={content} nodeId="m1" />);
    fireEvent.press(screen.getByText(START_KEY));

    await waitFor(() => expect(toastError).toHaveBeenCalledWith(SCAN_ERROR_KEY));
    expect(nextStep).not.toHaveBeenCalled();
  });

  it("stays silent when the measurement was cancelled", async () => {
    executeScanAll.mockResolvedValue(
      round([], [{ device: DEVICE, error: new Error("Measurement cancelled") }]),
    );

    render(<MeasurementNode content={content} nodeId="m1" />);
    fireEvent.press(screen.getByText(START_KEY));

    await waitFor(() => expect(executeScanAll).toHaveBeenCalled());
    expect(toastError).not.toHaveBeenCalled();
    expect(nextStep).not.toHaveBeenCalled();
  });

  it("stores a two-device round in connect order and advances", async () => {
    useConnectedDevices.mockReturnValue({
      data: [DEVICE, DEVICE_B],
      refetch: refetchConnectedDevices,
    });
    refetchConnectedDevices.mockResolvedValue({ data: [DEVICE, DEVICE_B] });
    // Results arrive out of connect order; the stored round must be sorted.
    executeScanAll.mockResolvedValue(
      round(
        [
          { device: DEVICE_B, result: { result: 2 } },
          { device: DEVICE, result: { result: 1 } },
        ],
        [],
      ),
    );

    render(<MeasurementNode content={content} nodeId="m1" />);
    fireEvent.press(screen.getByText(START_KEY));

    await waitFor(() => expect(setScanResults).toHaveBeenCalled());
    expect(setScanResults).toHaveBeenCalledWith(
      [
        { device: { id: "dev-1", name: "MultispeQ #1" }, result: { result: 1 } },
        { device: { id: "dev-2", name: "MultispeQ #2" }, result: { result: 2 } },
      ],
      "m1",
    );
    expect(nextStep).toHaveBeenCalled();
  });

  it("advances with only the successful devices' results on a mixed round + continue", async () => {
    useConnectedDevices.mockReturnValue({
      data: [DEVICE, DEVICE_B],
      refetch: refetchConnectedDevices,
    });
    refetchConnectedDevices.mockResolvedValue({ data: [DEVICE, DEVICE_B] });
    const mixed = round(
      [{ device: DEVICE, result: { result: 1 } }],
      [{ device: DEVICE_B, error: new Error("Invalid result") }],
    );
    executeScanAll.mockResolvedValue(mixed);

    const { rerender } = render(<MeasurementNode content={content} nodeId="m1" />);
    fireEvent.press(screen.getByText(START_KEY));
    await waitFor(() => expect(executeScanAll).toHaveBeenCalledTimes(1));
    // Mixed round: no toast, no auto-advance; the partial-failure UI decides.
    expect(nextStep).not.toHaveBeenCalled();
    expect(toastError).not.toHaveBeenCalled();

    // Same mounted instance (the successes accumulator is per-instance); the
    // mocked scanner hook now reports the finished mixed round.
    scanState.lastRound = mixed;
    rerender(<MeasurementNode content={content} nodeId="m1" />);
    fireEvent.press(
      screen.getByText("measurementFlow:measurementNode.multiScan.continueWithSuccessful"),
    );

    await waitFor(() => expect(setScanResults).toHaveBeenCalled());
    expect(setScanResults).toHaveBeenCalledWith(
      [{ device: { id: "dev-1", name: "MultispeQ #1" }, result: { result: 1 } }],
      "m1",
    );
    expect(nextStep).toHaveBeenCalled();
  });

  it("hides the Start button entirely when no device is connected", () => {
    useConnectedDevices.mockReturnValue({ data: [], refetch: refetchConnectedDevices });

    render(<MeasurementNode content={content} nodeId="m1" />);

    expect(screen.queryByText(START_KEY)).toBeNull();
  });

  it("ignores a second Start tap while the first scan is starting", async () => {
    let resolveScan: (value: unknown) => void = () => undefined;
    executeScanAll.mockReturnValue(
      new Promise((resolve) => {
        resolveScan = resolve;
      }),
    );

    render(<MeasurementNode content={content} nodeId="m1" />);
    const button = screen.getByText(START_KEY);
    fireEvent.press(button);
    fireEvent.press(button);

    await waitFor(() => expect(executeScanAll).toHaveBeenCalledTimes(1));
    resolveScan(round([{ device: DEVICE, result: { result: 1 } }], []));
  });
});

describe("MeasurementNode in-scan controls", () => {
  it("awaits cancel before resetting when the measurement is cancelled", async () => {
    scanState.isScanning = true;
    // Keep the cancellation pending so the ordering is actually observable:
    // reset must not run until the cancel settles.
    let resolveCancel: () => void = () => undefined;
    cancelAll.mockReturnValue(
      new Promise<void>((resolve) => {
        resolveCancel = resolve;
      }),
    );

    render(<MeasurementNode content={content} nodeId="m1" />);
    fireEvent.press(screen.getByText(CANCEL_KEY));

    await waitFor(() => expect(cancelAll).toHaveBeenCalled());
    expect(resetScan).not.toHaveBeenCalled();

    resolveCancel();
    await waitFor(() => expect(resetScan).toHaveBeenCalled());
  });

  it("aborts and resets the scan when every device drops mid-measurement", async () => {
    scanState.isScanning = true;
    cancelAll.mockResolvedValue(undefined);

    const { rerender } = render(<MeasurementNode content={content} nodeId="m1" />);
    expect(cancelAll).not.toHaveBeenCalled();

    useConnectedDevices.mockReturnValue({ data: [], refetch: refetchConnectedDevices });
    rerender(<MeasurementNode content={content} nodeId="m1" />);

    await waitFor(() => expect(cancelAll).toHaveBeenCalled());
    expect(resetScan).toHaveBeenCalled();
  });
});
