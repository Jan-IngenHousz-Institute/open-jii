import { fireEvent, render, screen, waitFor } from "@testing-library/react-native";
import React from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { MeasurementNode } from "./measurement-node";

const mocks = vi.hoisted(() => {
  const startRunnerScan = vi.fn();
  const continueRunnerWithSuccesses = vi.fn();
  const cancelRunnerScan = vi.fn();
  const navigateToQuestionFromOverview = vi.fn();
  const openDeviceSheet = vi.fn();
  const refetchConnectedDevices = vi.fn();
  const toastError = vi.fn();
  const flowState = {
    runnerState: { status: "awaitingInput" },
    awaitingScanStart: true,
    runnerScanRound: undefined as
      | {
          successes: { device: object; result: object }[];
          failures: { device: object; error: Error }[];
        }
      | undefined,
    runnerSucceededCount: 0,
    startRunnerScan,
    continueRunnerWithSuccesses,
    cancelRunnerScan,
    navigateToQuestionFromOverview,
  };
  const scannerState = {
    executors: new Map(),
    progress: undefined,
    scanStartedAt: undefined,
    estimatedMs: undefined,
  };
  const connection = { devices: [] as { id: string; name: string; type: "usb" }[] };
  return {
    flowState,
    scannerState,
    connection,
    refetchConnectedDevices,
    openDeviceSheet,
    toastError,
  };
});

vi.mock("~/features/connection/hooks/use-device-connection", () => ({
  useConnectedDevices: () => ({
    data: mocks.connection.devices,
    refetch: mocks.refetchConnectedDevices,
  }),
}));
vi.mock("~/features/connection/stores/use-scanner-command-executor-store", () => ({
  useScannerCommandExecutorStore: (selector: (state: typeof mocks.scannerState) => unknown) =>
    selector(mocks.scannerState),
}));
vi.mock("~/features/connection/stores/use-device-sheet-store", () => ({
  useDeviceSheetStore: (selector: (state: { open: () => void }) => unknown) =>
    selector({ open: mocks.openDeviceSheet }),
}));
vi.mock("~/features/measurement-flow/stores/use-measurement-flow-store", () => ({
  useMeasurementFlowStore: () => mocks.flowState,
}));
vi.mock("sonner-native", () => ({
  toast: { error: mocks.toastError },
}));
vi.mock("~/shared/ui/hooks/use-theme", () => ({
  useTheme: () => ({
    classes: { text: "", textMuted: "" },
    colors: { brand: "#000", onPrimary: "#fff", primary: { dark: "#000" } },
  }),
}));
vi.mock("~/shared/i18n", () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));
vi.mock("./components/ready-state", () => ({ ReadyState: () => null }));
vi.mock("./components/error-state", () => ({ ErrorState: () => null }));
vi.mock("./components/scanning-state", () => ({ ScanningState: () => null }));
vi.mock("./components/no-device-state", () => ({ NoDeviceState: () => null }));
vi.mock("./components/device-scan-progress-list", () => ({
  DeviceScanProgressList: () => null,
}));

const PROTOCOL = { name: "Photosynthesis", code: [{ foo: 1 }] };
const CONTENT = { params: {}, protocolId: "proto-1", protocol: PROTOCOL };
const DEVICE = { id: "dev-1", name: "MultispeQ #1", type: "usb" as const };
const DEVICE_B = { id: "dev-2", name: "MultispeQ #2", type: "usb" as const };
const START_KEY = "measurementFlow:measurementNode.startMeasurement";

beforeEach(() => {
  vi.clearAllMocks();
  mocks.connection.devices = [DEVICE];
  mocks.refetchConnectedDevices.mockResolvedValue({ data: [DEVICE] });
  mocks.flowState.runnerState = { status: "awaitingInput" };
  mocks.flowState.awaitingScanStart = true;
  mocks.flowState.runnerScanRound = undefined;
  mocks.flowState.runnerSucceededCount = 0;
});

describe("MeasurementNode runner-backed controls", () => {
  it("retains protocol availability guards", () => {
    const { rerender } = render(
      <MeasurementNode content={{ ...CONTENT, protocol: undefined }} nodeId="m1" />,
    );
    fireEvent.press(screen.getByText(START_KEY));
    expect(mocks.toastError).toHaveBeenCalledWith(
      "measurementFlow:measurementNode.toast.protocolUnavailable",
    );

    rerender(<MeasurementNode content={{ ...CONTENT, protocolId: "" }} nodeId="m1" />);
    fireEvent.press(screen.getByText(START_KEY));
    expect(mocks.toastError).toHaveBeenCalledWith(
      "measurementFlow:measurementNode.toast.noProtocol",
    );
    expect(mocks.flowState.startRunnerScan).not.toHaveBeenCalled();
  });

  it("starts the runner gate after the live connection probe", async () => {
    render(<MeasurementNode content={CONTENT} nodeId="m1" />);
    fireEvent.press(screen.getByText(START_KEY));

    await waitFor(() => expect(mocks.flowState.startRunnerScan).toHaveBeenCalledWith("m1"));
    expect(mocks.refetchConnectedDevices).toHaveBeenCalledTimes(1);
    expect(mocks.toastError).not.toHaveBeenCalled();
  });

  it("allows inline command cells without protocol metadata", async () => {
    render(
      <MeasurementNode
        content={{ command: { format: "string", content: "battery" } }}
        nodeId="command-1"
      />,
    );
    fireEvent.press(screen.getByText(START_KEY));

    await waitFor(() => expect(mocks.flowState.startRunnerScan).toHaveBeenCalledWith("command-1"));
  });

  it("blocks when the live connection probe finds no device", async () => {
    mocks.refetchConnectedDevices.mockResolvedValue({ data: [] });
    render(<MeasurementNode content={CONTENT} nodeId="m1" />);
    fireEvent.press(screen.getByText(START_KEY));

    await waitFor(() =>
      expect(mocks.toastError).toHaveBeenCalledWith(
        "measurementFlow:measurementNode.toast.deviceDisconnected",
      ),
    );
    expect(mocks.flowState.startRunnerScan).not.toHaveBeenCalled();
  });

  it("hides the Start action when no device is connected", () => {
    mocks.connection.devices = [];
    render(<MeasurementNode content={CONTENT} nodeId="m1" />);
    expect(screen.queryByText(START_KEY)).toBeNull();
  });

  it("suppresses a second tap while the liveness probe is pending", async () => {
    let finishProbe: (value: { data: typeof mocks.connection.devices }) => void = () => undefined;
    mocks.refetchConnectedDevices.mockReturnValue(
      new Promise((resolve) => {
        finishProbe = resolve;
      }),
    );
    render(<MeasurementNode content={CONTENT} nodeId="m1" />);
    const start = screen.getByText(START_KEY);
    fireEvent.press(start);
    fireEvent.press(start);
    expect(mocks.refetchConnectedDevices).toHaveBeenCalledTimes(1);

    finishProbe({ data: [DEVICE] });
    await waitFor(() => expect(mocks.flowState.startRunnerScan).toHaveBeenCalledTimes(1));
  });

  it("maps a mixed round to Retry and Continue runner actions", () => {
    mocks.connection.devices = [DEVICE, DEVICE_B];
    mocks.flowState.runnerScanRound = {
      successes: [{ device: DEVICE, result: { value: 1 } }],
      failures: [{ device: DEVICE_B, error: new Error("lost") }],
    };
    mocks.flowState.runnerSucceededCount = 1;
    render(<MeasurementNode content={CONTENT} nodeId="m1" />);

    fireEvent.press(screen.getByText("measurementFlow:measurementNode.multiScan.retryFailed"));
    fireEvent.press(
      screen.getByText("measurementFlow:measurementNode.multiScan.continueWithSuccessful"),
    );
    expect(mocks.refetchConnectedDevices).toHaveBeenCalledTimes(1);
    expect(mocks.flowState.continueRunnerWithSuccesses).toHaveBeenCalledTimes(1);
  });

  it("maps active runner execution to the Cancel action", () => {
    mocks.flowState.runnerState = { status: "running" };
    mocks.flowState.awaitingScanStart = false;
    render(<MeasurementNode content={CONTENT} nodeId="m1" />);

    fireEvent.press(screen.getByText("measurementFlow:measurementNode.cancelMeasurement"));
    expect(mocks.flowState.cancelRunnerScan).toHaveBeenCalledTimes(1);
  });
});
