import { act, renderHook } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { MultiScanRound } from "~/features/connection/services/scan-manager/execute-scan-assignments";

import { useMeasurementCapture } from "./use-measurement-capture";

const mocks = vi.hoisted(() => {
  const startRunnerScan = vi.fn();
  const continueRunnerWithSuccesses = vi.fn();
  const cancelRunnerScan = vi.fn();
  const navigateToQuestionFromOverview = vi.fn();
  const flowState = {
    runnerState: { status: "awaitingInput" },
    awaitingScanStart: true,
    runnerScanRound: undefined as MultiScanRound | undefined,
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
  const refetch = vi.fn();
  const connection = { devices: [] as { id: string; name: string; type: "usb" }[] };
  const toastError = vi.fn();
  return { flowState, scannerState, refetch, connection, toastError };
});

vi.mock("~/features/measurement-flow/stores/use-measurement-flow-store", () => ({
  useMeasurementFlowStore: () => mocks.flowState,
}));
vi.mock("~/features/connection/stores/use-scanner-command-executor-store", () => ({
  useScannerCommandExecutorStore: (selector: (state: typeof mocks.scannerState) => unknown) =>
    selector(mocks.scannerState),
}));
vi.mock("~/features/connection/hooks/use-device-connection", () => ({
  useConnectedDevices: () => ({ data: mocks.connection.devices, refetch: mocks.refetch }),
}));
vi.mock("~/features/connection/stores/use-device-sheet-store", () => ({
  useDeviceSheetStore: (selector: (state: { open: () => void }) => unknown) =>
    selector({ open: vi.fn() }),
}));
vi.mock("sonner-native", () => ({ toast: { error: mocks.toastError } }));
vi.mock("~/shared/i18n", () => ({ useTranslation: () => ({ t: (key: string) => key }) }));

beforeEach(() => {
  vi.clearAllMocks();
  mocks.connection.devices = [{ id: "a", name: "Device A", type: "usb" }];
  mocks.refetch.mockResolvedValue({ data: mocks.connection.devices });
  mocks.flowState.runnerState = { status: "awaitingInput" };
  mocks.flowState.awaitingScanStart = true;
  mocks.flowState.runnerScanRound = undefined;
  mocks.flowState.runnerSucceededCount = 0;
});

describe("useMeasurementCapture runner mapping", () => {
  it("starts an inline command without applying protocol-only validation", async () => {
    const { result } = renderHook(() =>
      useMeasurementCapture({ command: { format: "string", content: "battery" } }, "command-1"),
    );
    await act(() => result.current.startScan());
    expect(mocks.flowState.startRunnerScan).toHaveBeenCalledWith("command-1");
    expect(mocks.toastError).not.toHaveBeenCalled();
  });

  it("addresses run and cancel actions to the owning lane track", async () => {
    const { result } = renderHook(() =>
      useMeasurementCapture(
        { command: { format: "string", content: "battery" } },
        "command-1",
        "track-a",
      ),
    );
    await act(() => result.current.startScan());
    act(() => result.current.cancelScan());

    expect(mocks.flowState.startRunnerScan).toHaveBeenCalledWith("command-1", "track-a");
    expect(mocks.flowState.cancelRunnerScan).toHaveBeenCalledWith("track-a");
  });

  it("retains the protocol availability guard", async () => {
    const { result } = renderHook(() =>
      useMeasurementCapture({ protocolId: "protocol-1" }, "protocol-cell"),
    );
    await act(() => result.current.startScan());
    expect(mocks.toastError).toHaveBeenCalledWith(
      "measurementFlow:measurementNode.toast.protocolUnavailable",
    );
    expect(mocks.flowState.startRunnerScan).not.toHaveBeenCalled();
  });

  it("blocks before the runner gate when no device is connected", async () => {
    mocks.connection.devices = [];
    const { result } = renderHook(() =>
      useMeasurementCapture({ command: { format: "string", content: "battery" } }, "command-1"),
    );
    await act(() => result.current.startScan());
    expect(mocks.toastError).toHaveBeenCalledWith(
      "measurementFlow:measurementNode.toast.notConnected",
    );
    expect(mocks.refetch).not.toHaveBeenCalled();
  });

  it("maps partial state and actions directly from the runner store", () => {
    mocks.flowState.runnerScanRound = {
      successes: [{ device: mocks.connection.devices[0], result: { ok: true } }],
      failures: [{ device: { id: "b", name: "B", type: "usb" }, error: new Error("lost") }],
    };
    mocks.flowState.runnerSucceededCount = 1;
    const { result } = renderHook(() =>
      useMeasurementCapture({ command: { format: "string", content: "battery" } }, "command-1"),
    );

    expect(result.current.lastRound).toBe(mocks.flowState.runnerScanRound);
    expect(result.current.succeededCount).toBe(1);
    act(() => result.current.completeWithSuccesses());
    act(() => result.current.cancelScan());
    expect(mocks.flowState.continueRunnerWithSuccesses).toHaveBeenCalled();
    expect(mocks.flowState.cancelRunnerScan).toHaveBeenCalled();
  });
});
