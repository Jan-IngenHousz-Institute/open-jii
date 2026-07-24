import { fireEvent, render, screen, waitFor } from "@testing-library/react-native";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Device } from "~/shared/types/device";

import type { WorkbookCell } from "@repo/api/domains/workbook/workbook-cells.schema";
import type { RuntimeCellOutput } from "@repo/api/transforms/runtime-output";

import { CommandNode } from "./command-node";

const mocks = vi.hoisted(() => ({
  devices: [] as Device[],
  executeCommandOn: vi.fn(),
  nextStep: vi.fn(),
  recordDeviceProducerOutcomes: vi.fn(),
  setScanResults: vi.fn(),
  toastError: vi.fn(),
  logWarn: vi.fn(),
  state: {
    cells: [] as WorkbookCell[],
    workbookVersionId: "version-1",
    executionEpoch: "epoch-1",
    getRuntimeCellOutput: vi.fn<(cellId: string) => RuntimeCellOutput | undefined>(),
  },
}));

vi.mock("~/features/connection/hooks/use-device-connection", () => ({
  useConnectedDevices: () => ({ data: mocks.devices }),
}));
vi.mock("~/features/connection/stores/use-scanner-command-executor-store", () => ({
  useScannerCommandExecutorStore: (selector: (state: unknown) => unknown) =>
    selector({ executeCommandOn: mocks.executeCommandOn }),
}));
vi.mock("~/features/measurement-flow/stores/use-measurement-flow-store", () => ({
  useMeasurementFlowStore: () => ({
    ...mocks.state,
    nextStep: mocks.nextStep,
    recordDeviceProducerOutcomes: mocks.recordDeviceProducerOutcomes,
    setScanResults: mocks.setScanResults,
  }),
}));
vi.mock("~/shared/i18n", () => ({
  useTranslation: () => ({
    t: (key: string, options?: { field?: string }) =>
      key === "measurementFlow:commandNode.run"
        ? "Run command"
        : key === "measurementFlow:commandNode.dynamicSummary"
          ? `Dynamic: ${options?.field}`
          : key,
  }),
}));
vi.mock("~/shared/observability/logger", () => ({
  createLogger: () => ({ warn: mocks.logWarn }),
}));
vi.mock("~/shared/ui/hooks/use-theme", () => ({
  useTheme: () => ({ classes: { text: "", textMuted: "" } }),
}));
vi.mock("sonner-native", () => ({ toast: { error: mocks.toastError } }));

const DEVICE_A: Device = { id: "device-a", name: "Device A", type: "usb" };
const DEVICE_B: Device = { id: "device-b", name: "Device B", type: "usb" };
const RECONNECTED_B: Device = { id: "device-b-new", name: "Device B", type: "usb" };

const sourceCell: WorkbookCell = {
  id: "macro-source",
  type: "macro",
  isCollapsed: false,
  payload: { macroId: "00000000-0000-0000-0000-000000000001", language: "python" },
};
const commandCell: WorkbookCell = {
  id: "command-1",
  type: "command",
  isCollapsed: false,
  payload: { kind: "ref", ref: { sourceCellId: "macro-source", field: "toDevice" } },
};
const content = { kind: "ref", ref: { sourceCellId: "macro-source", field: "toDevice" } } as const;

function deviceOutput(
  results: { deviceId: string; data?: unknown; error?: string }[],
  provenance = { workbookVersionId: "version-1", executionEpoch: "epoch-1" },
): RuntimeCellOutput {
  return { scope: "device", provenance, deviceResults: results };
}

beforeEach(() => {
  vi.clearAllMocks();
  mocks.devices = [DEVICE_A, DEVICE_B];
  mocks.state.cells = [sourceCell, commandCell];
  mocks.state.workbookVersionId = "version-1";
  mocks.state.executionEpoch = "epoch-1";
  mocks.state.getRuntimeCellOutput.mockReturnValue(undefined);
  mocks.executeCommandOn.mockImplementation((deviceId: string, command: string) =>
    Promise.resolve({ ack: `${deviceId}:${command}` }),
  );
});

describe("CommandNode dynamic execution", () => {
  it("resolves and executes once per exact target, previews values, and records replies", async () => {
    const authoredBefore = structuredClone(commandCell);
    mocks.state.getRuntimeCellOutput.mockReturnValue(
      deviceOutput([
        { deviceId: DEVICE_A.id, data: { toDevice: "command-a" } },
        { deviceId: DEVICE_B.id, data: { toDevice: "command-b" } },
      ]),
    );

    render(<CommandNode content={content} nodeId="command-1" />);
    fireEvent.press(screen.getByText("Run command"));

    await waitFor(() => expect(mocks.executeCommandOn).toHaveBeenCalledTimes(2));
    expect(mocks.executeCommandOn).toHaveBeenNthCalledWith(1, DEVICE_A.id, "command-a");
    expect(mocks.executeCommandOn).toHaveBeenNthCalledWith(2, DEVICE_B.id, "command-b");
    expect(screen.getByText("command-a")).toBeTruthy();
    expect(screen.getByText("command-b")).toBeTruthy();
    expect(mocks.recordDeviceProducerOutcomes).toHaveBeenCalledWith("command-1", "command", [
      { device: { id: DEVICE_A.id, name: DEVICE_A.name }, data: { ack: "device-a:command-a" } },
      { device: { id: DEVICE_B.id, name: DEVICE_B.name }, data: { ack: "device-b:command-b" } },
    ]);
    expect(mocks.setScanResults).toHaveBeenCalledWith(
      [
        {
          device: { id: DEVICE_A.id, name: DEVICE_A.name },
          result: { ack: "device-a:command-a" },
          producerCellId: "command-1",
          producerKind: "command",
          dispatchedCommand: "command-a",
          commandSource: { sourceCellId: "macro-source", field: "toDevice" },
          executionEpoch: "epoch-1",
        },
        {
          device: { id: DEVICE_B.id, name: DEVICE_B.name },
          result: { ack: "device-b:command-b" },
          producerCellId: "command-1",
          producerKind: "command",
          dispatchedCommand: "command-b",
          commandSource: { sourceCellId: "macro-source", field: "toDevice" },
          executionEpoch: "epoch-1",
        },
      ],
      "command-1",
    );
    expect(commandCell).toEqual(authoredBefore);
  });

  it("fans a shared question answer out unchanged to every target", async () => {
    const question: WorkbookCell = {
      id: "question-1",
      type: "question",
      isCollapsed: false,
      name: "question",
      question: { kind: "open_ended", text: "Command?", required: true },
      isAnswered: false,
    };
    const sharedCommand: WorkbookCell = {
      ...commandCell,
      payload: { kind: "ref", ref: { sourceCellId: question.id, field: "answer" } },
    };
    mocks.state.cells = [question, sharedCommand];
    mocks.state.getRuntimeCellOutput.mockReturnValue({
      scope: "shared",
      provenance: { workbookVersionId: "version-1", executionEpoch: "epoch-1" },
      data: { answer: "shared-command" },
    });

    render(
      <CommandNode
        content={{ kind: "ref", ref: { sourceCellId: question.id, field: "answer" } }}
        nodeId="command-1"
      />,
    );
    fireEvent.press(screen.getByText("Run command"));

    await waitFor(() => expect(mocks.executeCommandOn).toHaveBeenCalledTimes(2));
    expect(mocks.executeCommandOn.mock.calls.map((call) => call[1])).toEqual([
      "shared-command",
      "shared-command",
    ]);
    expect(mocks.setScanResults).toHaveBeenCalledWith(
      [
        expect.objectContaining({
          device: { id: DEVICE_A.id, name: DEVICE_A.name },
          dispatchedCommand: "shared-command",
          commandSource: { sourceCellId: "question-1", field: "answer" },
          executionEpoch: "epoch-1",
        }),
        expect.objectContaining({
          device: { id: DEVICE_B.id, name: DEVICE_B.name },
          dispatchedCommand: "shared-command",
          commandSource: { sourceCellId: "question-1", field: "answer" },
          executionEpoch: "epoch-1",
        }),
      ],
      "command-1",
    );
  });

  it("keeps static string dispatch compatible and bypasses the output adapter", async () => {
    const staticCell: WorkbookCell = {
      id: "command-1",
      type: "command",
      isCollapsed: false,
      payload: { format: "string", content: "battery" },
    };
    mocks.devices = [DEVICE_A];
    mocks.state.cells = [staticCell];

    render(<CommandNode content={{ format: "string", content: "battery" }} nodeId="command-1" />);
    fireEvent.press(screen.getByText("Run command"));

    await waitFor(() =>
      expect(mocks.executeCommandOn).toHaveBeenCalledWith(DEVICE_A.id, "battery"),
    );
    expect(mocks.state.getRuntimeCellOutput).not.toHaveBeenCalled();
    expect(mocks.setScanResults).toHaveBeenCalledWith(
      [
        {
          device: { id: DEVICE_A.id, name: DEVICE_A.name },
          result: { ack: "device-a:battery" },
          producerCellId: "command-1",
          producerKind: "command",
          dispatchedCommand: "battery",
          executionEpoch: "epoch-1",
        },
      ],
      "command-1",
    );
  });

  it("pre-fails only a missing exact device and never falls back", async () => {
    mocks.state.getRuntimeCellOutput.mockReturnValue(
      deviceOutput([{ deviceId: DEVICE_A.id, data: { toDevice: "command-a" } }]),
    );

    render(<CommandNode content={content} nodeId="command-1" />);
    fireEvent.press(screen.getByText("Run command"));

    await waitFor(() => expect(mocks.executeCommandOn).toHaveBeenCalledOnce());
    expect(mocks.executeCommandOn).toHaveBeenCalledWith(DEVICE_A.id, "command-a");
    expect(
      screen.getByText("measurementFlow:commandNode.resolution.DEVICE_OUTPUT_MISSING"),
    ).toBeTruthy();
    expect(mocks.setScanResults).toHaveBeenCalledWith(
      [
        {
          device: { id: DEVICE_A.id, name: DEVICE_A.name },
          result: { ack: "device-a:command-a" },
          producerCellId: "command-1",
          producerKind: "command",
          dispatchedCommand: "command-a",
          commandSource: { sourceCellId: "macro-source", field: "toDevice" },
          executionEpoch: "epoch-1",
        },
      ],
      "command-1",
    );
  });

  it("projects only successful replies while recording partial transport failures", async () => {
    mocks.state.getRuntimeCellOutput.mockReturnValue(
      deviceOutput([
        { deviceId: DEVICE_A.id, data: { toDevice: "command-a" } },
        { deviceId: DEVICE_B.id, data: { toDevice: "command-b" } },
      ]),
    );
    mocks.executeCommandOn.mockImplementation((deviceId: string) =>
      deviceId === DEVICE_A.id
        ? Promise.resolve("reply-a")
        : Promise.reject(new Error("raw-transport-secret")),
    );

    render(<CommandNode content={content} nodeId="command-1" />);
    fireEvent.press(screen.getByText("Run command"));

    await waitFor(() => expect(mocks.executeCommandOn).toHaveBeenCalledTimes(2));
    expect(mocks.setScanResults).toHaveBeenCalledWith(
      [
        {
          device: { id: DEVICE_A.id, name: DEVICE_A.name },
          result: { response: "reply-a" },
          producerCellId: "command-1",
          producerKind: "command",
          dispatchedCommand: "command-a",
          commandSource: { sourceCellId: "macro-source", field: "toDevice" },
          executionEpoch: "epoch-1",
        },
      ],
      "command-1",
    );
    expect(mocks.recordDeviceProducerOutcomes).toHaveBeenCalledWith("command-1", "command", [
      { device: { id: DEVICE_A.id, name: DEVICE_A.name }, data: "reply-a" },
      {
        device: { id: DEVICE_B.id, name: DEVICE_B.name },
        error: "COMMAND_EXECUTION_FAILED",
      },
    ]);
    expect(JSON.stringify(mocks.logWarn.mock.calls)).not.toContain("raw-transport-secret");
  });

  it.each([
    ["branch-skipped", undefined, "COMMAND_OUTPUT_MISSING"],
    [
      "stale",
      deviceOutput([{ deviceId: DEVICE_A.id, data: { toDevice: "stale-secret" } }], {
        workbookVersionId: "version-1",
        executionEpoch: "old-epoch",
      }),
      "COMMAND_SOURCE_STALE",
    ],
    [
      "source-error",
      deviceOutput([{ deviceId: DEVICE_A.id, error: "raw-driver-secret" }]),
      "SOURCE_DEVICE_FAILED",
    ],
  ] as const)("makes no device call for %s source state", async (_name, output, code) => {
    mocks.devices = [DEVICE_A];
    mocks.state.getRuntimeCellOutput.mockReturnValue(output);

    render(<CommandNode content={content} nodeId="command-1" />);
    fireEvent.press(screen.getByText("Run command"));

    await waitFor(() =>
      expect(screen.getByText(`measurementFlow:commandNode.resolution.${code}`)).toBeTruthy(),
    );
    expect(mocks.executeCommandOn).not.toHaveBeenCalled();
    expect(JSON.stringify(mocks.logWarn.mock.calls)).not.toContain("stale-secret");
    expect(JSON.stringify(mocks.logWarn.mock.calls)).not.toContain("raw-driver-secret");
  });

  it("requires a reconnected device with a new runtime id to rerun the source", async () => {
    mocks.devices = [RECONNECTED_B];
    mocks.state.getRuntimeCellOutput.mockReturnValue(
      deviceOutput([{ deviceId: DEVICE_B.id, data: { toDevice: "old-device-command" } }]),
    );

    render(<CommandNode content={content} nodeId="command-1" />);
    fireEvent.press(screen.getByText("Run command"));

    await waitFor(() =>
      expect(
        screen.getByText("measurementFlow:commandNode.resolution.DEVICE_OUTPUT_MISSING"),
      ).toBeTruthy(),
    );
    expect(mocks.executeCommandOn).not.toHaveBeenCalled();
  });

  it("executes from a fresh persisted command reply after offline resume", async () => {
    const firstCommand: WorkbookCell = {
      id: "command-source",
      type: "command",
      isCollapsed: false,
      payload: { format: "string", content: "first" },
    };
    const chainedCommand: WorkbookCell = {
      id: "command-1",
      type: "command",
      isCollapsed: false,
      payload: { kind: "ref", ref: { sourceCellId: firstCommand.id, field: "response" } },
    };
    mocks.devices = [DEVICE_A];
    mocks.state.cells = [firstCommand, chainedCommand];
    mocks.state.getRuntimeCellOutput.mockReturnValue(
      deviceOutput([{ deviceId: DEVICE_A.id, data: { response: "follow-up" } }]),
    );

    render(
      <CommandNode
        content={{ kind: "ref", ref: { sourceCellId: firstCommand.id, field: "response" } }}
        nodeId="command-1"
      />,
    );
    fireEvent.press(screen.getByText("Run command"));

    await waitFor(() =>
      expect(mocks.executeCommandOn).toHaveBeenCalledWith(DEVICE_A.id, "follow-up"),
    );
  });

  it("clears the resolved preview when cycle provenance changes", async () => {
    mocks.devices = [DEVICE_A];
    mocks.state.getRuntimeCellOutput.mockReturnValue(
      deviceOutput([{ deviceId: DEVICE_A.id, data: { toDevice: "cycle-secret" } }]),
    );
    const view = render(<CommandNode content={content} nodeId="command-1" />);
    fireEvent.press(screen.getByText("Run command"));
    await waitFor(() => expect(screen.getByText("cycle-secret")).toBeTruthy());

    mocks.state.executionEpoch = "epoch-2";
    view.rerender(<CommandNode content={content} nodeId="command-1" />);

    await waitFor(() => expect(screen.queryByText("cycle-secret")).toBeNull());
  });
});
