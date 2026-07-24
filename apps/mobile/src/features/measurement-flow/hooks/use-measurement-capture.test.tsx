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
    recordDeviceProducerOutcomes: vi.fn(),
    flowNodes: [] as {
      id: string;
      name: string;
      type: string;
      content: unknown;
      isStart: boolean;
    }[],
    cells: [] as Record<string, unknown>[],
    workbookVersionId: "version-1",
    executionEpoch: "epoch-1",
    getRuntimeCellOutput: vi.fn(),
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
    resolveCommandPayload: vi.fn(),
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
  resolveCommandPayload: mocks.resolveCommandPayload,
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
    mocks.resolveCommandPayload.mockImplementation(
      ({ commandCell }: { commandCell: { id: string } }) => {
        if (commandCell.id === "target-4") {
          return {
            ok: false,
            error: { code: "STATIC_COMMAND_INVALID", commandCellId: commandCell.id },
          };
        }
        return { ok: true, value: "resolved:status" };
      },
    );
    Object.assign(mocks.flowState, {
      devicePlan: undefined,
      flowNodes: [],
      cells: [],
      workbookVersionId: "version-1",
      executionEpoch: "epoch-1",
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
        {
          device: { id: "usb-a", name: "Device A" },
          result: { value: 1 },
          producerCellId: "measurement-cell",
          producerKind: "protocol",
          executionEpoch: "epoch-1",
        },
        {
          device: { id: "usb-b", name: "Device B" },
          result: { value: 2 },
          producerCellId: "measurement-cell",
          producerKind: "protocol",
          executionEpoch: "epoch-1",
        },
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
    mocks.flowState.cells = [
      {
        id: "target-2",
        type: "command",
        isCollapsed: false,
        payload: { format: "string", content: "status" },
      },
      {
        id: "target-4",
        type: "command",
        isCollapsed: false,
        payload: { format: "string", content: "bad" },
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
        producerCellId: "target-1",
        producerKind: "protocol",
        protocolId: "proto-a",
        protocolName: "Protocol A",
      },
      {
        device: DEVICE_B,
        command: "resolved:status",
        producerCellId: "target-2",
        producerKind: "command",
        protocolName: "Command target",
      },
    ]);
    expect(
      prefailed.map(({ device, error }: { device: Device; error: Error }) => [
        device.id,
        error.message,
      ]),
    ).toEqual([
      ["usb-c", "Dispatch target is not part of this flow"],
      ["usb-d", "measurementFlow:commandNode.resolution.STATIC_COMMAND_INVALID"],
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
          producerCellId: "target-1",
          producerKind: "protocol",
          executionEpoch: "epoch-1",
        },
        {
          device: { id: "usb-b", name: "Device B" },
          result: { value: 2 },
          protocolId: undefined,
          protocolName: "Command target",
          producerCellId: "target-2",
          producerKind: "command",
          dispatchedCommand: "resolved:status",
          executionEpoch: "epoch-1",
        },
      ],
      undefined,
    );
    expect(mocks.flowState.recordDeviceProducerOutcomes).toHaveBeenCalledWith(
      "target-1",
      "protocol",
      [{ device: { id: "usb-a", name: "Device A" }, data: { value: 1 } }],
    );
    expect(mocks.flowState.recordDeviceProducerOutcomes).toHaveBeenCalledWith(
      "target-2",
      "command",
      [{ device: { id: "usb-b", name: "Device B" }, data: { value: 2 } }],
    );
    expect(mocks.flowState.completeDevicePlan).toHaveBeenCalledOnce();
  });

  it("pre-fails only the invalid branch device while its exact-device peer continues", async () => {
    mocks.flowState.devicePlan = [
      { deviceId: DEVICE_A.id, targetCellId: "dynamic-command" },
      { deviceId: DEVICE_B.id, targetCellId: "dynamic-command" },
    ];
    mocks.flowState.flowNodes = [
      {
        id: "dynamic-command",
        name: "Dynamic command",
        type: "measurement",
        content: {
          command: { kind: "ref", ref: { sourceCellId: "macro-source", field: "toDevice" } },
        },
        isStart: false,
      },
    ];
    mocks.flowState.cells = [
      {
        id: "macro-source",
        type: "macro",
        isCollapsed: false,
        payload: { macroId: "00000000-0000-0000-0000-000000000001", language: "python" },
      },
      {
        id: "dynamic-command",
        type: "command",
        isCollapsed: false,
        payload: {
          kind: "ref",
          ref: { sourceCellId: "macro-source", field: "toDevice" },
        },
      },
    ];
    mocks.resolveCommandPayload.mockImplementation(
      ({ targetDeviceId }: { targetDeviceId: string }) =>
        targetDeviceId === DEVICE_A.id
          ? { ok: true, value: "command-for-a" }
          : {
              ok: false,
              error: {
                code: "DEVICE_OUTPUT_MISSING",
                commandCellId: "dynamic-command",
                sourceCellId: "macro-source",
                targetDeviceId,
              },
            },
    );
    mocks.executeScanAssignments.mockImplementation((assignments, prefailed) =>
      Promise.resolve({
        successes: assignments.map(({ device }: { device: Device }) => ({
          device,
          result: { response: "ok" },
          producerCellId: "dynamic-command",
          producerKind: "command",
        })),
        failures: prefailed,
      }),
    );
    const { result } = renderHook(() => useMeasurementCapture({}, "dynamic-command"));

    await act(async () => result.current.startScan());

    expect(mocks.resolveCommandPayload).toHaveBeenCalledTimes(2);
    const [assignments, prefailed] = mocks.executeScanAssignments.mock.calls[0];
    expect(assignments).toEqual([
      {
        device: DEVICE_A,
        command: "command-for-a",
        producerCellId: "dynamic-command",
        producerKind: "command",
        protocolName: "Dynamic command",
        commandSource: { sourceCellId: "macro-source", field: "toDevice" },
      },
    ]);
    expect(prefailed).toHaveLength(1);
    expect(prefailed[0].device).toBe(DEVICE_B);
    expect(prefailed[0].error).toMatchObject({
      failure: { code: "DEVICE_OUTPUT_MISSING", targetDeviceId: DEVICE_B.id },
    });
    expect(result.current.commandDispatchPreviews).toEqual([
      {
        deviceId: DEVICE_A.id,
        deviceName: DEVICE_A.name,
        resolved: "command-for-a",
      },
      {
        deviceId: DEVICE_B.id,
        deviceName: DEVICE_B.name,
        error: "measurementFlow:commandNode.resolution.DEVICE_OUTPUT_MISSING",
      },
    ]);
    expect(mocks.flowState.recordDeviceProducerOutcomes).not.toHaveBeenCalled();

    act(() => result.current.completeWithSuccesses());
    expect(mocks.flowState.setScanResults).toHaveBeenCalledWith(
      [
        {
          device: { id: DEVICE_A.id, name: DEVICE_A.name },
          result: { response: "ok" },
          protocolId: undefined,
          protocolName: "Dynamic command",
          producerCellId: "dynamic-command",
          producerKind: "command",
          dispatchedCommand: "command-for-a",
          commandSource: { sourceCellId: "macro-source", field: "toDevice" },
          executionEpoch: "epoch-1",
        },
      ],
      undefined,
    );
  });

  it("records an executed branch command transport failure under its exact producer", async () => {
    mocks.devices = [DEVICE_A];
    mocks.refetchConnectedDevices.mockResolvedValue({ data: [DEVICE_A] });
    mocks.flowState.devicePlan = [{ deviceId: DEVICE_A.id, targetCellId: "dynamic-command" }];
    mocks.flowState.flowNodes = [
      {
        id: "dynamic-command",
        name: "Dynamic command",
        type: "measurement",
        content: {
          command: { kind: "ref", ref: { sourceCellId: "macro-source", field: "toDevice" } },
        },
        isStart: false,
      },
    ];
    mocks.flowState.cells = [
      {
        id: "macro-source",
        type: "macro",
        isCollapsed: false,
        payload: { macroId: "00000000-0000-0000-0000-000000000001", language: "python" },
      },
      {
        id: "dynamic-command",
        type: "command",
        isCollapsed: false,
        payload: {
          kind: "ref",
          ref: { sourceCellId: "macro-source", field: "toDevice" },
        },
      },
    ];
    mocks.resolveCommandPayload.mockReturnValue({ ok: true, value: "command-for-a" });
    mocks.executeScanAssignments.mockResolvedValue({
      successes: [],
      failures: [
        {
          device: DEVICE_A,
          error: new Error("raw-transport-secret"),
          producerCellId: "dynamic-command",
          producerKind: "command",
          wasDispatched: true,
        },
      ],
    });
    const { result } = renderHook(() => useMeasurementCapture({}, "dynamic-command"));

    await act(async () => result.current.startScan());

    expect(mocks.flowState.recordDeviceProducerOutcomes).toHaveBeenCalledWith(
      "dynamic-command",
      "command",
      [
        {
          device: { id: DEVICE_A.id, name: DEVICE_A.name },
          error: "COMMAND_EXECUTION_FAILED",
        },
      ],
    );
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
