import {
  createMacroCell,
  createOutputCell,
  createProtocol,
  createProtocolCell,
} from "@/test/factories";
import { API_URL } from "@/test/msw/mount";
import { server } from "@/test/msw/server";
import { renderHook, act } from "@/test/test-utils";
import { http, HttpResponse } from "msw";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { __resetProtocolCodeRegistry } from "~/lib/protocol-code-registry";

import { contract } from "@repo/api/contract";
import type { WorkbookCell } from "@repo/api/domains/workbook/workbook-cells.schema";

import { useWorkbookExecution } from "./useWorkbookExecution";

/**
 * Ticket 7 cross-host qualification, web host. Runs the canonical dynamic flow
 * end-to-end through the real execution hook:
 *
 *   protocol -> Python macro emitting { toDevice } -> ref command -> reply
 *
 * for one device, two devices with differing strings, command-output chaining,
 * a one-device source failure, and workbook-version invalidation. Scenario
 * variants (question fan-out, loops, branch subsets, epoch races) are covered
 * by the ticket 5/6 suites next to this file.
 */

const mockExecuteProtocol = vi.fn();
const mockExecuteCommand = vi.fn();

function mockConnection(id: string, label: string) {
  return {
    id,
    label,
    family: "multispeq" as const,
    identity: { family: "multispeq" as const, name: label, raw: {} },
    driver: {},
  };
}
let mockConnections: ReturnType<typeof mockConnection>[] = [];

vi.mock("~/hooks/iot/useIotConnections/useIotConnections", () => ({
  useIotConnections: () => ({
    connections: mockConnections,
    isConnecting: false,
    error: null,
    connect: vi.fn(),
    disconnectDevice: vi.fn(),
    disconnectAll: vi.fn(),
  }),
}));

vi.mock("~/hooks/iot/useIotProtocolExecution/useIotProtocolExecution", () => ({
  executeProtocolWithDriver: (_driver: unknown, _family: unknown, code: unknown): unknown =>
    mockExecuteProtocol(code) as unknown,
  executeCommandWithDriver: (_driver: unknown, command: unknown): unknown =>
    mockExecuteCommand(command) as unknown,
}));

vi.mock("posthog-js/react", () => ({
  usePostHog: () => ({ capture: vi.fn() }),
}));

interface RenderProps {
  cells: WorkbookCell[];
  workbookId?: string;
}

function renderExecution(cells: WorkbookCell[]) {
  let committed = cells;
  const onCellsChange = vi.fn((update: (latest: WorkbookCell[]) => WorkbookCell[]) => {
    committed = update(committed);
  });
  const result = renderHook<ReturnType<typeof useWorkbookExecution>, RenderProps>(
    (props) =>
      useWorkbookExecution({
        onCellsChange,
        cells: props.cells,
        workbookId: props.workbookId ?? "wb-1",
      }),
    { initialProps: { cells } },
  );
  return { ...result, onCellsChange, getCells: () => committed };
}

function refCommand(id: string, sourceCellId: string, field: string): WorkbookCell {
  return {
    id,
    type: "command",
    isCollapsed: false,
    payload: { kind: "ref", ref: { sourceCellId, field } },
  };
}

function canonicalCells() {
  const proto = createProtocolCell({ id: "proto-1" });
  const macro = createMacroCell({ id: "macro-1" });
  return {
    proto,
    macro,
    cells: [
      proto,
      // The macro's measurement input rides the producer's display output;
      // per-device fan-out authority stays with the runtime registry.
      createOutputCell({ producedBy: "proto-1", data: {} }),
      macro,
      refCommand("cmd-1", "macro-1", "toDevice"),
      refCommand("cmd-2", "cmd-1", "response"),
    ] as WorkbookCell[],
  };
}

/** Server-side Python macro double: computes { toDevice } from the device scan. */
function mountCalibrationMacro(macroId: string) {
  server.use(
    http.post(`${API_URL}/api/v1/macros/:id/execute`, async ({ request }) => {
      const body = (await request.json()) as { data?: { spad?: number } };
      return HttpResponse.json({
        macro_id: macroId,
        success: true,
        output: { toDevice: `set_calibration ${body.data?.spad}` },
      });
    }),
  );
}

function commandCalls(): unknown[] {
  return mockExecuteCommand.mock.calls.map((call) => call[0] as unknown);
}

function findOutput(cells: WorkbookCell[], producedBy: string) {
  const output = cells.find((cell) => cell.type === "output" && cell.producedBy === producedBy);
  return output?.type === "output" ? output : undefined;
}

describe("web qualification: canonical protocol -> macro { toDevice } -> ref command -> reply", () => {
  beforeEach(() => {
    mockConnections = [];
    mockExecuteProtocol.mockReset();
    mockExecuteCommand.mockReset();
    __resetProtocolCodeRegistry();
  });

  it("completes the one-device chain and chains the retained reply", async () => {
    const { proto, macro, cells } = canonicalCells();
    server.mount(contract.protocols.getProtocol, {
      body: createProtocol({ id: proto.payload.protocolId, code: [{ _protocol_set_: [] }] }),
    });
    mountCalibrationMacro(macro.payload.macroId);
    mockConnections = [mockConnection("dev-1", "MultispeQ 1")];
    mockExecuteProtocol.mockResolvedValue({ spad: 41.5 });
    mockExecuteCommand.mockImplementation((command: unknown) => ({
      response: `echo:${String(command)}`,
    }));

    const { result, getCells } = renderExecution(cells);
    await act(() => result.current.runCell("proto-1"));
    await act(() => result.current.runCell("macro-1"));
    await act(() => result.current.runCell("cmd-1"));
    await act(() => result.current.runCell("cmd-2"));

    expect(commandCalls()).toEqual(["set_calibration 41.5", "echo:set_calibration 41.5"]);
    // The first command's reply is retained as its own output (classic
    // single-device shape) and fed the second ref command above.
    expect(findOutput(getCells(), "cmd-1")?.data).toEqual({
      response: "echo:set_calibration 41.5",
    });
  });

  it("sends each of two devices only its own computed string, end to end", async () => {
    const { proto, macro, cells } = canonicalCells();
    server.mount(contract.protocols.getProtocol, {
      body: createProtocol({ id: proto.payload.protocolId, code: [{ _protocol_set_: [] }] }),
    });
    mountCalibrationMacro(macro.payload.macroId);
    mockConnections = [mockConnection("dev-1", "MultispeQ 1"), mockConnection("dev-2", "MultispeQ 2")];
    mockExecuteProtocol.mockResolvedValueOnce({ spad: 41.5 }).mockResolvedValueOnce({ spad: 38.2 });
    mockExecuteCommand.mockImplementation((command: unknown) => ({
      response: `echo:${String(command)}`,
    }));

    const { result } = renderExecution(cells);
    await act(() => result.current.runCell("proto-1"));
    await act(() => result.current.runCell("macro-1"));
    await act(() => result.current.runCell("cmd-1"));
    await act(() => result.current.runCell("cmd-2"));

    expect(commandCalls()).toEqual([
      "set_calibration 41.5",
      "set_calibration 38.2",
      "echo:set_calibration 41.5",
      "echo:set_calibration 38.2",
    ]);
    expect(result.current.commandPreviews["cmd-1"].perDevice).toEqual([
      { deviceId: "dev-1", deviceLabel: "MultispeQ 1", resolved: "set_calibration 41.5" },
      { deviceId: "dev-2", deviceLabel: "MultispeQ 2", resolved: "set_calibration 38.2" },
    ]);
  });

  it("pre-fails only the device whose source failed; the other completes the chain", async () => {
    const { proto, macro, cells } = canonicalCells();
    server.mount(contract.protocols.getProtocol, {
      body: createProtocol({ id: proto.payload.protocolId, code: [{ _protocol_set_: [] }] }),
    });
    mountCalibrationMacro(macro.payload.macroId);
    mockConnections = [mockConnection("dev-1", "MultispeQ 1"), mockConnection("dev-2", "MultispeQ 2")];
    // dev-2's protocol scan fails at the source.
    mockExecuteProtocol
      .mockResolvedValueOnce({ spad: 41.5 })
      .mockRejectedValueOnce(new Error("device not open"));
    mockExecuteCommand.mockImplementation((command: unknown) => ({
      response: `echo:${String(command)}`,
    }));
    const warn = vi.spyOn(console, "warn").mockImplementation(() => undefined);

    const { result } = renderExecution(cells);
    await act(() => result.current.runCell("proto-1"));
    await act(() => result.current.runCell("macro-1"));
    await act(() => result.current.runCell("cmd-1"));

    // Only dev-1's value reached transport; dev-2 is a typed pre-failure.
    expect(commandCalls()).toEqual(["set_calibration 41.5"]);
    expect(result.current.commandPreviews["cmd-1"].perDevice).toEqual([
      { deviceId: "dev-1", deviceLabel: "MultispeQ 1", resolved: "set_calibration 41.5" },
      { deviceId: "dev-2", deviceLabel: "MultispeQ 2", errorCode: "SOURCE_DEVICE_FAILED" },
    ]);
    // Telemetry carries codes and ids, never the resolved string.
    expect(JSON.stringify(warn.mock.calls)).not.toContain("set_calibration");
    warn.mockRestore();
  });

  it("a workbook change invalidates the whole chain before transport", async () => {
    const { proto, macro, cells } = canonicalCells();
    server.mount(contract.protocols.getProtocol, {
      body: createProtocol({ id: proto.payload.protocolId, code: [{ _protocol_set_: [] }] }),
    });
    mountCalibrationMacro(macro.payload.macroId);
    mockConnections = [mockConnection("dev-1", "MultispeQ 1")];
    mockExecuteProtocol.mockResolvedValue({ spad: 41.5 });
    mockExecuteCommand.mockResolvedValue("ok");
    const warn = vi.spyOn(console, "warn").mockImplementation(() => undefined);

    const { result, rerender } = renderExecution(cells);
    await act(() => result.current.runCell("proto-1"));
    await act(() => result.current.runCell("macro-1"));

    // Switching to another workbook version keys a fresh execution session.
    rerender({ cells, workbookId: "wb-2" });
    await act(() => result.current.runCell("cmd-1"));

    expect(mockExecuteCommand).not.toHaveBeenCalled();
    expect(result.current.commandPreviews["cmd-1"].perDevice[0]?.errorCode).toBe(
      "COMMAND_OUTPUT_MISSING",
    );
    warn.mockRestore();
  });
});
