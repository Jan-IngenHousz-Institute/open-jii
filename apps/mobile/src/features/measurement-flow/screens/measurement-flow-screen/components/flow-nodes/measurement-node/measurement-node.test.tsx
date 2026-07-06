import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, fireEvent, waitFor } from "@testing-library/react-native";
import React from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { useWorkbookFlowStore } from "~/features/measurement-flow/stores/use-workbook-flow-store";
import type { FlowNode } from "~/shared/measurements/flow-node";

import type { RunnerState } from "@repo/workbook";

import { MeasurementNode } from "./measurement-node";

// Only the network/native boundaries and deep state children are mocked; the
// start-scan guards run unmocked against the real workbook flow store.
const { useConnectedDevice, refetchConnectedDevice, openDeviceSheet, toastError } = vi.hoisted(
  () => ({
    useConnectedDevice: vi.fn(),
    refetchConnectedDevice: vi.fn(),
    openDeviceSheet: vi.fn(),
    toastError: vi.fn(),
  }),
);

vi.mock("~/features/connection/hooks/use-device-connection", () => ({
  useConnectedDevice: () => useConnectedDevice(),
}));

vi.mock("~/features/connection/hooks/use-scanner-command-executor", () => ({
  useScannerCommandExecutor: () => ({
    progress: undefined,
    scanStartedAt: undefined,
    estimatedMs: undefined,
  }),
}));

vi.mock("~/features/connection/stores/use-device-sheet-store", () => ({
  useDeviceSheetStore: (selector: (s: { open: () => void }) => unknown) =>
    selector({ open: openDeviceSheet }),
}));

vi.mock("sonner-native", () => ({
  toast: { error: (...args: unknown[]) => toastError(...args) },
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

const PROTOCOL = { name: "Photosynthesis", code: [{ foo: 1 }] };
const START_KEY = "measurementFlow:measurementNode.startMeasurement";
const CANCEL_KEY = "measurementFlow:measurementNode.cancelMeasurement";
const PROTOCOL_UNAVAILABLE_KEY = "measurementFlow:measurementNode.toast.protocolUnavailable";
const DEVICE_DISCONNECTED_KEY = "measurementFlow:measurementNode.toast.deviceDisconnected";
const SCAN_ERROR_KEY = "measurementFlow:measurementNode.toast.scanError";

const content = {
  params: {},
  protocolId: "proto-1",
  protocol: PROTOCOL as { name: string; code: Record<string, unknown>[] } | undefined,
};

const measurementNode: FlowNode = {
  id: "p1",
  name: "scan",
  type: "measurement",
  content,
  isStart: false,
};

const runnerAt = (status: RunnerState["status"]): RunnerState =>
  ({
    status,
    position: { cellId: "p1", enteredVia: "forward", atStart: false },
    cellRuns: {},
    cycle: 0,
  }) as unknown as RunnerState;

function renderNode(nodeContent = content) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={client}>
      <MeasurementNode content={nodeContent} />
    </QueryClientProvider>,
  );
}

const startScan = vi.fn();
const cancelScan = vi.fn();

beforeEach(() => {
  vi.clearAllMocks();
  useWorkbookFlowStore.setState({
    experimentId: "exp-1",
    currentNode: measurementNode,
    runnerState: runnerAt("awaitingInput"),
    awaitingScanStart: false,
    scanError: undefined,
    scanResult: undefined,
    startScan,
    cancelScan,
  });
  useConnectedDevice.mockReturnValue({ data: { id: "dev-1" }, refetch: refetchConnectedDevice });
  refetchConnectedDevice.mockResolvedValue({ data: { id: "dev-1" } });
});

describe("MeasurementNode start-scan guards", () => {
  it("shows the protocol-unavailable toast when the node has no protocol", async () => {
    renderNode({ ...content, protocol: undefined });
    fireEvent.press(screen.getByText(START_KEY));

    await waitFor(() => expect(toastError).toHaveBeenCalledWith(PROTOCOL_UNAVAILABLE_KEY));
    expect(startScan).not.toHaveBeenCalled();
  });

  it("shows the no-protocol toast when the node has no protocolId", async () => {
    renderNode({ ...content, protocolId: "" });
    fireEvent.press(screen.getByText(START_KEY));

    await waitFor(() =>
      expect(toastError).toHaveBeenCalledWith("measurementFlow:measurementNode.toast.noProtocol"),
    );
    expect(startScan).not.toHaveBeenCalled();
  });

  it("blocks the scan and shows device-disconnected when the liveness probe finds no device", async () => {
    refetchConnectedDevice.mockResolvedValue({ data: null });

    renderNode();
    fireEvent.press(screen.getByText(START_KEY));

    await waitFor(() => expect(toastError).toHaveBeenCalledWith(DEVICE_DISCONNECTED_KEY));
    expect(startScan).not.toHaveBeenCalled();
  });

  it("arms the scan gate for the current producer cell when preconditions pass", async () => {
    renderNode();
    fireEvent.press(screen.getByText(START_KEY));

    await waitFor(() => expect(startScan).toHaveBeenCalledWith("p1"));
    expect(toastError).not.toHaveBeenCalled();
  });

  it("maps a transport failure recorded by the runner to the device-disconnected toast", async () => {
    useWorkbookFlowStore.setState({
      runnerState: runnerAt("pausedError"),
      scanError: new Error("Failed to write to device"),
    });
    renderNode();

    await waitFor(() => expect(toastError).toHaveBeenCalledWith(DEVICE_DISCONNECTED_KEY));
    expect(toastError).not.toHaveBeenCalledWith(SCAN_ERROR_KEY);
  });

  it("shows the generic scan-error toast when the scan itself fails", async () => {
    useWorkbookFlowStore.setState({
      runnerState: runnerAt("pausedError"),
      scanError: new Error("Invalid result"),
    });
    renderNode();

    await waitFor(() => expect(toastError).toHaveBeenCalledWith(SCAN_ERROR_KEY));
  });

  it("stays silent when the measurement was cancelled", async () => {
    useWorkbookFlowStore.setState({
      runnerState: runnerAt("awaitingInput"),
      scanError: new Error("Measurement cancelled"),
    });
    renderNode();

    await new Promise((resolve) => setTimeout(resolve, 20));
    expect(toastError).not.toHaveBeenCalled();
  });

  it("hides the Start button entirely when no device is connected", () => {
    useConnectedDevice.mockReturnValue({ data: undefined, refetch: refetchConnectedDevice });

    renderNode();

    expect(screen.queryByText(START_KEY)).toBeNull();
  });

  it("ignores a second Start tap while the first one is still probing", async () => {
    let resolveProbe: (value: unknown) => void = () => undefined;
    refetchConnectedDevice.mockReturnValue(
      new Promise((resolve) => {
        resolveProbe = resolve;
      }),
    );

    renderNode();
    const button = screen.getByText(START_KEY);
    fireEvent.press(button);
    fireEvent.press(button);

    resolveProbe({ data: { id: "dev-1" } });
    await waitFor(() => expect(startScan).toHaveBeenCalledTimes(1));
  });
});

describe("MeasurementNode in-scan controls", () => {
  it("cancels the in-flight runner effect when the measurement is cancelled", async () => {
    useWorkbookFlowStore.setState({ runnerState: runnerAt("running") });

    renderNode();
    fireEvent.press(screen.getByText(CANCEL_KEY));

    await waitFor(() => expect(cancelScan).toHaveBeenCalled());
  });

  it("renders the ready screen (not scanning) while the gate awaits the tap", () => {
    useWorkbookFlowStore.setState({
      runnerState: runnerAt("running"),
      awaitingScanStart: true,
    });

    renderNode();

    expect(screen.getByText(START_KEY)).toBeTruthy();
    expect(screen.queryByText(CANCEL_KEY)).toBeNull();
  });

  it("aborts the scan when the device drops mid-measurement", async () => {
    useWorkbookFlowStore.setState({ runnerState: runnerAt("running") });

    const { rerender } = renderNode();
    // Re-render inside the same provider tree with the device gone.
    expect(cancelScan).not.toHaveBeenCalled();

    useConnectedDevice.mockReturnValue({ data: undefined, refetch: refetchConnectedDevice });
    rerender(
      <QueryClientProvider client={new QueryClient()}>
        <MeasurementNode content={content} />
      </QueryClientProvider>,
    );

    await waitFor(() => expect(cancelScan).toHaveBeenCalled());
  });
});
