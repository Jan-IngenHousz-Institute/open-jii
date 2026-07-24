import { describe, expect, it, vi } from "vitest";

import type { CommandCell, WorkbookCell } from "../domains/workbook/workbook-cells.schema";
import { cellsToFlowGraph } from "./cells-to-flow";
import type { ResolvedCommand } from "./command-payload";
import { resolveCommandPayload } from "./command-payload";
import type { CommandResolutionFailure } from "./command-resolution";
import { flowNodesToWorkbookCells } from "./flow-to-workbook-cells";
import type { OutputProvenance, RuntimeCellOutput } from "./runtime-output";
import { runtimeOutputFromQuestionAnswer } from "./runtime-output";

/**
 * Ticket 7 cross-host qualification, shared layer. Simulates a host runtime
 * (registry + transport) around the one shared resolver both hosts delegate
 * to, and walks the canonical flow end-to-end:
 *
 *   protocol -> Python macro emitting { toDevice } -> ref command -> reply
 *
 * including the workbook <-> flow round trip a published version travels
 * through. Every failure scenario asserts the transport was never invoked and
 * the typed failure carries identifiers only, never resolved values.
 */

const uuid = "11111111-1111-1111-1111-111111111111";
const ACTIVE: OutputProvenance = { workbookVersionId: "version-2", executionEpoch: "epoch-1" };

const DEVICE_A = "multispeq-serial-a";
const DEVICE_B = "multispeq-serial-b";

function protocolCell(id: string): WorkbookCell {
  return { id, type: "protocol", isCollapsed: false, payload: { protocolId: uuid, version: 1, name: "SPAD" } };
}

function macroCell(id: string): WorkbookCell {
  return { id, type: "macro", isCollapsed: false, payload: { macroId: uuid, language: "python", name: "Compute calibration" } };
}

function questionCell(id: string): WorkbookCell {
  return {
    id,
    type: "question",
    isCollapsed: false,
    name: "Calibration constant",
    question: { kind: "open_ended", text: "Which constant?", required: false },
    isAnswered: true,
  };
}

function refCommand(id: string, sourceCellId: string, field: string): CommandCell {
  return { id, type: "command", isCollapsed: false, payload: { kind: "ref", ref: { sourceCellId, field } } };
}

/**
 * Minimal host simulator: a per-producer registry with active provenance, a
 * transport double, and a run step that resolves per target device and lets
 * only ok resolutions reach the transport, mirroring both hosts' contract.
 */
class HostSimulator {
  registry = new Map<string, RuntimeCellOutput>();
  transport = vi.fn((deviceId: string, _value: ResolvedCommand): unknown => ({
    response: `ack:${deviceId}`,
  }));
  failures: CommandResolutionFailure[] = [];

  constructor(
    public cells: WorkbookCell[],
    public provenance: OutputProvenance = ACTIVE,
  ) {}

  getRuntimeCellOutput = (cellId: string): RuntimeCellOutput | undefined =>
    this.registry.get(cellId);

  recordDeviceOutput(
    cellId: string,
    results: { deviceId: string; data?: unknown; error?: string }[],
    provenance: OutputProvenance = this.provenance,
  ): void {
    this.registry.set(cellId, {
      scope: "device",
      provenance,
      deviceResults: results.map((entry) =>
        entry.error === undefined
          ? { deviceId: entry.deviceId, data: entry.data }
          : { deviceId: entry.deviceId, error: entry.error },
      ),
    });
  }

  recordQuestionAnswer(cellId: string, answer: string): void {
    this.registry.set(cellId, runtimeOutputFromQuestionAnswer(answer, this.provenance));
  }

  /** Per-device macro run consuming the protocol registry entry, like both hosts. */
  runPerDeviceMacro(
    macroId: string,
    upstreamCellId: string,
    compute: (deviceId: string, upstream: unknown) => Record<string, unknown>,
  ): void {
    const upstream = this.registry.get(upstreamCellId);
    if (upstream?.scope !== "device") throw new Error("macro upstream must be device-scoped");
    this.registry.set(macroId, {
      scope: "device",
      provenance: this.provenance,
      deviceResults: upstream.deviceResults.map((result) =>
        result.error === undefined
          ? { deviceId: result.deviceId, data: compute(result.deviceId, result.data) }
          : { deviceId: result.deviceId, error: result.error },
      ),
    });
  }

  /** Resolve a command for each target; dispatch only ok values; record replies. */
  runCommandCell(commandCellId: string, targetDeviceIds: string[]): void {
    const commandCell = this.cells.find(
      (cell): cell is CommandCell => cell.id === commandCellId && cell.type === "command",
    );
    if (!commandCell) throw new Error(`missing command cell ${commandCellId}`);

    const replies: { deviceId: string; data?: unknown; error?: string }[] = [];
    for (const targetDeviceId of targetDeviceIds) {
      const resolution = resolveCommandPayload({
        commandCell,
        cells: this.cells,
        targetDeviceId,
        activeProvenance: this.provenance,
        getRuntimeCellOutput: this.getRuntimeCellOutput,
      });
      if (!resolution.ok) {
        this.failures.push(resolution.error);
        continue;
      }
      replies.push({ deviceId: targetDeviceId, data: this.transport(targetDeviceId, resolution.value) });
    }
    if (replies.length > 0) this.recordDeviceOutput(commandCellId, replies);
  }
}

/** The canonical published workbook, after a cells -> flow -> cells round trip. */
function canonicalCells(): WorkbookCell[] {
  const authored: WorkbookCell[] = [
    protocolCell("protocol-1"),
    macroCell("macro-1"),
    refCommand("command-1", "macro-1", "toDevice"),
    refCommand("command-2", "command-1", "response"),
  ];
  const graph = cellsToFlowGraph(authored);
  return flowNodesToWorkbookCells(graph.nodes, graph.edges);
}

describe("qualification: canonical protocol -> macro { toDevice } -> ref command -> reply", () => {
  it("survives the workbook <-> flow round trip with both refs intact and ordered", () => {
    const cells = canonicalCells();
    expect(cells.map((cell) => cell.id)).toEqual(["protocol-1", "macro-1", "command-1", "command-2"]);
    const command1 = cells[2] as CommandCell;
    const command2 = cells[3] as CommandCell;
    expect(command1.payload).toMatchObject({ kind: "ref", ref: { sourceCellId: "macro-1", field: "toDevice" } });
    expect(command2.payload).toMatchObject({ kind: "ref", ref: { sourceCellId: "command-1", field: "response" } });
  });

  it("completes the one-device chain and retains the reply as a later source", () => {
    const host = new HostSimulator(canonicalCells());
    host.recordDeviceOutput("protocol-1", [{ deviceId: DEVICE_A, data: { spad: 41.5 } }]);
    host.runPerDeviceMacro("macro-1", "protocol-1", (deviceId, upstream) => ({
      toDevice: `set_calibration ${(upstream as { spad: number }).spad} ${deviceId}`,
    }));

    host.runCommandCell("command-1", [DEVICE_A]);
    expect(host.transport).toHaveBeenCalledExactlyOnceWith(
      DEVICE_A,
      `set_calibration 41.5 ${DEVICE_A}`,
    );
    expect(host.failures).toEqual([]);

    // The command's own reply is the registry entry a later ref consumes.
    host.runCommandCell("command-2", [DEVICE_A]);
    expect(host.transport).toHaveBeenCalledTimes(2);
    expect(host.transport).toHaveBeenLastCalledWith(DEVICE_A, `ack:${DEVICE_A}`);
    expect(host.failures).toEqual([]);
  });

  it("sends each of two devices only its own computed string", () => {
    const host = new HostSimulator(canonicalCells());
    host.recordDeviceOutput("protocol-1", [
      { deviceId: DEVICE_A, data: { spad: 41.5 } },
      { deviceId: DEVICE_B, data: { spad: 38.2 } },
    ]);
    host.runPerDeviceMacro("macro-1", "protocol-1", (_deviceId, upstream) => ({
      toDevice: `set_calibration ${(upstream as { spad: number }).spad}`,
    }));

    host.runCommandCell("command-1", [DEVICE_A, DEVICE_B]);
    expect(host.failures).toEqual([]);
    expect(host.transport.mock.calls).toEqual([
      [DEVICE_A, "set_calibration 41.5"],
      [DEVICE_B, "set_calibration 38.2"],
    ]);
  });

  it("fans a shared question answer out to both devices unchanged", () => {
    const cells: WorkbookCell[] = [questionCell("question-1"), refCommand("command-1", "question-1", "answer")];
    const host = new HostSimulator(cells);
    host.recordQuestionAnswer("question-1", "set_led 4");

    host.runCommandCell("command-1", [DEVICE_A, DEVICE_B]);
    expect(host.failures).toEqual([]);
    expect(host.transport.mock.calls).toEqual([
      [DEVICE_A, "set_led 4"],
      [DEVICE_B, "set_led 4"],
    ]);
  });

  it("consumes only the latest same-epoch completion after a loop refresh", () => {
    const host = new HostSimulator(canonicalCells());
    host.recordDeviceOutput("protocol-1", [{ deviceId: DEVICE_A, data: { spad: 1 } }]);
    host.runPerDeviceMacro("macro-1", "protocol-1", () => ({ toDevice: "first-pass" }));
    // Second loop pass overwrites the producer entry within the same epoch.
    host.runPerDeviceMacro("macro-1", "protocol-1", () => ({ toDevice: "second-pass" }));

    host.runCommandCell("command-1", [DEVICE_A]);
    expect(host.transport).toHaveBeenCalledExactlyOnceWith(DEVICE_A, "second-pass");
  });
});

describe("qualification: every invalid case fails before transport", () => {
  function expectBlocked(
    host: HostSimulator,
    code: string,
    context: Partial<CommandResolutionFailure> = {},
  ): void {
    expect(host.transport).not.toHaveBeenCalled();
    expect(host.failures).toHaveLength(1);
    expect(host.failures[0]).toMatchObject({ code, ...context });
  }

  it("branch-skipped source (never ran this cycle) blocks with no device call", () => {
    const host = new HostSimulator(canonicalCells());
    // Branch skipped protocol-1/macro-1 entirely: registry stays empty.
    host.runCommandCell("command-1", [DEVICE_A]);
    expectBlocked(host, "COMMAND_OUTPUT_MISSING");
  });

  it("a visually later source stays ineligible even when a goto executed it first", () => {
    const cells: WorkbookCell[] = [
      refCommand("command-1", "macro-late", "toDevice"),
      macroCell("macro-late"),
    ];
    const host = new HostSimulator(cells);
    // The goto ran the later macro first, so its output IS fresh in-registry.
    host.recordDeviceOutput("macro-late", [{ deviceId: DEVICE_A, data: { toDevice: "x" } }]);
    host.runCommandCell("command-1", [DEVICE_A]);
    expectBlocked(host, "COMMAND_SOURCE_NOT_EARLIER");
  });

  it.each([
    ["missing field", { other: "value" }, "COMMAND_FIELD_MISSING"],
    ["empty-string field", { toDevice: "   " }, "COMMAND_VALUE_EMPTY"],
    ["non-string field", { toDevice: 42 }, "COMMAND_VALUE_NOT_STRING"],
  ])("%s blocks with a typed failure", (_label, macroData, code) => {
    const host = new HostSimulator(canonicalCells());
    host.recordDeviceOutput("macro-1", [{ deviceId: DEVICE_A, data: macroData }]);
    host.runCommandCell("command-1", [DEVICE_A]);
    expectBlocked(host, code);
  });

  it("a stale epoch (new run/iteration) blocks the prior output", () => {
    const host = new HostSimulator(canonicalCells());
    host.recordDeviceOutput("macro-1", [{ deviceId: DEVICE_A, data: { toDevice: "stale" } }], {
      workbookVersionId: ACTIVE.workbookVersionId,
      executionEpoch: "epoch-0",
    });
    host.runCommandCell("command-1", [DEVICE_A]);
    expectBlocked(host, "COMMAND_SOURCE_STALE");
  });

  it("output produced under a prior workbook version blocks", () => {
    const host = new HostSimulator(canonicalCells());
    host.recordDeviceOutput("macro-1", [{ deviceId: DEVICE_A, data: { toDevice: "old" } }], {
      workbookVersionId: "version-1",
      executionEpoch: ACTIVE.executionEpoch,
    });
    host.runCommandCell("command-1", [DEVICE_A]);
    expectBlocked(host, "COMMAND_SOURCE_STALE");
  });

  it("one device's source failure pre-fails only that device; the other still runs", () => {
    const host = new HostSimulator(canonicalCells());
    host.recordDeviceOutput("macro-1", [
      { deviceId: DEVICE_A, error: "MACRO_EXECUTION_FAILED" },
      { deviceId: DEVICE_B, data: { toDevice: "set_calibration 38.2" } },
    ]);
    host.runCommandCell("command-1", [DEVICE_A, DEVICE_B]);

    expect(host.failures).toEqual([
      expect.objectContaining({ code: "SOURCE_DEVICE_FAILED", targetDeviceId: DEVICE_A }),
    ]);
    expect(host.transport).toHaveBeenCalledExactlyOnceWith(DEVICE_B, "set_calibration 38.2");
  });

  it("a reconnected device with a new id must rerun the source", () => {
    const host = new HostSimulator(canonicalCells());
    host.recordDeviceOutput("macro-1", [{ deviceId: DEVICE_A, data: { toDevice: "value" } }]);
    host.runCommandCell("command-1", ["multispeq-serial-a-reconnected"]);
    expectBlocked(host, "DEVICE_OUTPUT_MISSING", {
      targetDeviceId: "multispeq-serial-a-reconnected",
    });
  });

  it("failure diagnostics carry identifiers only, never resolved or raw source values", () => {
    const secret = "set_calibration 41.5 SECRET-CONSTANT";
    const host = new HostSimulator(canonicalCells());
    host.recordDeviceOutput("macro-1", [
      { deviceId: DEVICE_A, data: { toDevice: secret, note: "raw-source-data" } },
    ]);
    // Wrong target id: resolution fails while the registry holds the secret.
    host.runCommandCell("command-1", [DEVICE_B]);

    expect(host.transport).not.toHaveBeenCalled();
    const serialized = JSON.stringify(host.failures);
    expect(serialized).not.toContain(secret);
    expect(serialized).not.toContain("raw-source-data");
    expect(host.failures[0]).toEqual({
      code: "DEVICE_OUTPUT_MISSING",
      commandCellId: "command-1",
      sourceCellId: "macro-1",
      field: "toDevice",
      targetDeviceId: DEVICE_B,
    });
  });
});
