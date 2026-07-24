import {
  createBranchCell,
  createCommandCell,
  createMacroCell,
  createMarkdownCell,
  createOutputCell,
  createProtocol,
  createProtocolCell,
  createQuestionCell,
} from "@/test/factories";
import { API_URL } from "@/test/msw/mount";
import { server } from "@/test/msw/server";
import { renderHook, act } from "@/test/test-utils";
import { http, HttpResponse } from "msw";
import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  __resetProtocolCodeRegistry,
  registerProtocolCodeSource,
} from "~/lib/protocol-code-registry";

import { contract } from "@repo/api/contract";
import type { QuestionCell, WorkbookCell } from "@repo/api/domains/workbook/workbook-cells.schema";

import type { IotDeviceConnection } from "../../iot/useIotConnections/useIotConnections";
import { applyExecutionDelta, useWorkbookExecution } from "./useWorkbookExecution";

const mockExecuteProtocol = vi.fn();
const mockExecuteCommand = vi.fn();
const mockConnect = vi.fn();
const mockDisconnect = vi.fn();

// One entry per connected device; single-entry = legacy single-device runs.
function mockConnection(id: string, label: string): IotDeviceConnection {
  return {
    id,
    label,
    family: "multispeq" as const,
    identity: { family: "multispeq" as const, name: label, raw: {} },
    driver: {} as IotDeviceConnection["driver"],
  };
}
let mockConnections: IotDeviceConnection[] = [];

vi.mock("~/hooks/iot/useIotConnections/useIotConnections", () => ({
  useIotConnections: () => ({
    connections: mockConnections,
    isConnecting: false,
    error: null,
    connect: mockConnect,
    disconnectDevice: vi.fn(),
    disconnectAll: mockDisconnect,
  }),
}));

vi.mock("~/hooks/iot/useIotProtocolExecution/useIotProtocolExecution", () => ({
  executeProtocolWithDriver: (_driver: unknown, _family: unknown, code: unknown): unknown =>
    mockExecuteProtocol(code) as unknown,
  executeCommandWithDriver: (_driver: unknown, command: unknown): unknown =>
    mockExecuteCommand(command) as unknown,
}));

// Durable client telemetry sink. Assert allowlisted fields + production silence.
const mockCapture = vi.fn();
vi.mock("posthog-js/react", () => ({
  usePostHog: () => ({ capture: mockCapture }),
}));

// Control NODE_ENV per test without breaking the rest of the validated env.
const envState = { NODE_ENV: "test" as string };
vi.mock("~/env", async (importOriginal) => {
  const actual = await importOriginal<{ env: Record<string, unknown> }>();
  return {
    ...actual,
    env: new Proxy(actual.env, {
      get: (target, prop) =>
        prop === "NODE_ENV" ? envState.NODE_ENV : (Reflect.get(target, prop) as unknown),
    }),
  };
});

function setMockConnected(connected: boolean) {
  mockConnections = connected ? [mockConnection("dev-1", "Device #1")] : [];
}

interface RenderProps {
  cells: WorkbookCell[];
  workbookId?: string;
}

function renderExecution(
  cells: WorkbookCell[],
  overrides: Partial<Parameters<typeof useWorkbookExecution>[0]> = {},
) {
  // Model the host: execution commits arrive as pure transforms applied to the
  // latest committed cells. `getCells()` returns that running state.
  let committed = cells;
  const onCellsChange = vi.fn((update: (latest: WorkbookCell[]) => WorkbookCell[]) => {
    committed = update(committed);
  });
  const result = renderHook<ReturnType<typeof useWorkbookExecution>, RenderProps>(
    (props) =>
      useWorkbookExecution({
        onCellsChange,
        ...overrides,
        cells: props.cells,
        workbookId: props.workbookId ?? "wb-1",
      }),
    { initialProps: { cells } },
  );
  return { ...result, onCellsChange, getCells: () => committed };
}

function findOutput(cells: WorkbookCell[], producedBy?: string) {
  const output = cells.find(
    (c) => c.type === "output" && (producedBy ? c.producedBy === producedBy : true),
  );
  if (output?.type !== "output") return undefined;
  return output;
}

describe("useWorkbookExecution", () => {
  beforeEach(() => {
    mockConnections = [];
    mockExecuteProtocol.mockReset();
    mockExecuteCommand.mockReset();
    mockConnect.mockReset();
    mockDisconnect.mockReset();
    mockCapture.mockReset();
    envState.NODE_ENV = "test";
    __resetProtocolCodeRegistry();
  });

  it("exposes role-neutral presentation metadata for every connected device", () => {
    mockConnections = [
      {
        ...mockConnection("connection-1", "Device #2"),
        ordinal: 2,
        family: "ambit",
        identity: {
          family: "ambit",
          name: "Canopy probe",
          deviceId: "AMB-42",
          raw: {},
        },
      },
    ];

    const { result } = renderExecution([]);

    expect(result.current.connectedDevices).toEqual([
      {
        id: "connection-1",
        label: "Device #2",
        ordinal: 2,
        family: "ambit",
        name: "Canopy probe",
        stableId: "AMB-42",
      },
    ]);
  });

  it("clearOutputs removes all output cells", () => {
    const proto = createProtocolCell();
    const output = createOutputCell({ producedBy: proto.id });
    const macro = createMacroCell();
    const cells: WorkbookCell[] = [proto, output, macro];

    const { result, getCells } = renderExecution(cells);

    act(() => result.current.clearOutputs());

    const updated = getCells();
    expect(updated.every((c) => c.type !== "output")).toBe(true);
    expect(updated).toHaveLength(2);
  });

  describe("runCell - protocol", () => {
    it("errors when protocol has no code", async () => {
      const proto = createProtocolCell();
      const protocol = createProtocol({
        id: proto.payload.protocolId,
        code: [],
      });
      server.mount(contract.protocols.getProtocol, { body: protocol });

      const { result, getCells } = renderExecution([proto]);

      await act(() => result.current.runCell(proto.id));

      const updated = getCells();
      const outputCell = findOutput(updated);
      expect(outputCell).toBeDefined();
      expect(outputCell?.messages).toContain("Invalid or missing protocol JSON");
    });

    it("errors when no device is connected", async () => {
      const proto = createProtocolCell();
      const protocol = createProtocol({
        id: proto.payload.protocolId,
        code: [{ _protocol_set_: [] }],
      });
      server.mount(contract.protocols.getProtocol, { body: protocol });
      setMockConnected(false);

      const { result, getCells } = renderExecution([proto]);

      await act(() => result.current.runCell(proto.id));

      const updated = getCells();
      const outputCell = findOutput(updated);
      expect(outputCell?.messages).toEqual(
        expect.arrayContaining([expect.stringContaining("No device connected")]),
      );
    });

    it("executes protocol and produces output cell", async () => {
      const proto = createProtocolCell();
      const protocol = createProtocol({
        id: proto.payload.protocolId,
        code: [{ _protocol_set_: [] }],
      });
      server.mount(contract.protocols.getProtocol, { body: protocol });
      setMockConnected(true);
      mockExecuteProtocol.mockResolvedValue({ measurement: 42 });

      const { result, getCells } = renderExecution([proto]);

      await act(() => result.current.runCell(proto.id));

      const updated = getCells();
      const outputCell = findOutput(updated);
      expect(outputCell?.data).toEqual({ measurement: 42 });
      expect(outputCell?.producedBy).toBe(proto.id);
    });

    it("fans out to every connected device and records per-device results", async () => {
      const proto = createProtocolCell();
      const protocol = createProtocol({
        id: proto.payload.protocolId,
        code: [{ _protocol_set_: [] }],
      });
      server.mount(contract.protocols.getProtocol, { body: protocol });
      mockConnections = [
        mockConnection("dev-1", "Mock MultispeQ 1"),
        mockConnection("dev-2", "Mock MultispeQ 2"),
        mockConnection("dev-3", "Mock MultispeQ 3"),
        mockConnection("dev-4", "Mock MultispeQ 4"),
      ];
      // Device 3 fails; the round still completes with the other three.
      mockExecuteProtocol
        .mockResolvedValueOnce({ device_id: "mock-1" })
        .mockResolvedValueOnce({ device_id: "mock-2" })
        .mockRejectedValueOnce(new Error("Mock device failure (simulated)"))
        .mockResolvedValueOnce({ device_id: "mock-4" });

      const { result, getCells } = renderExecution([proto]);

      await act(() => result.current.runCell(proto.id));

      expect(mockExecuteProtocol).toHaveBeenCalledTimes(4);
      const updated = getCells();
      const outputCell = findOutput(updated);
      // Primary data mirrors the first successful device for macro cells.
      expect(outputCell?.data).toEqual({ device_id: "mock-1" });
      const identified = (label: string) => ({
        deviceLabel: label,
        deviceName: label,
        family: "multispeq",
      });
      expect(outputCell?.deviceResults).toEqual([
        { deviceId: "dev-1", ...identified("Mock MultispeQ 1"), data: { device_id: "mock-1" } },
        { deviceId: "dev-2", ...identified("Mock MultispeQ 2"), data: { device_id: "mock-2" } },
        {
          deviceId: "dev-3",
          ...identified("Mock MultispeQ 3"),
          error: "Mock device failure (simulated)",
        },
        { deviceId: "dev-4", ...identified("Mock MultispeQ 4"), data: { device_id: "mock-4" } },
      ]);
      expect(outputCell?.messages).toEqual([
        "Mock MultispeQ 3 · MultispeQ: Mock device failure (simulated)",
      ]);
    });

    it("keeps the primary single-device data shape and retains its identity", async () => {
      const proto = createProtocolCell();
      const protocol = createProtocol({
        id: proto.payload.protocolId,
        code: [{ _protocol_set_: [] }],
      });
      server.mount(contract.protocols.getProtocol, { body: protocol });
      setMockConnected(true);
      mockExecuteProtocol.mockResolvedValue({ measurement: 42 });

      const { result, getCells } = renderExecution([proto]);

      await act(() => result.current.runCell(proto.id));

      const updated = getCells();
      const outputCell = findOutput(updated);
      expect(outputCell?.deviceResults).toEqual([
        {
          deviceId: "dev-1",
          deviceLabel: "Device #1",
          deviceName: "Device #1",
          family: "multispeq",
          data: { measurement: 42 },
        },
      ]);
      expect(outputCell?.messages).toEqual([]);
    });

    it("retains a stable hardware id for an unnamed single-device result", async () => {
      const proto = createProtocolCell();
      const protocol = createProtocol({
        id: proto.payload.protocolId,
        code: [{ _protocol_set_: [] }],
      });
      server.mount(contract.protocols.getProtocol, { body: protocol });
      mockConnections = [
        {
          ...mockConnection("connection-1", "Device #1"),
          ordinal: 1,
          identity: {
            family: "multispeq",
            deviceId: "MSQ-42",
            raw: {},
          },
        },
      ];
      mockExecuteProtocol.mockResolvedValue({ measurement: 42 });

      const { result, getCells } = renderExecution([proto]);
      await act(() => result.current.runCell(proto.id));

      const updated = getCells();
      expect(findOutput(updated)?.deviceResults).toEqual([
        {
          deviceId: "connection-1",
          deviceLabel: "MSQ-42",
          deviceName: undefined,
          family: "multispeq",
          data: { measurement: 42 },
        },
      ]);
    });

    it("errors the cell when every device fails", async () => {
      const proto = createProtocolCell();
      const protocol = createProtocol({
        id: proto.payload.protocolId,
        code: [{ _protocol_set_: [] }],
      });
      server.mount(contract.protocols.getProtocol, { body: protocol });
      mockConnections = [
        mockConnection("dev-1", "Mock MultispeQ 1"),
        mockConnection("dev-2", "Mock MultispeQ 2"),
      ];
      mockExecuteProtocol.mockRejectedValue(new Error("device not open"));

      const { result, getCells } = renderExecution([proto]);

      await act(() => result.current.runCell(proto.id));

      const updated = getCells();
      const outputCell = findOutput(updated);
      expect(outputCell?.data).toBeUndefined();
      expect(outputCell?.deviceResults).toHaveLength(2);
      expect(outputCell?.messages).toEqual([
        "Mock MultispeQ 1 · MultispeQ: device not open",
        "Mock MultispeQ 2 · MultispeQ: device not open",
      ]);
    });

    it("disambiguates named and unnamed same-family failures with product and stable/ordinal context", async () => {
      const proto = createProtocolCell();
      const protocol = createProtocol({
        id: proto.payload.protocolId,
        code: [{ _protocol_set_: [] }],
      });
      server.mount(contract.protocols.getProtocol, { body: protocol });
      mockConnections = [
        {
          ...mockConnection("connection-1", "Canopy sensor"),
          ordinal: 1,
          family: "ambit",
          identity: {
            family: "ambit",
            name: "Canopy sensor",
            deviceId: "AMB-42",
            raw: {},
          },
        },
        {
          ...mockConnection("connection-2", "Device #2"),
          ordinal: 2,
          family: "ambit",
          identity: { family: "ambit", raw: {} },
        },
      ];
      mockExecuteProtocol
        .mockRejectedValueOnce(new Error("named device failed"))
        .mockRejectedValueOnce(new Error("unnamed device failed"));

      const { result, getCells } = renderExecution([proto]);
      await act(() => result.current.runCell(proto.id));

      const updated = getCells();
      expect(findOutput(updated)?.messages).toEqual([
        "Canopy sensor · Ambit · AMB-42: named device failed",
        "Ambit · Device #2: unnamed device failed",
      ]);
    });

    it("runs the live editor code directly, without re-fetching from the server", async () => {
      // Fixes the stale-protocol bug at the source: the device runs exactly the
      // code currently in the editor, with no backend round-trip, so a debounced,
      // not-yet-saved edit is never bypassed in favour of an older saved version.
      const proto = createProtocolCell();
      const liveCode = [{ _protocol_set_: [{ label: "live" }] }];

      // The server holds a different (older) version that must NOT be read.
      const getProtocolSpy = server.mount(contract.protocols.getProtocol, {
        body: createProtocol({
          id: proto.payload.protocolId,
          code: [{ _protocol_set_: [{ label: "old" }] }],
        }),
      });
      setMockConnected(true);
      mockExecuteProtocol.mockResolvedValue({ measurement: 1 });

      registerProtocolCodeSource(proto.payload.protocolId, () => liveCode);

      const { result } = renderExecution([proto]);

      await act(() => result.current.runCell(proto.id));

      expect(mockExecuteProtocol).toHaveBeenCalledWith(liveCode);
      expect(getProtocolSpy.called).toBe(false);
    });

    it("falls back to fetching the saved protocol when no editor is mounted", async () => {
      const proto = createProtocolCell();
      const savedCode = [{ _protocol_set_: [{ label: "saved" }] }];
      server.mount(contract.protocols.getProtocol, {
        body: createProtocol({ id: proto.payload.protocolId, code: savedCode }),
      });
      setMockConnected(true);
      mockExecuteProtocol.mockResolvedValue({ measurement: 1 });

      // No code source registered (e.g. the cell's editor is not mounted).
      const { result } = renderExecution([proto]);

      await act(() => result.current.runCell(proto.id));

      expect(mockExecuteProtocol).toHaveBeenCalledWith(savedCode);
    });

    it("captures protocol execution errors", async () => {
      const proto = createProtocolCell();
      const protocol = createProtocol({
        id: proto.payload.protocolId,
        code: [{ _protocol_set_: [] }],
      });
      server.mount(contract.protocols.getProtocol, { body: protocol });
      setMockConnected(true);
      mockExecuteProtocol.mockRejectedValue(new Error("Device timed out"));

      const { result, getCells } = renderExecution([proto]);

      await act(() => result.current.runCell(proto.id));

      const updated = getCells();
      const outputCell = findOutput(updated);
      expect(outputCell?.messages).toContain("Device timed out");
    });
  });

  describe("runCell - inline command", () => {
    it("sends a raw string command and wraps a scalar response", async () => {
      const cmd = createCommandCell({ payload: { format: "string", content: "battery" } });
      setMockConnected(true);
      mockExecuteCommand.mockResolvedValue("87%");

      const { result, getCells } = renderExecution([cmd]);
      await act(() => result.current.runCell(cmd.id));

      expect(mockExecuteCommand).toHaveBeenCalledWith("battery");
      const outputCell = findOutput(getCells());
      expect(outputCell?.data).toEqual({ response: "87%" });
    });

    it("parses a JSON command before sending and passes object responses through", async () => {
      const cmd = createCommandCell({ payload: { format: "json", content: '[{"c":1}]' } });
      setMockConnected(true);
      mockExecuteCommand.mockResolvedValue({ ok: true });

      const { result, getCells } = renderExecution([cmd]);
      await act(() => result.current.runCell(cmd.id));

      expect(mockExecuteCommand).toHaveBeenCalledWith([{ c: 1 }]);
      const outputCell = findOutput(getCells());
      expect(outputCell?.data).toEqual({ ok: true });
    });

    it("records an error when no device is connected", async () => {
      const cmd = createCommandCell({ payload: { format: "string", content: "hello" } });
      setMockConnected(false);

      const { result, getCells } = renderExecution([cmd]);
      await act(() => result.current.runCell(cmd.id));

      const outputCell = findOutput(getCells());
      expect(outputCell?.messages).toEqual(
        expect.arrayContaining([expect.stringContaining("No device connected")]),
      );
      expect(mockExecuteCommand).not.toHaveBeenCalled();
    });

    it("records an error when inline content is invalid JSON", async () => {
      const cmd = createCommandCell({ payload: { format: "json", content: "{not json" } });
      setMockConnected(true);

      const { result, getCells } = renderExecution([cmd]);
      await act(() => result.current.runCell(cmd.id));

      const outputCell = findOutput(getCells());
      expect(outputCell?.messages?.length).toBeGreaterThan(0);
      expect(mockExecuteCommand).not.toHaveBeenCalled();
    });

    it("captures a device error when the command execution throws", async () => {
      const cmd = createCommandCell({ payload: { format: "string", content: "battery" } });
      setMockConnected(true);
      mockExecuteCommand.mockRejectedValue(new Error("Command timed out"));

      const { result, getCells } = renderExecution([cmd]);
      await act(() => result.current.runCell(cmd.id));

      const outputCell = findOutput(getCells());
      expect(outputCell?.messages).toContain("Command timed out");
    });
  });

  describe("runCell - non-executable cell", () => {
    it("leaves the cells unchanged when dispatching a markdown cell", async () => {
      const md = createMarkdownCell({ id: "md-1", content: "# Notes" });
      const { result, getCells } = renderExecution([md]);

      await act(() => result.current.runCell(md.id));

      const updated = getCells();
      expect(updated).toEqual([md]);
    });
  });

  describe("runCell - macro", () => {
    it("errors when no preceding output data", async () => {
      const macro = createMacroCell();
      const { result, getCells } = renderExecution([macro]);

      await act(() => result.current.runCell(macro.id));

      const updated = getCells();
      const outputCell = findOutput(updated);
      expect(outputCell?.messages).toEqual(
        expect.arrayContaining([expect.stringContaining("No measurement data available")]),
      );
    });

    it("executes macro with preceding output data", async () => {
      const proto = createProtocolCell();
      const output = createOutputCell({ producedBy: proto.id, data: { chlorophyll: 35 } });
      const macro = createMacroCell();
      // A fresh predecessor is required: run the producer this session.
      setMockConnected(true);
      server.mount(contract.protocols.getProtocol, {
        body: createProtocol({ id: proto.payload.protocolId, code: [{ _protocol_set_: [] }] }),
      });
      mockExecuteProtocol.mockResolvedValue({ chlorophyll: 35 });
      server.mount(contract.macros.executeMacro, {
        body: { macro_id: macro.payload.macroId, success: true, output: { result: 99 } },
      });

      const { result, getCells } = renderExecution([proto, output, macro]);
      await act(() => result.current.runCell(proto.id));
      await act(() => result.current.runCell(macro.id));

      const updated = getCells();
      const macroOutput = findOutput(updated, macro.id);
      expect(macroOutput?.data).toEqual({ result: 99 });
    });

    it("sends named upstream outputs and $device in the macro context", async () => {
      setMockConnected(true);
      const proto = createProtocolCell({
        id: "proto-base",
        payload: { protocolId: crypto.randomUUID(), version: 1, name: "Baseline" },
      });
      const output = createOutputCell({
        producedBy: "proto-base",
        data: { value: 0.8 },
        deviceResults: [
          {
            deviceId: "dev-1",
            deviceLabel: "Device #1",
            family: "multispeq",
            deviceName: "Plot probe",
            data: { value: 0.8 },
          },
        ],
      });
      const question = createQuestionCell({
        id: "q-note",
        name: "Note",
        answer: "ok",
        isAnswered: true,
      });
      const macro = createMacroCell();
      // Establish the fresh predecessor from a real producer run.
      server.mount(contract.protocols.getProtocol, {
        body: createProtocol({ id: proto.payload.protocolId, code: [{ _protocol_set_: [] }] }),
      });
      mockExecuteProtocol.mockResolvedValue({ value: 0.8 });

      let capturedContext: Record<string, unknown> | undefined;
      server.use(
        http.post(`${API_URL}/api/v1/macros/:id/execute`, async ({ request }) => {
          const body = (await request.json()) as { context?: Record<string, unknown> };
          capturedContext = body.context;
          return HttpResponse.json({
            macro_id: macro.payload.macroId,
            success: true,
            output: { done: true },
          });
        }),
      );

      const { result, getCells } = renderExecution([proto, output, question, macro]);
      // Our registry requires a fresh producer run before the macro reads it;
      // the macro then carries the producer's device identity onto its output.
      await act(() => result.current.runCell("proto-base"));
      await act(() => result.current.runCell(macro.id));

      expect(capturedContext?.baseline).toEqual({ value: 0.8 });
      expect(capturedContext?.note).toEqual({ answer: "ok" });
      expect(capturedContext?.$device).toMatchObject({ family: "multispeq", index: 0 });
      const updated = getCells();
      expect(findOutput(updated, macro.id)?.deviceResults).toEqual([
        {
          deviceId: "dev-1",
          deviceLabel: "Device #1",
          family: "multispeq",
          deviceName: "Plot probe",
          data: { done: true },
        },
      ]);
    });

    it("runs a ctx-only macro without a preceding measurement", async () => {
      const question = createQuestionCell({
        id: "q-only",
        name: "Threshold",
        answer: "42",
        isAnswered: true,
      });
      const macro = createMacroCell();

      let capturedBody: { data?: unknown; context?: Record<string, unknown> } | undefined;
      server.use(
        http.post(`${API_URL}/api/v1/macros/:id/execute`, async ({ request }) => {
          capturedBody = (await request.json()) as typeof capturedBody;
          return HttpResponse.json({
            macro_id: macro.payload.macroId,
            success: true,
            output: { threshold: 42 },
          });
        }),
      );

      const { result, getCells } = renderExecution([question, macro]);
      await act(() => result.current.runCell(macro.id));

      expect(capturedBody?.data).toEqual({});
      expect(capturedBody?.context?.threshold).toEqual({ answer: "42" });
      const updated = getCells();
      expect(findOutput(updated, macro.id)?.data).toEqual({ threshold: 42 });
    });

    it("scopes each per-device macro run's ctx to that device's results", async () => {
      const proto = createProtocolCell({
        id: "proto-scan",
        payload: { protocolId: crypto.randomUUID(), version: 1, name: "Scan" },
      });
      const output = createOutputCell({
        producedBy: "proto-scan",
        data: { device_id: "mock-1" },
        deviceResults: [
          { deviceId: "dev-1", deviceLabel: "Mock MultispeQ 1", data: { device_id: "mock-1" } },
          { deviceId: "dev-2", deviceLabel: "Mock MultispeQ 2", data: { device_id: "mock-2" } },
        ],
      });
      const macro = createMacroCell();
      // Establish the device-scoped predecessor from a real run (the registry,
      // not the display output, is the authority for per-device fan-out).
      mockConnections = [
        mockConnection("dev-1", "Mock MultispeQ 1"),
        mockConnection("dev-2", "Mock MultispeQ 2"),
      ];
      server.mount(contract.protocols.getProtocol, {
        body: createProtocol({ id: proto.payload.protocolId, code: [{ _protocol_set_: [] }] }),
      });
      mockExecuteProtocol
        .mockResolvedValueOnce({ device_id: "mock-1" })
        .mockResolvedValueOnce({ device_id: "mock-2" });

      const contexts: Record<string, unknown>[] = [];
      server.use(
        http.post(`${API_URL}/api/v1/macros/:id/execute`, async ({ request }) => {
          const body = (await request.json()) as { context?: Record<string, unknown> };
          contexts.push(body.context ?? {});
          return HttpResponse.json({
            macro_id: macro.payload.macroId,
            success: true,
            output: { ok: true },
          });
        }),
      );

      const { result } = renderExecution([proto, output, macro]);
      await act(() => result.current.runCell("proto-scan"));
      await act(() => result.current.runCell(macro.id));

      expect(contexts).toHaveLength(2);
      expect(contexts[0].scan).toEqual({ device_id: "mock-1" });
      expect(contexts[1].scan).toEqual({ device_id: "mock-2" });
    });

    it("applies the macro to every device's measurement individually", async () => {
      const proto = createProtocolCell();
      const output = createOutputCell({ producedBy: proto.id, data: { device_id: "mock-1" } });
      const macro = createMacroCell();
      // Real device-scoped producer run: dev-3 fails at the source, so the
      // predecessor carries dev-3's error into the macro fan-out.
      mockConnections = [
        mockConnection("dev-1", "Mock MultispeQ 1"),
        mockConnection("dev-2", "Mock MultispeQ 2"),
        mockConnection("dev-3", "Mock MultispeQ 3"),
        mockConnection("dev-4", "Mock MultispeQ 4"),
      ];
      server.mount(contract.protocols.getProtocol, {
        body: createProtocol({ id: proto.payload.protocolId, code: [{ _protocol_set_: [] }] }),
      });
      mockExecuteProtocol
        .mockResolvedValueOnce({ device_id: "mock-1" })
        .mockResolvedValueOnce({ device_id: "mock-2" })
        .mockRejectedValueOnce(new Error("Mock device failure (simulated)"))
        .mockResolvedValueOnce({ device_id: "mock-4" });

      // Echo the device_id back so per-device outputs are distinguishable.
      server.use(
        http.post(`${API_URL}/api/v1/macros/:id/execute`, async ({ request }) => {
          const body = (await request.json()) as { data: { device_id: string } };
          return HttpResponse.json({
            macro_id: macro.payload.macroId,
            success: true,
            output: { phi2: 0.5, from: body.data.device_id },
          });
        }),
      );

      const { result, getCells } = renderExecution([proto, output, macro]);
      await act(() => result.current.runCell(proto.id));
      await act(() => result.current.runCell(macro.id));

      const updated = getCells();
      const macroOutput = findOutput(updated, macro.id);
      // Primary mirrors the first successful device's macro output.
      expect(macroOutput?.data).toEqual({ phi2: 0.5, from: "mock-1" });
      expect(macroOutput?.deviceResults).toEqual([
        { deviceId: "dev-1", deviceLabel: "Mock MultispeQ 1", data: { phi2: 0.5, from: "mock-1" } },
        { deviceId: "dev-2", deviceLabel: "Mock MultispeQ 2", data: { phi2: 0.5, from: "mock-2" } },
        {
          deviceId: "dev-3",
          deviceLabel: "Mock MultispeQ 3",
          error: "Mock device failure (simulated)",
        },
        { deviceId: "dev-4", deviceLabel: "Mock MultispeQ 4", data: { phi2: 0.5, from: "mock-4" } },
      ]);
      expect(macroOutput?.messages).toEqual(["Mock MultispeQ 3: Mock device failure (simulated)"]);
    });

    it("errors the macro cell when every device's input already failed", async () => {
      const proto = createProtocolCell();
      const output = createOutputCell({
        producedBy: proto.id,
        deviceResults: [
          { deviceId: "dev-1", deviceLabel: "Mock MultispeQ 1", error: "device not open" },
          { deviceId: "dev-2", deviceLabel: "Mock MultispeQ 2", error: "device not open" },
        ],
      });
      const macro = createMacroCell();
      // Both devices fail at the source; the device-scoped predecessor carries
      // each source error, and the macro runs for neither.
      mockConnections = [
        mockConnection("dev-1", "Mock MultispeQ 1"),
        mockConnection("dev-2", "Mock MultispeQ 2"),
      ];
      server.mount(contract.protocols.getProtocol, {
        body: createProtocol({ id: proto.payload.protocolId, code: [{ _protocol_set_: [] }] }),
      });
      mockExecuteProtocol.mockRejectedValue(new Error("device not open"));

      const { result, getCells } = renderExecution([proto, output, macro]);
      await act(() => result.current.runCell(proto.id));
      await act(() => result.current.runCell(macro.id));

      const updated = getCells();
      const macroOutput = findOutput(updated, macro.id);
      expect(macroOutput?.data).toBeUndefined();
      expect(macroOutput?.deviceResults).toEqual([
        { deviceId: "dev-1", deviceLabel: "Mock MultispeQ 1", error: "device not open" },
        { deviceId: "dev-2", deviceLabel: "Mock MultispeQ 2", error: "device not open" },
      ]);
    });

    it("captures macro failure response", async () => {
      const proto = createProtocolCell();
      // The input cell's device identity (family/deviceName) is what the macro
      // output forwards; the fresh producer run supplies freshness + device id.
      const output = createOutputCell({
        producedBy: proto.id,
        data: { value: 1 },
        deviceResults: [
          {
            deviceId: "dev-1",
            deviceLabel: "AMB-42",
            family: "ambit",
            deviceName: "Canopy probe",
            data: { value: 1 },
          },
        ],
      });
      const macro = createMacroCell();
      // A device labelled "AMB-42" so the run's device id/label line up with the
      // input identity above.
      mockConnections = [
        {
          id: "dev-1",
          label: "AMB-42",
          family: "ambit",
          identity: { family: "ambit", name: "Canopy probe", raw: {} },
          driver: {} as IotDeviceConnection["driver"],
        },
      ];
      server.mount(contract.protocols.getProtocol, {
        body: createProtocol({ id: proto.payload.protocolId, code: [{ _protocol_set_: [] }] }),
      });
      mockExecuteProtocol.mockResolvedValue({ value: 1 });
      server.mount(contract.macros.executeMacro, {
        body: { macro_id: macro.payload.macroId, success: false, error: "Division by zero" },
      });

      const { result, getCells } = renderExecution([proto, output, macro]);
      await act(() => result.current.runCell(proto.id));
      await act(() => result.current.runCell(macro.id));

      const updated = getCells();
      const macroOutput = findOutput(updated, macro.id);
      // The device-scoped failure carries the producer's device identity, and
      // the failure reason surfaces in the (device-labelled) messages.
      expect(macroOutput?.messages?.join("\n")).toContain("Division by zero");
      expect(macroOutput?.deviceResults).toEqual([
        {
          deviceId: "dev-1",
          deviceLabel: "AMB-42",
          family: "ambit",
          deviceName: "Canopy probe",
          error: "Division by zero",
        },
      ]);
    });

    it("does not invent device identity when an unscoped macro fails", async () => {
      // Ctx-only (unscoped) macro: no device predecessor, so a failure must not
      // fabricate device identity on the output.
      const question = createQuestionCell({
        id: "q-x",
        name: "Threshold",
        answer: "42",
        isAnswered: true,
      });
      const macro = createMacroCell();
      server.mount(contract.macros.executeMacro, {
        body: { macro_id: macro.payload.macroId, success: false, error: "Division by zero" },
      });

      const { result, getCells } = renderExecution([question, macro]);
      await act(() => result.current.runCell(macro.id));

      const updated = getCells();
      const macroOutput = findOutput(updated, macro.id);
      expect(macroOutput?.messages?.join("\n")).toContain("Division by zero");
      expect(macroOutput?.deviceResults).toBeUndefined();
    });
  });

  describe("runCell - question", () => {
    it("errors when question text is empty", async () => {
      const q = createQuestionCell({
        question: { kind: "open_ended", text: "", required: false },
      });

      const { result, getCells } = renderExecution([q]);

      await act(() => result.current.runCell(q.id));

      const updated = getCells();
      const outputCell = findOutput(updated);
      expect(outputCell?.messages).toEqual(
        expect.arrayContaining([expect.stringContaining("Question text is required")]),
      );
    });

    it("does not add output without a prompt function", async () => {
      const q = createQuestionCell();
      const { result, getCells } = renderExecution([q]);

      await act(() => result.current.runCell(q.id));

      const updated = getCells();
      expect(findOutput(updated)).toBeUndefined();
    });

    it("records the answer and produces output", async () => {
      const q = createQuestionCell();
      const onPrompt = vi.fn().mockResolvedValue("42");

      const { result, getCells } = renderExecution([q], {
        onPromptQuestion: onPrompt,
      });

      await act(() => result.current.runCell(q.id));

      expect(onPrompt).toHaveBeenCalledWith(q);
      const updated = getCells();
      const answeredQ = updated.find((c) => c.id === q.id);
      expect(answeredQ).toHaveProperty("answer", "42");
      expect(answeredQ).toHaveProperty("isAnswered", true);

      const outputCell = findOutput(updated);
      expect(outputCell?.data).toEqual({ answer: "42" });
    });

    it("does not add output when user cancels the prompt", async () => {
      const q = createQuestionCell();
      const onPrompt = vi.fn().mockResolvedValue(undefined);

      const { result, getCells } = renderExecution([q], {
        onPromptQuestion: onPrompt,
      });

      await act(() => result.current.runCell(q.id));

      const updated = getCells();
      expect(findOutput(updated)).toBeUndefined();
    });
  });

  describe("runCell - branch", () => {
    it("evaluates branch and records matched path", async () => {
      const q = createQuestionCell({
        id: "q-1",
        answer: "yes",
        isAnswered: true,
      });
      const branch = createBranchCell({
        id: "branch-1",
        paths: [
          {
            id: "path-yes",
            label: "Yes path",
            color: "#22c55e",
            conditions: [
              {
                id: "cond-1",
                sourceCellId: "q-1",
                field: "answer",
                operator: "eq",
                value: "yes",
              },
            ],
          },
        ],
      });

      const cells: WorkbookCell[] = [q, branch];
      const { result, getCells } = renderExecution(cells);

      await act(() => result.current.runCell(branch.id));

      const updated = getCells();
      const updatedBranch = updated.find((c) => c.id === "branch-1");
      expect(updatedBranch).toHaveProperty("evaluatedPathId", "path-yes");

      const outputCell = findOutput(updated);
      expect(outputCell?.messages).toEqual(
        expect.arrayContaining([expect.stringContaining("Yes path")]),
      );
    });

    function deviceBranch(targets: { multispeq: string; other: string }) {
      return createBranchCell({
        id: "branch-dev",
        paths: [
          {
            id: "path-multispeq",
            label: "MultispeQ path",
            color: "#22c55e",
            gotoCellId: targets.multispeq,
            conditions: [
              {
                id: "cond-1",
                sourceCellId: "$device",
                field: "family",
                operator: "eq",
                value: "multispeq",
              },
            ],
          },
          {
            id: "path-other",
            label: "Other path",
            color: "#0ea5e9",
            gotoCellId: targets.other,
            conditions: [
              {
                id: "cond-2",
                sourceCellId: "$device",
                field: "family",
                operator: "neq",
                value: "multispeq",
              },
            ],
          },
        ],
      });
    }

    it("dispatches each device group to its resolved protocol/command target", async () => {
      const proto = createProtocolCell({ id: "proto-ms" });
      const command = createCommandCell({ id: "cmd-other" });
      mockConnections = [
        mockConnection("dev-1", "MultispeQ A"),
        {
          ...mockConnection("dev-2", "Ambit B"),
          family: "ambit",
          identity: { family: "ambit", name: "Ambit B", raw: {} },
        },
      ];
      const protocol = createProtocol();
      server.mount(contract.protocols.getProtocol, { body: protocol });
      mockExecuteProtocol.mockResolvedValue({ device_id: "ms-1" });
      mockExecuteCommand.mockResolvedValue("NEW Ambit B Ready");

      const branch = deviceBranch({ multispeq: "proto-ms", other: "cmd-other" });
      const { result, getCells } = renderExecution([branch, proto, command]);
      await act(() => result.current.runCell(branch.id));

      // The protocol ran for the MultispeQ only, the command for the Ambit only.
      expect(mockExecuteProtocol).toHaveBeenCalledTimes(1);
      expect(mockExecuteCommand).toHaveBeenCalledTimes(1);
      const updated = getCells();
      const protoOutput = findOutput(updated, "proto-ms");
      const cmdOutput = findOutput(updated, "cmd-other");
      expect(protoOutput?.data).toEqual({ device_id: "ms-1" });
      expect(cmdOutput?.data).toEqual({ response: "NEW Ambit B Ready" });
      const branchOutput = findOutput(updated, branch.id);
      expect(branchOutput?.messages?.join("\n")).toContain("MultispeQ path");
      expect(branchOutput?.messages?.join("\n")).toContain("Other path");
    });

    it("skips (not errors) devices whose branch resolves no measurement", async () => {
      const proto = createProtocolCell({ id: "proto-ms" });
      mockConnections = [
        mockConnection("dev-1", "MultispeQ A"),
        {
          ...mockConnection("dev-2", "Ambit B"),
          family: "ambit",
          identity: { family: "ambit", name: "Ambit B", raw: {} },
        },
      ];
      const protocol = createProtocol();
      server.mount(contract.protocols.getProtocol, { body: protocol });
      mockExecuteProtocol.mockResolvedValue({ device_id: "ms-1" });

      // Only the multispeq path exists; the Ambit matches nothing.
      const branch = createBranchCell({
        id: "branch-dev",
        paths: [
          {
            id: "path-multispeq",
            label: "MultispeQ path",
            color: "#22c55e",
            gotoCellId: "proto-ms",
            conditions: [
              {
                id: "cond-1",
                sourceCellId: "$device",
                field: "family",
                operator: "eq",
                value: "multispeq",
              },
            ],
          },
        ],
      });
      const { result, getCells } = renderExecution([branch, proto]);
      await act(() => result.current.runCell(branch.id));

      const updated = getCells();
      const branchOutput = findOutput(updated, branch.id);
      expect(branchOutput?.messages?.join("\n")).toContain(
        "Ambit B (ambit): no measurement resolved this round",
      );
      const branchCell = updated.find((c) => c.id === branch.id);
      expect(branchCell?.type === "branch" ? branchCell.evaluatedPathId : "set").toBeUndefined();
    });

    it("runAll skips a dispatched target exactly once (no double run)", async () => {
      const proto = createProtocolCell({ id: "proto-ms" });
      mockConnections = [mockConnection("dev-1", "MultispeQ A")];
      const protocol = createProtocol();
      server.mount(contract.protocols.getProtocol, { body: protocol });
      mockExecuteProtocol.mockResolvedValue({ device_id: "ms-1" });

      const branch = createBranchCell({
        id: "branch-dev",
        paths: [
          {
            id: "path-multispeq",
            label: "MultispeQ path",
            color: "#22c55e",
            gotoCellId: "proto-ms",
            conditions: [
              {
                id: "cond-1",
                sourceCellId: "$device",
                field: "family",
                operator: "eq",
                value: "multispeq",
              },
            ],
          },
        ],
      });

      const { result } = renderExecution([branch, proto]);
      await act(() => result.current.runAll());

      expect(mockExecuteProtocol).toHaveBeenCalledTimes(1);
    });

    it("errors a device-scoped branch when no device is connected", async () => {
      setMockConnected(false);
      const proto = createProtocolCell({ id: "proto-ms" });
      const branch = deviceBranch({ multispeq: "proto-ms", other: "proto-ms" });

      const { result, getCells } = renderExecution([branch, proto]);
      await act(() => result.current.runCell(branch.id));

      const updated = getCells();
      const branchOutput = findOutput(updated, branch.id);
      expect(branchOutput?.messages?.join("\n")).toContain("No device connected");
    });

    it("rejects a device-scoped branch whose path lacks a measurement target", async () => {
      setMockConnected(true);
      const branch = createBranchCell({
        id: "branch-dev",
        paths: [
          {
            id: "path-multispeq",
            label: "MultispeQ path",
            color: "#22c55e",
            conditions: [
              {
                id: "cond-1",
                sourceCellId: "$device",
                field: "family",
                operator: "eq",
                value: "multispeq",
              },
            ],
          },
        ],
      });

      const { result, getCells } = renderExecution([branch]);
      await act(() => result.current.runCell(branch.id));

      const updated = getCells();
      const branchOutput = findOutput(updated, branch.id);
      expect(branchOutput?.messages?.join("\n")).toMatch(/must jump to a protocol or command/);
    });

    it("reports validation errors for misconfigured branch", async () => {
      const branch = createBranchCell({
        paths: [
          {
            id: "bad-path",
            label: "Bad",
            color: "#f00",
            conditions: [
              {
                id: "cond-1",
                sourceCellId: "",
                field: "",
                operator: "eq",
                value: "",
              },
            ],
          },
        ],
      });

      const { result, getCells } = renderExecution([branch]);

      await act(() => result.current.runCell(branch.id));

      const updated = getCells();
      const outputCell = findOutput(updated);
      expect(outputCell?.messages?.length).toBeGreaterThan(0);
    });
  });

  describe("runAll", () => {
    it("skips output and markdown cells", async () => {
      const q = createQuestionCell();
      const output = createOutputCell({ producedBy: q.id });
      const onPrompt = vi.fn().mockResolvedValue("answer");

      const cells: WorkbookCell[] = [q, output, createMarkdownCell({ content: "# Notes" })];

      const { result } = renderExecution(cells, {
        onPromptQuestion: onPrompt,
      });

      await act(() => result.current.runAll());

      expect(onPrompt).toHaveBeenCalledTimes(1);
    });

    it("executes cells sequentially and tracks running state", async () => {
      const q1 = createQuestionCell({ id: "q-1" });
      const q2 = createQuestionCell({ id: "q-2" });
      const callOrder: string[] = [];

      const onPrompt = vi.fn().mockImplementation((cell: QuestionCell) => {
        callOrder.push(cell.id);
        return Promise.resolve("done");
      });

      const { result } = renderExecution([q1, q2], {
        onPromptQuestion: onPrompt,
      });

      expect(result.current.isRunningAll).toBe(false);
      await act(() => result.current.runAll());
      expect(result.current.isRunningAll).toBe(false);

      expect(callOrder).toEqual(["q-1", "q-2"]);
    });
  });

  describe("stopExecution", () => {
    it("stops runAll after the current cell finishes", async () => {
      const q1 = createQuestionCell({ id: "q-1" });
      const q2 = createQuestionCell({ id: "q-2" });

      const hookResultRef = { current: null as ReturnType<typeof useWorkbookExecution> | null };
      const onPrompt = vi.fn().mockImplementation((cell: QuestionCell) => {
        if (cell.id === "q-1") {
          hookResultRef.current?.stopExecution();
        }
        return Promise.resolve("answered");
      });

      const { result } = renderExecution([q1, q2], {
        onPromptQuestion: onPrompt,
      });
      hookResultRef.current = result.current;

      await act(() => result.current.runAll());

      expect(onPrompt).toHaveBeenCalledTimes(1);
    });
  });

  describe("execution order", () => {
    it("stamps sequential execution order numbers", async () => {
      const q1 = createQuestionCell({ id: "q-1" });
      const q2 = createQuestionCell({ id: "q-2" });
      const onPrompt = vi.fn().mockResolvedValue("ok");

      const { result } = renderExecution([q1, q2], {
        onPromptQuestion: onPrompt,
      });

      await act(() => result.current.runAll());

      const states = result.current.executionStates;
      expect(states["q-1"].executionOrder).toEqual([1]);
      expect(states["q-2"].executionOrder).toEqual([2]);
    });
  });

  describe("connection", () => {
    it("exposes device connection state", () => {
      const { result } = renderExecution([]);

      expect(result.current.isConnected).toBe(false);
      expect(result.current.isConnecting).toBe(false);
    });

    it("exposes connect and disconnect from IoT hook", () => {
      const { result } = renderExecution([]);

      void result.current.connect();
      expect(mockConnect).toHaveBeenCalledWith("serial");
      void result.current.disconnect();
      expect(mockDisconnect).toHaveBeenCalledOnce();
    });

    it("defaults sensor family to multispeq", () => {
      const { result } = renderExecution([]);

      expect(result.current.sensorFamily).toBe("multispeq");
    });

    it("allows changing sensor family", () => {
      const { result } = renderExecution([]);

      act(() => result.current.setSensorFamily("ambyte"));

      expect(result.current.sensorFamily).toBe("ambyte");
    });
  });

  describe("dynamic command resolution (ticket 5)", () => {
    function refCommand(sourceCellId: string, field: string, id = "cmd"): WorkbookCell {
      return {
        id,
        type: "command",
        isCollapsed: false,
        payload: { kind: "ref", ref: { sourceCellId, field } },
      };
    }

    function mountProtocol(cell: ReturnType<typeof createProtocolCell>) {
      server.mount(contract.protocols.getProtocol, {
        body: createProtocol({ id: cell.payload.protocolId, code: [{ _protocol_set_: [] }] }),
      });
    }

    function commandCalls(): unknown[] {
      return mockExecuteCommand.mock.calls.map((c) => c[0] as unknown);
    }

    it("manually run source feeds its command in the same unchanged session", async () => {
      const src = createProtocolCell({ id: "src" });
      const cmd = refCommand("src", "value");
      mountProtocol(src);
      setMockConnected(true);
      mockExecuteProtocol.mockResolvedValue({ value: "measure-light" });
      mockExecuteCommand.mockResolvedValue("ok");

      const { result } = renderExecution([src, cmd]);

      await act(() => result.current.runCell("src"));
      await act(() => result.current.runCell("cmd"));

      // The resolved string from the source's `value` field reached transport.
      expect(commandCalls()).toEqual(["measure-light"]);
      const preview = result.current.commandPreviews.cmd;
      expect(preview.perDevice[0]).toMatchObject({ deviceId: "dev-1", resolved: "measure-light" });
    });

    it("blocks a direct command before its source runs with zero transport", async () => {
      const src = createProtocolCell({ id: "src" });
      const cmd = refCommand("src", "value");
      const warn = vi.spyOn(console, "warn").mockImplementation(() => undefined);
      setMockConnected(true);

      const { result, getCells } = renderExecution([src, cmd]);

      await act(() => result.current.runCell("cmd"));

      expect(mockExecuteCommand).not.toHaveBeenCalled();
      const updated = getCells();
      expect(findOutput(updated, "cmd")?.messages?.[0]).toContain("has not produced a result");
      // Safe telemetry: code + ids, never the resolved string or source data.
      expect(warn).toHaveBeenCalledWith(
        "[workbook] dynamic command resolution failed",
        expect.objectContaining({ code: "COMMAND_OUTPUT_MISSING", commandCellId: "cmd" }),
      );
      warn.mockRestore();
    });

    it("resolves device-scoped values to each device's own exact id", async () => {
      const src = createProtocolCell({ id: "src" });
      const cmd = refCommand("src", "value");
      mountProtocol(src);
      mockConnections = [mockConnection("dev-1", "Device 1"), mockConnection("dev-2", "Device 2")];
      mockExecuteProtocol
        .mockResolvedValueOnce({ value: "for-dev-1" })
        .mockResolvedValueOnce({ value: "for-dev-2" });
      mockExecuteCommand.mockResolvedValue("ok");

      const { result } = renderExecution([src, cmd]);

      await act(() => result.current.runCell("src"));
      await act(() => result.current.runCell("cmd"));

      // Each transport receives ONLY its own device's resolved value.
      expect(commandCalls()).toEqual(["for-dev-1", "for-dev-2"]);
    });

    it("continues valid devices and pre-fails the missing one (partial success)", async () => {
      const src = createProtocolCell({ id: "src" });
      const cmd = refCommand("src", "value");
      mountProtocol(src);
      // Source only produces for dev-1; dev-2 connects afterwards with no result.
      mockConnections = [mockConnection("dev-1", "Device 1")];
      mockExecuteProtocol.mockResolvedValueOnce({ value: "for-dev-1" });
      mockExecuteCommand.mockResolvedValue("ok");
      const warn = vi.spyOn(console, "warn").mockImplementation(() => undefined);

      const { result, rerender } = renderExecution([src, cmd]);
      await act(() => result.current.runCell("src"));

      // dev-2 connects after the source ran; re-render so the hook sees it.
      mockConnections = [mockConnection("dev-1", "Device 1"), mockConnection("dev-2", "Device 2")];
      rerender({ cells: [src, cmd] });
      await act(() => result.current.runCell("cmd"));

      // dev-1 dispatched its value; dev-2 got no transport call.
      expect(commandCalls()).toEqual(["for-dev-1"]);
      const preview = result.current.commandPreviews.cmd;
      expect(preview.perDevice).toEqual([
        { deviceId: "dev-1", deviceLabel: "Device 1", resolved: "for-dev-1" },
        { deviceId: "dev-2", deviceLabel: "Device 2", errorCode: "DEVICE_OUTPUT_MISSING" },
      ]);
      warn.mockRestore();
    });

    it("fans a shared question answer out to every target device", async () => {
      const q = createQuestionCell({ id: "src" });
      const cmd = refCommand("src", "answer");
      mockConnections = [mockConnection("dev-1", "Device 1"), mockConnection("dev-2", "Device 2")];
      mockExecuteCommand.mockResolvedValue("ok");
      const onPromptQuestion = vi.fn().mockResolvedValue("shared-value");

      const { result } = renderExecution([q, cmd], { onPromptQuestion });

      await act(() => result.current.runCell("src"));
      await act(() => result.current.runCell("cmd"));

      // Both devices receive the same shared answer.
      expect(commandCalls()).toEqual(["shared-value", "shared-value"]);
    });

    it("consumes the latest same-epoch producer completion in a loop", async () => {
      const src = createProtocolCell({ id: "src" });
      const cmd = refCommand("src", "value");
      mountProtocol(src);
      setMockConnected(true);
      mockExecuteProtocol
        .mockResolvedValueOnce({ value: "first" })
        .mockResolvedValueOnce({ value: "latest" });
      mockExecuteCommand.mockResolvedValue("ok");

      const { result } = renderExecution([src, cmd]);

      await act(() => result.current.runCell("src"));
      await act(() => result.current.runCell("src"));
      await act(() => result.current.runCell("cmd"));

      expect(commandCalls()).toEqual(["latest"]);
    });

    it("references an earlier command's own device reply as a source", async () => {
      const producer = createCommandCell({ payload: { content: "battery" } });
      const consumer = refCommand(producer.id, "value", "consumer");
      setMockConnected(true);
      // The producer static command reply becomes the consumer's source data.
      mockExecuteCommand.mockResolvedValueOnce({ value: "chained" }).mockResolvedValueOnce("ok");

      const { result } = renderExecution([producer, consumer]);

      await act(() => result.current.runCell(producer.id));
      await act(() => result.current.runCell("consumer"));

      expect(commandCalls().at(-1)).toBe("chained");
    });

    it("clear outputs invalidates the registry (later command pre-fails)", async () => {
      const src = createProtocolCell({ id: "src" });
      const cmd = refCommand("src", "value");
      mountProtocol(src);
      setMockConnected(true);
      mockExecuteProtocol.mockResolvedValue({ value: "measure-light" });
      const warn = vi.spyOn(console, "warn").mockImplementation(() => undefined);

      const { result } = renderExecution([src, cmd]);
      await act(() => result.current.runCell("src"));
      act(() => result.current.clearOutputs());
      await act(() => result.current.runCell("cmd"));

      expect(mockExecuteCommand).not.toHaveBeenCalled();
      expect(result.current.commandPreviews.cmd.perDevice[0]?.errorCode).toBe(
        "COMMAND_OUTPUT_MISSING",
      );
      warn.mockRestore();
    });

    it("an authored design change invalidates; an output-only change does not", async () => {
      const src = createProtocolCell({ id: "src" });
      const cmd = refCommand("src", "value");
      mountProtocol(src);
      setMockConnected(true);
      mockExecuteProtocol.mockResolvedValue({ value: "measure-light" });
      mockExecuteCommand.mockResolvedValue("ok");
      const warn = vi.spyOn(console, "warn").mockImplementation(() => undefined);

      const { result, rerender } = renderExecution([src, cmd]);
      await act(() => result.current.runCell("src"));

      // Output-only rerender (an output cell appended): does NOT invalidate.
      const output = createOutputCell({ producedBy: "src" });
      rerender({ cells: [src, output, cmd] });
      await act(() => result.current.runCell("cmd"));
      expect(commandCalls()).toEqual(["measure-light"]);

      // Authored edit (add a markdown cell): invalidates -> command pre-fails.
      mockExecuteCommand.mockClear();
      rerender({ cells: [src, output, createMarkdownCell(), cmd] });
      await act(() => result.current.runCell("cmd"));
      expect(mockExecuteCommand).not.toHaveBeenCalled();
      warn.mockRestore();
    });

    it("never mutates the authored ref payload while resolving", async () => {
      const src = createProtocolCell({ id: "src" });
      const cmd = refCommand("src", "value");
      mountProtocol(src);
      setMockConnected(true);
      mockExecuteProtocol.mockResolvedValue({ value: "measure-light" });
      mockExecuteCommand.mockResolvedValue("ok");

      const { result, getCells } = renderExecution([src, cmd]);
      await act(() => result.current.runCell("src"));
      await act(() => result.current.runCell("cmd"));

      // The committed cells keep the command payload as the ref variant;
      // execution's field-scoped delta never touches an authored payload.
      const command = getCells().find((c) => c.id === "cmd");
      expect(command?.type === "command" ? command.payload : undefined).toEqual({
        kind: "ref",
        ref: { sourceCellId: "src", field: "value" },
      });
    });

    it("run all starts a fresh epoch before the first step", async () => {
      const src = createProtocolCell({ id: "src" });
      const cmd = refCommand("src", "value");
      mountProtocol(src);
      setMockConnected(true);
      mockExecuteProtocol.mockResolvedValue({ value: "measure-light" });
      mockExecuteCommand.mockResolvedValue("ok");

      const { result } = renderExecution([src, cmd]);
      await act(() => result.current.runAll());

      // Source then command executed in authored order; command resolved fresh.
      expect(commandCalls()).toEqual(["measure-light"]);
    });
  });

  describe("ticket-5 amendment: freshness race + macro scope", () => {
    function refCommand(sourceCellId: string, field: string, id = "cmd"): WorkbookCell {
      return {
        id,
        type: "command",
        isCollapsed: false,
        payload: { kind: "ref", ref: { sourceCellId, field } },
      };
    }
    function mountProtocol(cell: ReturnType<typeof createProtocolCell>) {
      server.mount(contract.protocols.getProtocol, {
        body: createProtocol({ id: cell.payload.protocolId, code: [{ _protocol_set_: [] }] }),
      });
    }
    function commandCalls(): unknown[] {
      return mockExecuteCommand.mock.calls.map((c) => c[0] as unknown);
    }
    function deferred<T>() {
      let resolve!: (value: T) => void;
      const promise = new Promise<T>((r) => {
        resolve = r;
      });
      return { promise, resolve };
    }

    // A protocol completion that resolves AFTER `invalidate()` ran must not
    // populate the registry or previews; the later ref command then pre-fails.
    async function assertDeferredCompletionInert(
      invalidate: (r: ReturnType<typeof renderExecution>) => void,
    ) {
      const src = createProtocolCell({ id: "src" });
      const cmd = refCommand("src", "value");
      mountProtocol(src);
      setMockConnected(true);
      const d = deferred<{ value: string }>();
      mockExecuteProtocol.mockReturnValue(d.promise);
      const warn = vi.spyOn(console, "warn").mockImplementation(() => undefined);

      const rendered = renderExecution([src, cmd]);
      const { result } = rendered;
      let runP: Promise<void> | undefined;
      act(() => {
        runP = result.current.runCell("src");
      });

      invalidate(rendered);

      await act(async () => {
        d.resolve({ value: "stale-late" });
        await runP;
      });

      mockExecuteProtocol.mockResolvedValue({ value: "unused" });
      await act(() => result.current.runCell("cmd"));

      // The superseded completion committed nothing: no transport, MISSING preview.
      expect(mockExecuteCommand).not.toHaveBeenCalled();
      expect(result.current.commandPreviews.cmd.perDevice[0]?.errorCode).toBe(
        "COMMAND_OUTPUT_MISSING",
      );
      warn.mockRestore();
    }

    it("deferred completion after Clear is inert", async () => {
      await assertDeferredCompletionInert(({ result }) => {
        act(() => result.current.clearOutputs());
      });
    });

    it("deferred completion after an authored cell edit is inert", async () => {
      await assertDeferredCompletionInert(({ rerender }) => {
        rerender({
          cells: [
            createMarkdownCell(),
            createProtocolCell({ id: "src" }),
            refCommand("src", "value"),
          ],
        });
      });
    });

    it("deferred completion after a synchronous executable-entity edit is inert (callback before effect)", async () => {
      // The edit context calls the invalidator DIRECTLY (no rerender, no effect
      // flush) while a producer is in flight; its late completion is inert.
      await assertDeferredCompletionInert(({ result }) => {
        act(() => result.current.invalidateExecutableDesign());
      });
    });

    it("deferred completion after a workbook-key change is inert", async () => {
      await assertDeferredCompletionInert(({ rerender }) => {
        rerender({
          cells: [createProtocolCell({ id: "src" }), refCommand("src", "value")],
          workbookId: "wb-2",
        });
      });
    });

    it("a synchronous executable-entity edit invalidates a previously fresh source", async () => {
      const src = createProtocolCell({ id: "src" });
      const cmd = refCommand("src", "value");
      mountProtocol(src);
      setMockConnected(true);
      mockExecuteProtocol.mockResolvedValue({ value: "measure-light" });
      mockExecuteCommand.mockResolvedValue("ok");
      const warn = vi.spyOn(console, "warn").mockImplementation(() => undefined);

      const { result } = renderExecution([src, cmd]);
      await act(() => result.current.runCell("src"));

      // Protocol/macro code edit fires the synchronous invalidator directly.
      act(() => result.current.invalidateExecutableDesign());
      await act(() => result.current.runCell("cmd"));

      expect(mockExecuteCommand).not.toHaveBeenCalled();
      expect(result.current.commandPreviews.cmd.perDevice[0]?.errorCode).toBe(
        "COMMAND_OUTPUT_MISSING",
      );
      warn.mockRestore();
    });

    it("an older manual run cannot overwrite a newer Run all", async () => {
      const src = createProtocolCell({ id: "src" });
      const cmd = refCommand("src", "value");
      // Register a synchronous code source so protocol-code loading does not go
      // through async MSW; the manual run then deterministically takes the first
      // (deferred) executor call and Run all takes the second.
      registerProtocolCodeSource(src.payload.protocolId, () => [{ _protocol_set_: [] }]);
      setMockConnected(true);
      const manual = deferred<{ value: string }>();
      mockExecuteProtocol
        .mockReturnValueOnce(manual.promise)
        .mockResolvedValue({ value: "runall" });
      mockExecuteCommand.mockResolvedValue("ok");

      const { result } = renderExecution([src, cmd]);
      let manualRun: Promise<void> | undefined;
      await act(async () => {
        manualRun = result.current.runCell("src");
        await Promise.resolve();
      });

      await act(() => result.current.runAll());
      await act(async () => {
        manual.resolve({ value: "manual-late" });
        await manualRun;
      });

      // Run all resolved the command to its own fresh value; the late manual
      // completion never overwrote it, so no transport ever saw "manual-late".
      expect(commandCalls()).toEqual(["runall"]);
    });

    it("a one-device producer keeps the macro device-scoped and pre-fails a changed device id", async () => {
      const proto = createProtocolCell({ id: "proto" });
      const protoOut = createOutputCell({ producedBy: "proto", data: { seed: 1 } });
      const macro = createMacroCell({ id: "macro" });
      const cmd = refCommand("macro", "value");
      mountProtocol(proto);
      mockConnections = [mockConnection("dev-1", "Device 1")];
      mockExecuteProtocol.mockResolvedValue({ value: "raw" });
      server.mount(contract.macros.executeMacro, {
        body: { macro_id: macro.payload.macroId, success: true, output: { value: "macro-cmd" } },
      });
      mockExecuteCommand.mockResolvedValue("ok");
      const warn = vi.spyOn(console, "warn").mockImplementation(() => undefined);

      const cells = [proto, protoOut, macro, cmd];
      const { result, rerender } = renderExecution(cells);

      await act(() => result.current.runCell("proto"));
      await act(() => result.current.runCell("macro"));
      await act(() => result.current.runCell("cmd"));

      // The macro result is bound to dev-1 (its producer's exact device).
      expect(commandCalls()).toEqual(["macro-cmd"]);

      // Reconnect with a different id: the macro's dev-1 result cannot be reused.
      mockConnections = [mockConnection("dev-2", "Device 2")];
      rerender({ cells });
      await act(() => result.current.runCell("cmd"));

      expect(commandCalls()).toEqual(["macro-cmd"]);
      expect(result.current.commandPreviews.cmd.perDevice[0]?.errorCode).toBe(
        "DEVICE_OUTPUT_MISSING",
      );
      warn.mockRestore();
    });

    it("routes two device groups to distinct dynamic commands with no wrong-group broadcast", async () => {
      // src runs on three devices; the branch routes device 0 -> cmdA and device
      // 1 -> cmdB (each a ref resolving that device's own value). Device 2 matches
      // no path and gets zero transport. cmdA/cmdB never cross device groups.
      const src = createProtocolCell({ id: "src" });
      const cmdA = refCommand("src", "value", "cmdA");
      const cmdB = refCommand("src", "value", "cmdB");
      const branch = createBranchCell({
        id: "branch",
        paths: [
          {
            id: "pA",
            label: "A",
            color: "#111",
            gotoCellId: "cmdA",
            conditions: [
              { id: "cA", sourceCellId: "$device", field: "index", operator: "eq", value: "0" },
            ],
          },
          {
            id: "pB",
            label: "B",
            color: "#222",
            gotoCellId: "cmdB",
            conditions: [
              { id: "cB", sourceCellId: "$device", field: "index", operator: "eq", value: "1" },
            ],
          },
        ],
      });
      mountProtocol(src);
      mockConnections = [
        mockConnection("d1", "Dev 1"),
        mockConnection("d2", "Dev 2"),
        mockConnection("d3", "Dev 3"),
      ];
      mockExecuteProtocol
        .mockResolvedValueOnce({ value: "A" })
        .mockResolvedValueOnce({ value: "B" })
        .mockResolvedValueOnce({ value: "C" });
      mockExecuteCommand.mockResolvedValue("ok");
      const warn = vi.spyOn(console, "warn").mockImplementation(() => undefined);

      const { result } = renderExecution([src, branch, cmdA, cmdB]);
      await act(() => result.current.runCell("src"));
      await act(() => result.current.runCell("branch"));

      // cmdA transported d1's value, cmdB transported d2's value; d3 (no path)
      // never transported, and neither command received the other group's value.
      expect(commandCalls()).toEqual(["A", "B"]);
      expect(result.current.commandPreviews.cmdA.perDevice).toEqual([
        { deviceId: "d1", deviceLabel: "Dev 1", resolved: "A" },
      ]);
      expect(result.current.commandPreviews.cmdB.perDevice).toEqual([
        { deviceId: "d2", deviceLabel: "Dev 2", resolved: "B" },
      ]);
      warn.mockRestore();
    });

    it("per-device macro normalization keeps exact ids, inputs, and errors from the predecessor", async () => {
      const proto = createProtocolCell({ id: "proto" });
      const protoOut = createOutputCell({ producedBy: "proto", data: { seed: 1 } });
      const macro = createMacroCell({ id: "macro" });
      const cmd = refCommand("macro", "out", "cmd");
      mountProtocol(proto);
      mockConnections = [mockConnection("d1", "Dev 1"), mockConnection("d2", "Dev 2")];
      // d1 succeeds; d2's source failed, so the predecessor carries d2's error.
      mockExecuteProtocol
        .mockResolvedValueOnce({ v: "one" })
        .mockRejectedValueOnce(new Error("source boom"));
      server.mount(contract.macros.executeMacro, {
        body: { macro_id: macro.payload.macroId, success: true, output: { out: "ok" } },
      });
      mockExecuteCommand.mockResolvedValue("done");
      const warn = vi.spyOn(console, "warn").mockImplementation(() => undefined);

      const { result } = renderExecution([proto, protoOut, macro, cmd]);
      await act(() => result.current.runCell("proto"));
      await act(() => result.current.runCell("macro"));
      await act(() => result.current.runCell("cmd"));

      // The macro ran once for d1 (exact id + its own input); d2's source error
      // carried through, so the later ref sees SOURCE_DEVICE_FAILED and d2 never
      // transports. Multiplicity/ids/errors all came from the registry, not the
      // single-primary display output.
      expect(commandCalls()).toEqual(["ok"]);
      expect(result.current.commandPreviews.cmd.perDevice).toEqual([
        { deviceId: "d1", deviceLabel: "Dev 1", resolved: "ok" },
        { deviceId: "d2", deviceLabel: "Dev 2", errorCode: "SOURCE_DEVICE_FAILED" },
      ]);
      warn.mockRestore();
    });

    it("a stale macro rejection cannot repaint execution state after invalidation", async () => {
      const proto = createProtocolCell({ id: "proto" });
      const protoOut = createOutputCell({ producedBy: "proto", data: { seed: 1 } });
      const macro = createMacroCell({ id: "macro" });
      mountProtocol(proto);
      setMockConnected(true);
      mockExecuteProtocol.mockResolvedValue({ v: "one" });
      const failure = deferred<undefined>();
      // The macro call fails, but only after we invalidate mid-flight.
      server.use(
        http.post(`${API_URL}/api/v1/macros/:id/execute`, async () => {
          await failure.promise;
          return HttpResponse.json({
            macro_id: macro.payload.macroId,
            success: false,
            error: "SENTINEL_STALE_MACRO",
          });
        }),
      );

      const { result } = renderExecution([proto, protoOut, macro]);
      await act(() => result.current.runCell("proto"));

      let macroRun: Promise<void> | undefined;
      act(() => {
        macroRun = result.current.runCell("macro");
      });
      act(() => result.current.clearOutputs());
      await act(async () => {
        failure.resolve(undefined);
        await macroRun;
      });

      // Clear reset execution states; the stale rejection did not repaint them.
      expect(result.current.executionStates.macro).toBeUndefined();
    });

    it("invalidation synchronously clears a stuck running toolbar and cell states", async () => {
      const q = createQuestionCell({ id: "q" });
      const deferredPrompt = deferred<string>();
      const onPromptQuestion = vi.fn().mockReturnValue(deferredPrompt.promise);

      const { result } = renderExecution([q], { onPromptQuestion });
      let runAllP: Promise<void> | undefined;
      act(() => {
        runAllP = result.current.runAll();
      });
      expect(result.current.isRunningAll).toBe(true);

      // A design/workbook invalidation (not another Run all) must reset the
      // running flag and execution states synchronously.
      act(() => result.current.invalidateExecutableDesign());
      expect(result.current.isRunningAll).toBe(false);
      expect(result.current.executionStates).toEqual({});

      await act(async () => {
        deferredPrompt.resolve("late");
        await runAllP;
      });
      expect(result.current.isRunningAll).toBe(false);
    });

    it("captures only allowlisted telemetry fields and stays console-silent in production", async () => {
      const src = createProtocolCell({ id: "src" });
      const cmd = refCommand("src", "value");
      setMockConnected(true);
      const warn = vi.spyOn(console, "warn").mockImplementation(() => undefined);
      envState.NODE_ENV = "production";

      const { result } = renderExecution([src, cmd]);
      await act(() => result.current.runCell("cmd")); // source never ran -> failure

      expect(mockCapture).toHaveBeenCalledWith(
        "dynamic_command_resolution_failed",
        expect.objectContaining({ code: "COMMAND_OUTPUT_MISSING", commandCellId: "cmd" }),
      );
      const payload = mockCapture.mock.calls.at(-1)?.[1] as Record<string, unknown>;
      expect(Object.keys(payload).sort()).toEqual(
        [
          "code",
          "commandCellId",
          "executionEpoch",
          "field",
          "sourceCellId",
          "targetDeviceId",
          "workbookVersionId",
        ].sort(),
      );
      // No resolved value or source data leaked; production console silent.
      expect(warn).not.toHaveBeenCalled();
      envState.NODE_ENV = "test";
      warn.mockRestore();
    });

    it("a stale display output (no fresh predecessor) is never executed or promoted", async () => {
      // Mount with a persisted display output whose producer never ran this
      // session: there is no fresh registry predecessor for it.
      const proto = createProtocolCell({ id: "proto" });
      const staleOut = createOutputCell({ producedBy: "proto", data: { value: "STALE" } });
      const macro = createMacroCell({ id: "macro" });
      const cmd = refCommand("macro", "value", "cmd");
      setMockConnected(true);
      const macroSpy = vi.fn();
      server.use(
        http.post(`${API_URL}/api/v1/macros/:id/execute`, () => {
          macroSpy();
          return HttpResponse.json({
            macro_id: macro.payload.macroId,
            success: true,
            output: { value: "FRESH" },
          });
        }),
      );
      const warn = vi.spyOn(console, "warn").mockImplementation(() => undefined);

      const { result, getCells } = renderExecution([proto, staleOut, macro, cmd]);
      await act(() => result.current.runCell("macro"));

      // The stale display data was never sent to the macro (fail closed).
      expect(macroSpy).not.toHaveBeenCalled();
      const afterMacro = getCells();
      const macroOut = afterMacro.find((c) => c.type === "output" && c.producedBy === "macro");
      expect(macroOut?.type === "output" ? macroOut.data : undefined).toBeUndefined();

      // No resolver-eligible fresh result was recorded: the ref command pre-fails
      // with zero transport.
      await act(() => result.current.runCell("cmd"));
      expect(mockExecuteCommand).not.toHaveBeenCalled();
      expect(result.current.commandPreviews.cmd.perDevice[0]?.errorCode).toBe(
        "COMMAND_OUTPUT_MISSING",
      );
      warn.mockRestore();
    });

    it("a new epoch (executable edit) strands a prior display output; the macro fails closed", async () => {
      const proto = createProtocolCell({ id: "proto" });
      const displayOut = createOutputCell({ producedBy: "proto", data: { value: "OLD" } });
      const macro = createMacroCell({ id: "macro" });
      const cmd = refCommand("macro", "value", "cmd");
      setMockConnected(true);
      const macroSpy = vi.fn();
      server.use(
        http.post(`${API_URL}/api/v1/macros/:id/execute`, () => {
          macroSpy();
          return HttpResponse.json({
            macro_id: macro.payload.macroId,
            success: true,
            output: { value: "FRESH" },
          });
        }),
      );
      server.mount(contract.protocols.getProtocol, {
        body: createProtocol({ id: proto.payload.protocolId, code: [{ _protocol_set_: [] }] }),
      });
      mockExecuteProtocol.mockResolvedValue({ value: "OLD" });
      const warn = vi.spyOn(console, "warn").mockImplementation(() => undefined);

      const { result } = renderExecution([proto, displayOut, macro, cmd]);
      await act(() => result.current.runCell("proto")); // fresh predecessor exists
      // An executable entity edit bumps the epoch: the registry clears but the
      // display output stays in the authored cells.
      act(() => result.current.invalidateExecutableDesign());
      await act(() => result.current.runCell("macro"));

      expect(macroSpy).not.toHaveBeenCalled();
      await act(() => result.current.runCell("cmd"));
      expect(mockExecuteCommand).not.toHaveBeenCalled();
      expect(result.current.commandPreviews.cmd.perDevice[0]?.errorCode).toBe(
        "COMMAND_OUTPUT_MISSING",
      );
      warn.mockRestore();
    });

    it("Clear then an immediate macro fails closed; the ref command gets zero transport", async () => {
      const proto = createProtocolCell({ id: "proto" });
      const displayOut = createOutputCell({ producedBy: "proto", data: { value: "OLD" } });
      const macro = createMacroCell({ id: "macro" });
      const cmd = refCommand("macro", "value", "cmd");
      setMockConnected(true);
      const macroSpy = vi.fn();
      server.use(
        http.post(`${API_URL}/api/v1/macros/:id/execute`, () => {
          macroSpy();
          return HttpResponse.json({
            macro_id: macro.payload.macroId,
            success: true,
            output: { value: "FRESH" },
          });
        }),
      );
      server.mount(contract.protocols.getProtocol, {
        body: createProtocol({ id: proto.payload.protocolId, code: [{ _protocol_set_: [] }] }),
      });
      mockExecuteProtocol.mockResolvedValue({ value: "OLD" });
      const warn = vi.spyOn(console, "warn").mockImplementation(() => undefined);

      const { result } = renderExecution([proto, displayOut, macro, cmd]);
      await act(() => result.current.runCell("proto")); // fresh predecessor exists
      act(() => result.current.clearOutputs()); // registry cleared synchronously

      await act(() => result.current.runCell("macro"));
      expect(macroSpy).not.toHaveBeenCalled();

      await act(() => result.current.runCell("cmd"));
      expect(mockExecuteCommand).not.toHaveBeenCalled();
      expect(result.current.commandPreviews.cmd.perDevice[0]?.errorCode).toBe(
        "COMMAND_OUTPUT_MISSING",
      );
      warn.mockRestore();
    });

    it("a workbook-key change makes an old-workbook predecessor unusable (zero macro, zero transport)", async () => {
      const proto = createProtocolCell({ id: "proto" });
      const displayOut = createOutputCell({ producedBy: "proto", data: { value: "OLD" } });
      const macro = createMacroCell({ id: "macro" });
      const cmd = refCommand("macro", "value", "cmd");
      setMockConnected(true);
      const macroSpy = vi.fn();
      server.use(
        http.post(`${API_URL}/api/v1/macros/:id/execute`, () => {
          macroSpy();
          return HttpResponse.json({
            macro_id: macro.payload.macroId,
            success: true,
            output: { value: "FRESH" },
          });
        }),
      );
      server.mount(contract.protocols.getProtocol, {
        body: createProtocol({ id: proto.payload.protocolId, code: [{ _protocol_set_: [] }] }),
      });
      mockExecuteProtocol.mockResolvedValue({ value: "OLD" });
      const warn = vi.spyOn(console, "warn").mockImplementation(() => undefined);

      const cells = [proto, displayOut, macro, cmd];
      const { result, rerender } = renderExecution(cells);
      await act(() => result.current.runCell("proto")); // records under wb-1

      // A different workbook is now the design key. The old-workbook registry
      // entry no longer matches current provenance, so the macro fails closed.
      rerender({ cells, workbookId: "wb-2" });
      await act(() => result.current.runCell("macro"));
      expect(macroSpy).not.toHaveBeenCalled();

      await act(() => result.current.runCell("cmd"));
      expect(mockExecuteCommand).not.toHaveBeenCalled();
      expect(result.current.commandPreviews.cmd.perDevice[0]?.errorCode).toBe(
        "COMMAND_OUTPUT_MISSING",
      );
      warn.mockRestore();
    });

    it("a fresh shared predecessor (question) still drives a shared macro that a ref resolves", async () => {
      const question = createQuestionCell({ id: "q", name: "Note" });
      const questionOut = createOutputCell({ producedBy: "q", data: { answer: "hi" } });
      const macro = createMacroCell({ id: "macro" });
      const cmd = refCommand("macro", "result", "cmd");
      setMockConnected(true);
      const onPromptQuestion = vi.fn().mockResolvedValue("hi");
      server.use(
        http.post(`${API_URL}/api/v1/macros/:id/execute`, () => {
          return HttpResponse.json({
            macro_id: macro.payload.macroId,
            success: true,
            output: { result: "computed" },
          });
        }),
      );
      mockExecuteCommand.mockResolvedValue("ok");

      const { result } = renderExecution([question, questionOut, macro, cmd], { onPromptQuestion });
      await act(() => result.current.runCell("q")); // shared predecessor {answer:"hi"}
      await act(() => result.current.runCell("macro")); // shared macro -> {result:"computed"}
      await act(() => result.current.runCell("cmd"));

      // The valid shared path is intact: the ref resolves and transports.
      expect(commandCalls()).toEqual(["computed"]);
      expect(result.current.commandPreviews.cmd.perDevice[0]?.resolved).toBe("computed");
    });

    it("two concurrent producer completions both commit (no dropped output), reverse order", async () => {
      const a = createProtocolCell({ id: "A" });
      const b = createProtocolCell({ id: "B" });
      registerProtocolCodeSource(a.payload.protocolId, () => [{ _protocol_set_: [] }]);
      registerProtocolCodeSource(b.payload.protocolId, () => [{ _protocol_set_: [] }]);
      setMockConnected(true);
      const dA = deferred<{ v: string }>();
      const dB = deferred<{ v: string }>();
      mockExecuteProtocol.mockReturnValueOnce(dA.promise).mockReturnValueOnce(dB.promise);

      const { result, getCells } = renderExecution([a, b]);
      let runA: Promise<void> | undefined;
      let runB: Promise<void> | undefined;
      await act(async () => {
        runA = result.current.runCell("A");
        await Promise.resolve();
      });
      await act(async () => {
        runB = result.current.runCell("B");
        await Promise.resolve();
      });
      // B completes first from its stale [A,B] base; then A. Neither drops the other.
      await act(async () => {
        dB.resolve({ v: "b" });
        await runB;
      });
      await act(async () => {
        dA.resolve({ v: "a" });
        await runA;
      });

      const producers: string[] = [];
      for (const c of getCells()) if (c.type === "output") producers.push(c.producedBy);
      expect(producers.sort()).toEqual(["A", "B"]);
      expect(
        getCells()
          .map((c) => c.id)
          .filter((id) => id === "A" || id === "B"),
      ).toEqual(["A", "B"]);
    });

    it("concurrent question completions keep both answers and both outputs", async () => {
      const q1 = createQuestionCell({ id: "q1", name: "Q1" });
      const q2 = createQuestionCell({ id: "q2", name: "Q2" });
      const dQ1 = deferred<string>();
      const dQ2 = deferred<string>();
      const onPromptQuestion = vi
        .fn()
        .mockReturnValueOnce(dQ1.promise)
        .mockReturnValueOnce(dQ2.promise);

      const { result, getCells } = renderExecution([q1, q2], { onPromptQuestion });
      let runQ1: Promise<void> | undefined;
      let runQ2: Promise<void> | undefined;
      await act(async () => {
        runQ1 = result.current.runCell("q1");
        await Promise.resolve();
      });
      await act(async () => {
        runQ2 = result.current.runCell("q2");
        await Promise.resolve();
      });
      await act(async () => {
        dQ1.resolve("a1");
        await runQ1;
      });
      await act(async () => {
        dQ2.resolve("a2");
        await runQ2;
      });

      const cells = getCells();
      const rq1 = cells.find((c) => c.id === "q1");
      const rq2 = cells.find((c) => c.id === "q2");
      expect(rq1?.type === "question" ? rq1.answer : null).toBe("a1");
      expect(rq2?.type === "question" ? rq2.answer : null).toBe("a2");
      expect(cells.filter((c) => c.type === "output")).toHaveLength(2);
    });

    it("a workbook-key change while a producer is pending makes it inert (token timing)", async () => {
      const src = createProtocolCell({ id: "src" });
      const cmd = refCommand("src", "value");
      registerProtocolCodeSource(src.payload.protocolId, () => [{ _protocol_set_: [] }]);
      setMockConnected(true);
      const d = deferred<{ value: string }>();
      mockExecuteProtocol.mockReturnValue(d.promise);
      const warn = vi.spyOn(console, "warn").mockImplementation(() => undefined);

      const cells = [src, cmd];
      const { result, getCells, rerender } = renderExecution(cells);
      let run: Promise<void> | undefined;
      await act(async () => {
        run = result.current.runCell("src");
        await Promise.resolve();
      });
      // Swap the workbook key while the producer is still pending.
      rerender({ cells, workbookId: "wb-2" });
      await act(async () => {
        d.resolve({ value: "x" });
        await run;
      });

      // The pending producer committed no output, and the source is not fresh.
      expect(getCells().some((c) => c.type === "output")).toBe(false);
      await act(() => result.current.runCell("cmd"));
      expect(mockExecuteCommand).not.toHaveBeenCalled();
      warn.mockRestore();
    });

    it("a queued execution transform applied after invalidation is a no-op", async () => {
      const src = createProtocolCell({ id: "src" });
      registerProtocolCodeSource(src.payload.protocolId, () => [{ _protocol_set_: [] }]);
      setMockConnected(true);
      mockExecuteProtocol.mockResolvedValue({ value: "x" });
      // Host that QUEUES transforms instead of applying them, modeling React's
      // deferred state updates.
      const queued: ((latest: WorkbookCell[]) => WorkbookCell[])[] = [];
      const { result } = renderHook<ReturnType<typeof useWorkbookExecution>, RenderProps>(
        (props) =>
          useWorkbookExecution({
            cells: props.cells,
            onCellsChange: (update) => {
              queued.push(update);
            },
            workbookId: props.workbookId ?? "wb-1",
          }),
        { initialProps: { cells: [src] } },
      );

      await act(() => result.current.runCell("src"));
      expect(queued.length).toBeGreaterThan(0);
      // The producer's transform, captured before any later enqueue.
      const producerTransform = queued[queued.length - 1];

      // Invalidate AFTER the transform was enqueued, then apply it: the
      // in-transform isActive check makes it a no-op (returns latest unchanged).
      act(() => result.current.clearOutputs());
      const latest = [src];
      expect(producerTransform(latest)).toBe(latest);
    });

    it("a concurrent manual run does not make Run all re-execute its branch-consumed target", async () => {
      const branch = createBranchCell({
        id: "b",
        paths: [
          {
            id: "p",
            label: "P",
            color: "",
            gotoCellId: "tgt",
            conditions: [
              { id: "c", sourceCellId: "$device", field: "index", operator: "eq", value: "0" },
            ],
          },
        ],
      });
      const tgt = createProtocolCell({ id: "tgt" });
      registerProtocolCodeSource(tgt.payload.protocolId, () => [{ _protocol_set_: [] }]);
      mockConnections = [mockConnection("dev-1", "D1"), mockConnection("dev-2", "D2")];
      const dTgt = deferred<{ v: string }>();
      // Run all's branch dispatch takes the first (deferred) executor call; the
      // manual run's calls resolve immediately.
      mockExecuteProtocol.mockImplementationOnce(() => dTgt.promise).mockResolvedValue({ v: "ok" });

      const { result } = renderExecution([branch, tgt]);
      let runAllP: Promise<void> | undefined;
      await act(async () => {
        runAllP = result.current.runAll();
        await Promise.resolve();
        await Promise.resolve();
      });
      // While Run all awaits the branch-routed target, a manual run of `tgt`
      // interleaves (its own run-local consumed set).
      await act(() => result.current.runCell("tgt"));
      await act(async () => {
        dTgt.resolve({ v: "ok" });
        await runAllP;
      });

      // Branch dispatched tgt once (dev-1 only) + manual ran it for both devices
      // = 3 calls. Run all's linear walk skipped tgt (run-local consumed), so it
      // was NOT re-run against all devices.
      expect(mockExecuteProtocol).toHaveBeenCalledTimes(3);
    });

    it("keeps static command execution unaffected by generation binding", async () => {
      const staticCmd = createCommandCell({ payload: { content: "battery" } });
      setMockConnected(true);
      mockExecuteCommand.mockResolvedValue("pong");

      const { result, getCells } = renderExecution([staticCmd]);
      await act(() => result.current.runCell(staticCmd.id));

      expect(commandCalls()).toEqual(["battery"]);
      const updated = getCells();
      expect(findOutput(updated, staticCmd.id)).toBeDefined();
    });
  });

  describe("applyExecutionDelta (field-scoped execution patch)", () => {
    const out = (
      id: string,
      producedBy: string,
      extra: Record<string, unknown> = {},
    ): WorkbookCell => ({ id, type: "output", isCollapsed: false, producedBy, ...extra });
    const proto = (id: string): WorkbookCell => ({
      id,
      type: "protocol",
      isCollapsed: false,
      payload: { protocolId: `pid-${id}`, version: 1, name: id },
    });

    it("two independent completions compose in either order without dropping the other's output", () => {
      const latest0 = [proto("A"), proto("B")];
      // A completes from base [A,B] -> [A,outA,B].
      const afterA = [proto("A"), out("oA", "A"), proto("B")];
      const s1 = applyExecutionDelta(latest0, latest0, afterA);
      // B completes from ITS stale base [A,B] -> [A,B,outB] (omits outA).
      const afterB = [proto("A"), proto("B"), out("oB", "B")];
      const s2 = applyExecutionDelta(s1, latest0, afterB);
      expect(s2.map((c) => c.id)).toEqual(["A", "oA", "B", "oB"]);

      // Reverse order yields the same membership.
      const r1 = applyExecutionDelta(latest0, latest0, afterB);
      const r2 = applyExecutionDelta(r1, latest0, afterA);
      expect(
        r2
          .filter((c) => c.type === "output")
          .map((c) => c.id)
          .sort(),
      ).toEqual(["oA", "oB"]);
    });

    it("replaces a producer's own output exactly once (no duplicates on re-run)", () => {
      const base = [proto("A")];
      const first = applyExecutionDelta(base, base, [proto("A"), out("o1", "A")]);
      // Re-run: base was [A, o1], produces a new output o2 for A.
      const reRunBase = [proto("A"), out("o1", "A")];
      const second = applyExecutionDelta(first, reRunBase, [proto("A"), out("o2", "A")]);
      expect(second.filter((c) => c.type === "output").map((c) => c.id)).toEqual(["o2"]);
    });

    it("preserves collapse on unrelated authored AND output cells", () => {
      const latest = [
        { ...proto("A"), isCollapsed: true },
        out("oA", "A", { isCollapsed: true }),
        proto("B"),
      ];
      // B completes; its delta only adds outB.
      const next = applyExecutionDelta(
        latest,
        [proto("A"), proto("B")],
        [proto("A"), proto("B"), out("oB", "B")],
      );
      const a = next.find((c) => c.id === "A");
      const oA = next.find((c) => c.id === "oA");
      expect(a?.isCollapsed).toBe(true);
      expect(oA?.isCollapsed).toBe(true);
    });

    it("patches only the executed cell's runtime fields, leaving others intact", () => {
      const q1: WorkbookCell = {
        id: "q1",
        type: "question",
        isCollapsed: false,
        name: "Q1",
        question: { kind: "open_ended", text: "?", required: false },
        answer: "kept",
        isAnswered: true,
      };
      const q2Base: WorkbookCell = {
        id: "q2",
        type: "question",
        isCollapsed: false,
        name: "Q2",
        question: { kind: "open_ended", text: "?", required: false },
        isAnswered: false,
      };
      const latest = [q1, q2Base];
      // q2 completes from a base where q1 was UNanswered; must not roll back q1.
      const before = [{ ...q1, answer: undefined, isAnswered: false }, q2Base];
      const after = [
        { ...q1, answer: undefined, isAnswered: false },
        { ...q2Base, answer: "new", isAnswered: true },
        out("oQ2", "q2"),
      ];
      const result = applyExecutionDelta(latest, before, after);
      const rq1 = result.find((c) => c.id === "q1");
      const rq2 = result.find((c) => c.id === "q2");
      expect(rq1?.type === "question" ? rq1.answer : null).toBe("kept");
      expect(rq2?.type === "question" ? rq2.answer : null).toBe("new");
      expect(result.some((c) => c.type === "output" && c.producedBy === "q2")).toBe(true);
    });

    it("removes an owned output when a completion drops it", () => {
      const latest = [proto("A"), out("oA", "A")];
      const result = applyExecutionDelta(latest, [proto("A"), out("oA", "A")], [proto("A")]);
      expect(result.some((c) => c.type === "output")).toBe(false);
    });

    it("carries the latest owned output's collapse onto a rerun replacement", () => {
      const latest = [proto("A"), out("oOld", "A", { isCollapsed: true })];
      // Re-run from base [A, oOld] produces a fresh output oNew (default open).
      const result = applyExecutionDelta(
        latest,
        [proto("A"), out("oOld", "A")],
        [proto("A"), out("oNew", "A")],
      );
      const owned = result.find((c) => c.type === "output" && c.producedBy === "A");
      expect(owned?.id).toBe("oNew");
      expect(owned?.isCollapsed).toBe(true);
    });

    const branchCell = (id: string, evaluatedPathId?: string): WorkbookCell => ({
      id,
      type: "branch",
      isCollapsed: false,
      paths: [{ id: "p", label: "P", color: "", conditions: [] }],
      evaluatedPathId,
    });

    it("composes two independent branch evaluations without clobbering", () => {
      const base = [branchCell("b1"), branchCell("b2")];
      const s1 = applyExecutionDelta(base, base, [
        branchCell("b1", "p"),
        branchCell("b2"),
        out("ob1", "b1"),
      ]);
      const s2 = applyExecutionDelta(s1, base, [
        branchCell("b1"),
        branchCell("b2", "p"),
        out("ob2", "b2"),
      ]);
      const rb1 = s2.find((c) => c.id === "b1");
      const rb2 = s2.find((c) => c.id === "b2");
      expect(rb1?.type === "branch" ? rb1.evaluatedPathId : null).toBe("p");
      expect(rb2?.type === "branch" ? rb2.evaluatedPathId : null).toBe("p");
    });

    it("isolates two question answers applied in reverse completion order", () => {
      const q = (id: string, answer?: string): WorkbookCell => ({
        id,
        type: "question",
        isCollapsed: false,
        name: id,
        question: { kind: "open_ended", text: "?", required: false },
        answer,
        isAnswered: answer !== undefined,
      });
      const base = [q("q1"), q("q2")];
      // q2 completes first, then q1 (reverse of authored order).
      const s1 = applyExecutionDelta(base, base, [q("q1"), q("q2", "a2"), out("o2", "q2")]);
      const s2 = applyExecutionDelta(s1, base, [q("q1", "a1"), q("q2"), out("o1", "q1")]);
      const r1 = s2.find((c) => c.id === "q1");
      const r2 = s2.find((c) => c.id === "q2");
      expect(r1?.type === "question" ? r1.answer : null).toBe("a1");
      expect(r2?.type === "question" ? r2.answer : null).toBe("a2");
    });
  });
});
