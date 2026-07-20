// @vitest-environment jsdom
import { act, renderHook, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { MeasurementContent } from "~/shared/measurements/flow-node";
import type { Device } from "~/shared/types/device";

import { useMeasurementCapture } from "./use-measurement-capture";

const mocks = vi.hoisted(() => {
  const flowState = {
    nextStep: vi.fn(),
    setScanResults: vi.fn(),
    navigateToQuestionFromOverview: vi.fn(),
    devicePlan: undefined as { deviceId: string; targetCellId: string }[] | undefined,
    completeDevicePlan: vi.fn(),
    flowNodes: [] as {
      id: string;
      name: string;
      type: string;
      content: unknown;
      isStart: boolean;
    }[],
  };
  const useMeasurementFlowStore = vi.fn(() => flowState);
  Object.assign(useMeasurementFlowStore, { getState: () => flowState });

  return {
    devices: [] as Device[],
    refetchConnectedDevices: vi.fn(),
    executeScanAll: vi.fn(),
    executeScanAssignments: vi.fn(),
    resetScan: vi.fn(),
    cancelAll: vi.fn(),
    openDeviceSheet: vi.fn(),
    playSound: vi.fn(),
    logWarn: vi.fn(),
    logError: vi.fn(),
    toastError: vi.fn(),
    resolveInlineCommand: vi.fn(),
    flowState,
    useMeasurementFlowStore,
    isScanning: false,
  };
});

vi.mock("~/features/connection/hooks/use-device-connection", () => ({
  useConnectedDevices: () => ({
    data: mocks.devices,
    refetch: mocks.refetchConnectedDevices,
  }),
}));
vi.mock("~/features/connection/hooks/use-multi-scanner", () => ({
  useMultiScanner: () => ({
    executeScanAll: mocks.executeScanAll,
    executeScanAssignments: mocks.executeScanAssignments,
    isScanning: mocks.isScanning,
    deviceStates: [],
    lastRound: null,
    reset: mocks.resetScan,
    cancelAll: mocks.cancelAll,
  }),
}));
vi.mock("~/features/connection/stores/use-device-sheet-store", () => ({
  useDeviceSheetStore: (selector: (state: { open: () => void }) => unknown) =>
    selector({ open: mocks.openDeviceSheet }),
}));
vi.mock("~/features/connection/stores/use-scanner-command-executor-store", () => ({
  useScannerCommandExecutorStore: (
    selector: (state: { progress: number; scanStartedAt: number; estimatedMs: number }) => unknown,
  ) => selector({ progress: 0, scanStartedAt: 0, estimatedMs: 0 }),
}));
vi.mock("~/features/measurement-flow/stores/use-measurement-flow-store", () => ({
  useMeasurementFlowStore: mocks.useMeasurementFlowStore,
}));
vi.mock("~/features/measurement-flow/utils/play-sound", () => ({
  playSound: mocks.playSound,
}));
vi.mock("~/features/connection/utils/classify-scan-error", () => ({
  classifyScanError: () => "unknown",
}));
vi.mock("~/shared/i18n", () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));
vi.mock("~/shared/observability/logger", () => ({
  createLogger: () => ({ warn: mocks.logWarn, error: mocks.logError }),
}));
vi.mock("sonner-native", () => ({ toast: { error: mocks.toastError } }));
vi.mock("@repo/api/transforms/command-payload", () => ({
  resolveInlineCommand: mocks.resolveInlineCommand,
}));

const DEVICE_A: Device = { id: "usb-a", type: "usb", name: "Device A" };
const DEVICE_B: Device = { id: "usb-b", type: "usb", name: "Device B" };
const DEVICE_C: Device = { id: "usb-c", type: "usb", name: "Device C" };
const DEVICE_D: Device = { id: "usb-d", type: "usb", name: "Device D" };
const DEVICE_E: Device = { id: "usb-e", type: "usb", name: "Device E" };

const CONTENT: MeasurementContent = {
  protocolId: "shared-protocol",
  protocol: { code: [{ set: [] }], name: "Shared protocol" },
};

describe("useMeasurementCapture", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.devices = [DEVICE_A, DEVICE_B];
    mocks.isScanning = false;
    mocks.refetchConnectedDevices.mockResolvedValue({ data: [DEVICE_A, DEVICE_B] });
    mocks.cancelAll.mockResolvedValue(undefined);
    mocks.playSound.mockResolvedValue(undefined);
    mocks.resolveInlineCommand.mockImplementation((command: { content: string }) => {
      if (command.content === "bad") throw new Error("invalid inline command");
      return `resolved:${command.content}`;
    });
    Object.assign(mocks.flowState, {
      devicePlan: undefined,
      flowNodes: [],
    });
  });

  it("records a successful broadcast round in connection order and advances", async () => {
    mocks.executeScanAll.mockResolvedValue({
      successes: [
        { device: DEVICE_B, result: { value: 2 } },
        { device: DEVICE_A, result: { value: 1 } },
      ],
      failures: [],
    });
    const { result } = renderHook(() => useMeasurementCapture(CONTENT, "measurement-cell"));

    await act(async () => result.current.startScan());

    expect(mocks.executeScanAll).toHaveBeenCalledWith(CONTENT.protocol, [DEVICE_A, DEVICE_B]);
    expect(mocks.flowState.setScanResults).toHaveBeenCalledWith(
      [
        { device: { id: "usb-a", name: "Device A" }, result: { value: 1 } },
        { device: { id: "usb-b", name: "Device B" }, result: { value: 2 } },
      ],
      "measurement-cell",
    );
    expect(mocks.resetScan).toHaveBeenCalledOnce();
    expect(mocks.playSound).toHaveBeenCalledOnce();
    expect(mocks.flowState.nextStep).toHaveBeenCalledOnce();
  });

  it("resolves each dispatch target independently and preserves payload provenance", async () => {
    mocks.devices = [DEVICE_A, DEVICE_B, DEVICE_C, DEVICE_D, DEVICE_E];
    mocks.refetchConnectedDevices.mockResolvedValue({ data: mocks.devices });
    mocks.flowState.devicePlan = mocks.devices.map((device, index) => ({
      deviceId: device.id,
      targetCellId: `target-${index + 1}`,
    }));
    mocks.flowState.flowNodes = [
      {
        id: "target-1",
        name: "Protocol target",
        type: "measurement",
        content: {
          protocolId: "proto-a",
          protocol: { code: [{ set: [{ label: "a" }] }], name: "Protocol A" },
        },
        isStart: false,
      },
      {
        id: "target-2",
        name: "Command target",
        type: "measurement",
        content: { command: { format: "string", content: "status" } },
        isStart: false,
      },
      // target-3 is deliberately absent from the hydrated flow.
      {
        id: "target-4",
        name: "Bad command",
        type: "measurement",
        content: { command: { format: "string", content: "bad" } },
        isStart: false,
      },
      {
        id: "target-5",
        name: "Missing protocol",
        type: "measurement",
        content: { protocolId: "proto-missing" },
        isStart: false,
      },
    ];
    mocks.executeScanAssignments.mockImplementation((assignments, prefailed) =>
      Promise.resolve({
        successes: assignments.map(({ device }: { device: Device }, index: number) => ({
          device,
          result: { value: index + 1 },
        })),
        failures: prefailed,
      }),
    );
    const { result } = renderHook(() => useMeasurementCapture({}, "target-1"));

    await act(async () => result.current.startScan());

    const [assignments, prefailed] = mocks.executeScanAssignments.mock.calls[0];
    expect(assignments).toEqual([
      {
        device: DEVICE_A,
        command: [{ set: [{ label: "a" }] }],
        protocolId: "proto-a",
        protocolName: "Protocol A",
      },
      { device: DEVICE_B, command: "resolved:status", protocolName: "Command target" },
    ]);
    expect(
      prefailed.map(({ device, error }: { device: Device; error: Error }) => [
        device.id,
        error.message,
      ]),
    ).toEqual([
      ["usb-c", "Dispatch target is not part of this flow"],
      ["usb-d", "invalid inline command"],
      ["usb-e", "Protocol code is unavailable for this dispatch target"],
    ]);

    act(() => result.current.completeWithSuccesses());

    expect(mocks.flowState.setScanResults).toHaveBeenCalledWith(
      [
        {
          device: { id: "usb-a", name: "Device A" },
          result: { value: 1 },
          protocolId: "proto-a",
          protocolName: "Protocol A",
        },
        {
          device: { id: "usb-b", name: "Device B" },
          result: { value: 2 },
          protocolId: undefined,
          protocolName: "Command target",
        },
      ],
      "target-1",
    );
    expect(mocks.flowState.completeDevicePlan).toHaveBeenCalledOnce();
  });

  it("blocks immediately when no device is connected", async () => {
    mocks.devices = [];
    const { result } = renderHook(() => useMeasurementCapture(CONTENT));

    await act(async () => result.current.startScan());

    expect(mocks.toastError).toHaveBeenCalledWith(
      "measurementFlow:measurementNode.toast.notConnected",
    );
    expect(mocks.refetchConnectedDevices).not.toHaveBeenCalled();
  });

  it("turns an unexpected scan rejection into the coherent scan error", async () => {
    mocks.executeScanAll.mockRejectedValue(new Error("executor exploded"));
    const { result } = renderHook(() => useMeasurementCapture(CONTENT));

    await act(async () => result.current.startScan());

    expect(mocks.logError).toHaveBeenCalledWith("scan error", { err: "executor exploded" });
    expect(mocks.toastError).toHaveBeenCalledWith(
      "measurementFlow:measurementNode.toast.scanError",
    );
  });

  it("cancels before resetting when all devices disconnect during a scan", async () => {
    mocks.devices = [];
    mocks.isScanning = true;

    renderHook(() => useMeasurementCapture(CONTENT));

    await waitFor(() => expect(mocks.cancelAll).toHaveBeenCalledOnce());
    expect(mocks.cancelAll.mock.invocationCallOrder[0]).toBeLessThan(
      mocks.resetScan.mock.invocationCallOrder[0],
    );
  });
});
