"use client";

import { useCallback, useRef, useState } from "react";
import type {
  IotDeviceConnection,
  WorkbookConnectionType,
} from "~/hooks/iot/useIotConnections/useIotConnections";
import { useIotConnections } from "~/hooks/iot/useIotConnections/useIotConnections";
import {
  executeCommandWithDriver,
  executeProtocolWithDriver,
} from "~/hooks/iot/useIotProtocolExecution/useIotProtocolExecution";
import { getLiveProtocolCode } from "~/lib/protocol-code-registry";
import { tsr } from "~/lib/tsr";

import type { SensorFamily } from "@repo/api/schemas/protocol.schema";
import type {
  BranchCell,
  CommandCell,
  MacroCell,
  OutputCell,
  ProtocolCell,
  QuestionCell,
  WorkbookCell,
} from "@repo/api/schemas/workbook-cells.schema";
import { resolveInlineCommand } from "@repo/api/utils/command-payload";
import { evaluateBranch, validateBranchCell } from "@repo/api/utils/evaluate-branch";

type CellExecutionStatus = "idle" | "running" | "completed" | "error";

interface CellExecutionState {
  status: CellExecutionStatus;
  error?: string;
  // Jupyter-style: each run appends the global counter value.
  executionOrder?: number[];
}

interface UseWorkbookExecutionOptions {
  cells: WorkbookCell[];
  onCellsChange: (cells: WorkbookCell[]) => void;
  onPromptQuestion?: (cell: QuestionCell) => Promise<string | undefined>;
}

function resolveSensorFamily(_cells: WorkbookCell[]): SensorFamily {
  return "multispeq";
}

async function getProtocolCode(cell: ProtocolCell): Promise<Record<string, unknown>[] | null> {
  // Prefer the live editor code so the device runs exactly what is on screen,
  // with no redundant backend round-trip. Fall back to the last saved version
  // only when no editor is mounted for this protocol (or it holds invalid code).
  const live = getLiveProtocolCode(cell.payload.protocolId);
  if (live && live.length > 0) return live;

  try {
    const result = await tsr.protocols.getProtocol.query({
      params: { id: cell.payload.protocolId },
    });
    if (result.status !== 200) return null;
    const code = result.body.code;
    if (code.length > 0) {
      return code;
    }
    return null;
  } catch {
    return null;
  }
}

function findPrecedingOutput(cells: WorkbookCell[], beforeIndex: number): OutputCell | null {
  for (let i = beforeIndex - 1; i >= 0; i--) {
    const c = cells[i];
    if (c.type === "output" && (c.data != null || (c.deviceResults?.length ?? 0) > 0)) {
      return c;
    }
  }
  return null;
}

// Replaces any previous output produced by the same source cell.
function insertOutputAfterCell(
  currentCells: WorkbookCell[],
  sourceCellId: string,
  outputCell: OutputCell,
): WorkbookCell[] {
  const filtered = currentCells.filter(
    (c) => !(c.type === "output" && c.producedBy === sourceCellId),
  );
  const idx = filtered.findIndex((c) => c.id === sourceCellId);
  const updated = [...filtered];
  updated.splice(idx + 1, 0, outputCell);
  return updated;
}

function makeOutputCell(
  producedBy: string,
  data: Record<string, unknown> | undefined,
  executionTime: number,
  messages: string[],
): OutputCell {
  return {
    id: crypto.randomUUID(),
    type: "output",
    isCollapsed: false,
    producedBy,
    data,
    executionTime,
    messages,
  };
}

function makeErrorOutputCell(producedBy: string, error: string, executionTime = 0): OutputCell {
  return makeOutputCell(producedBy, undefined, executionTime, [error]);
}

// Normalises any non-object device response into the output cell's data shape.
function toOutputData(data: unknown): Record<string, unknown> {
  if (data !== null && typeof data === "object" && !Array.isArray(data)) {
    return data as Record<string, unknown>;
  }
  return { response: data };
}

export function useWorkbookExecution({
  cells,
  onCellsChange,
  onPromptQuestion,
}: UseWorkbookExecutionOptions) {
  const [executionStates, setExecutionStates] = useState<Record<string, CellExecutionState>>({});
  const [isRunningAll, setIsRunningAll] = useState(false);
  const [sensorFamily, setSensorFamilyState] = useState<SensorFamily>(() =>
    resolveSensorFamily(cells),
  );
  const [connectionType, setConnectionType] = useState<WorkbookConnectionType>("serial");
  const abortRef = useRef(false);

  const cellsRef = useRef(cells);
  cellsRef.current = cells;
  const onCellsChangeRef = useRef(onCellsChange);
  onCellsChangeRef.current = onCellsChange;
  const onPromptQuestionRef = useRef(onPromptQuestion);
  onPromptQuestionRef.current = onPromptQuestion;

  const setSensorFamily = useCallback((family: SensorFamily) => {
    setSensorFamilyState(family);
  }, []);

  const { connections, isConnecting, connect, disconnectDevice, disconnectAll } =
    useIotConnections(sensorFamily);
  const isConnected = connections.length > 0;

  const executeMacroMutation = tsr.macros.executeMacro.useMutation();

  const connectionsRef = useRef(connections);
  connectionsRef.current = connections;
  const sensorFamilyRef = useRef(sensorFamily);
  sensorFamilyRef.current = sensorFamily;
  const executeMacroMutationRef = useRef(executeMacroMutation);
  executeMacroMutationRef.current = executeMacroMutation;

  const setCellState = useCallback(
    (cellId: string, state: Omit<CellExecutionState, "executionOrder">) => {
      setExecutionStates((prev) => {
        const existing = prev[cellId];
        return { ...prev, [cellId]: { ...state, executionOrder: existing.executionOrder } };
      });
    },
    [],
  );

  const execCounterRef = useRef(0);

  // Collapse per-device settled outcomes into one output cell. A single
  // device keeps the exact legacy output shape; several devices additionally
  // carry per-device results, with failures listed as messages.
  const finishDeviceFanOut = useCallback(
    (
      cellId: string,
      devices: IotDeviceConnection[],
      settled: PromiseSettledResult<unknown>[],
      executionTime: number,
      currentCells: WorkbookCell[],
      fallbackMessage: string,
      normalize: (data: unknown) => Record<string, unknown>,
    ): WorkbookCell[] => {
      const results = devices.map((d, i) => {
        const outcome = settled[i];
        return outcome.status === "fulfilled"
          ? { deviceId: d.id, deviceLabel: d.label, data: normalize(outcome.value) }
          : {
              deviceId: d.id,
              deviceLabel: d.label,
              error:
                outcome.reason instanceof Error
                  ? outcome.reason.message
                  : String(outcome.reason ?? fallbackMessage),
            };
      });
      const successes = results.filter((r) => r.error === undefined);
      const failures = results.filter((r) => r.error !== undefined);
      const isMulti = devices.length > 1;
      const messages = isMulti ? failures.map((f) => `${f.deviceLabel}: ${f.error}`) : [];

      if (successes.length === 0) {
        const message = failures[0]?.error ?? fallbackMessage;
        setCellState(cellId, { status: "error", error: message });
        const errorOutput = isMulti
          ? {
              ...makeOutputCell(cellId, undefined, executionTime, messages),
              deviceResults: results,
            }
          : makeErrorOutputCell(cellId, message, executionTime);
        return insertOutputAfterCell(currentCells, cellId, errorOutput);
      }

      // Partial failure stays "completed": the successful devices' data is
      // usable and the failed ones are called out in the output messages.
      setCellState(cellId, { status: "completed" });
      const output = makeOutputCell(cellId, successes[0].data, executionTime, messages);
      return insertOutputAfterCell(
        currentCells,
        cellId,
        isMulti ? { ...output, deviceResults: results } : output,
      );
    },
    [setCellState],
  );

  const runProtocolCell = useCallback(
    async (cell: ProtocolCell, currentCells: WorkbookCell[]) => {
      const protocolCode = await getProtocolCode(cell);
      if (!protocolCode) {
        setCellState(cell.id, { status: "error", error: "Invalid or missing protocol code" });
        return insertOutputAfterCell(
          currentCells,
          cell.id,
          makeErrorOutputCell(cell.id, "Invalid or missing protocol JSON"),
        );
      }

      if (connectionsRef.current.length === 0) {
        // The page-level Run handler short-circuits to connect() before this
        // path on direct Run clicks; this branch covers Run all + scripted
        // entry points where we still need a recorded error.
        setCellState(cell.id, { status: "error", error: "No device connected" });
        return insertOutputAfterCell(
          currentCells,
          cell.id,
          makeErrorOutputCell(
            cell.id,
            "No device connected - connect a device to run this protocol",
          ),
        );
      }

      setCellState(cell.id, { status: "running" });
      const startTime = performance.now();

      // Multi-device fan-out (see mobile Multi-scan): one protocol, every
      // connected device in parallel, per-device outcomes.
      const devices = connectionsRef.current;
      const settled = await Promise.allSettled(
        devices.map((d) =>
          executeProtocolWithDriver(d.driver, sensorFamilyRef.current, protocolCode),
        ),
      );
      return finishDeviceFanOut(
        cell.id,
        devices,
        settled,
        performance.now() - startTime,
        currentCells,
        "Execution failed",
        (data) => data as Record<string, unknown>,
      );
    },
    [setCellState, finishDeviceFanOut],
  );

  const runCommandCell = useCallback(
    async (cell: CommandCell, currentCells: WorkbookCell[]) => {
      let command: string | Record<string, unknown> | unknown[];
      try {
        command = resolveInlineCommand(cell.payload);
      } catch (err) {
        const message = err instanceof Error ? err.message : "Invalid command content";
        setCellState(cell.id, { status: "error", error: message });
        return insertOutputAfterCell(currentCells, cell.id, makeErrorOutputCell(cell.id, message));
      }

      if (connectionsRef.current.length === 0) {
        setCellState(cell.id, { status: "error", error: "No device connected" });
        return insertOutputAfterCell(
          currentCells,
          cell.id,
          makeErrorOutputCell(
            cell.id,
            "No device connected - connect a device to run this command",
          ),
        );
      }

      setCellState(cell.id, { status: "running" });
      const startTime = performance.now();

      const devices = connectionsRef.current;
      const settled = await Promise.allSettled(
        devices.map((d) => executeCommandWithDriver(d.driver, command)),
      );
      return finishDeviceFanOut(
        cell.id,
        devices,
        settled,
        performance.now() - startTime,
        currentCells,
        "Command execution failed",
        toOutputData,
      );
    },
    [setCellState, finishDeviceFanOut],
  );

  // Runs the macro once against one device's measurement; throws on failure.
  const executeMacroOn = useCallback(async (macroId: string, data: Record<string, unknown>) => {
    const result = await executeMacroMutationRef.current.mutateAsync({
      params: { id: macroId },
      body: { data },
    });
    if (!result.body.success) {
      throw new Error(result.body.error ?? "Macro execution failed");
    }
    return result.body.output;
  }, []);

  const runMacroCell = useCallback(
    async (cell: MacroCell, cellIndex: number, currentCells: WorkbookCell[]) => {
      const input = findPrecedingOutput(currentCells, cellIndex);
      if (!input) {
        setCellState(cell.id, { status: "error", error: "No input data available" });
        return insertOutputAfterCell(
          currentCells,
          cell.id,
          makeErrorOutputCell(cell.id, "No measurement data available - run a protocol cell first"),
        );
      }

      setCellState(cell.id, { status: "running" });
      const startTime = performance.now();

      // Multi-device input: apply the macro to EVERY device's measurement
      // individually, so each sensor gets its own derived output. Runs are
      // serialized: each is its own sandbox invocation, and a handful of
      // sequential calls beats hammering the executor concurrently. Devices
      // whose measurement already failed carry their error through.
      const inputResults = input.deviceResults;
      if (inputResults && inputResults.length > 1) {
        const settled: PromiseSettledResult<unknown>[] = [];
        for (const r of inputResults) {
          try {
            if (r.data == null) {
              throw new Error("No measurement data from this device");
            }
            settled.push({
              status: "fulfilled",
              value: await executeMacroOn(cell.payload.macroId, r.data as Record<string, unknown>),
            });
          } catch (err) {
            settled.push({ status: "rejected", reason: err });
          }
        }
        const executionTime = performance.now() - startTime;

        const results = inputResults.map((r, i) => {
          const outcome = settled[i];
          return outcome.status === "fulfilled"
            ? { deviceId: r.deviceId, deviceLabel: r.deviceLabel, data: outcome.value }
            : {
                deviceId: r.deviceId,
                deviceLabel: r.deviceLabel,
                error:
                  outcome.reason instanceof Error
                    ? outcome.reason.message
                    : "Macro execution failed",
              };
        });
        const successes = results.filter((r) => r.error === undefined);
        const failures = results.filter((r) => r.error !== undefined);
        const messages = failures.map((f) => `${f.deviceLabel ?? f.deviceId}: ${f.error}`);

        if (successes.length === 0) {
          setCellState(cell.id, {
            status: "error",
            error: failures[0]?.error ?? "Macro execution failed",
          });
          return insertOutputAfterCell(currentCells, cell.id, {
            ...makeOutputCell(cell.id, undefined, executionTime, messages),
            deviceResults: results,
          });
        }

        setCellState(cell.id, { status: "completed" });
        return insertOutputAfterCell(currentCells, cell.id, {
          ...makeOutputCell(
            cell.id,
            successes[0].data as Record<string, unknown>,
            executionTime,
            messages,
          ),
          deviceResults: results,
        });
      }

      try {
        const output = await executeMacroOn(
          cell.payload.macroId,
          input.data as Record<string, unknown>,
        );
        const executionTime = performance.now() - startTime;
        setCellState(cell.id, { status: "completed" });
        return insertOutputAfterCell(
          currentCells,
          cell.id,
          makeOutputCell(cell.id, output, executionTime, []),
        );
      } catch (err) {
        const executionTime = performance.now() - startTime;
        const message = err instanceof Error ? err.message : "Macro execution failed";
        setCellState(cell.id, { status: "error", error: message });
        return insertOutputAfterCell(
          currentCells,
          cell.id,
          makeErrorOutputCell(cell.id, message, executionTime),
        );
      }
    },
    [setCellState, executeMacroOn],
  );

  const runQuestionCell = useCallback(
    async (cell: QuestionCell, currentCells: WorkbookCell[]): Promise<WorkbookCell[]> => {
      if (!cell.question.text.trim()) {
        setCellState(cell.id, { status: "error", error: "Question text is required" });
        return insertOutputAfterCell(
          currentCells,
          cell.id,
          makeErrorOutputCell(cell.id, "Question text is required: add a question before running"),
        );
      }

      const promptFn = onPromptQuestionRef.current;
      if (!promptFn) return currentCells;

      setCellState(cell.id, { status: "running" });

      try {
        const answer = await promptFn(cell);
        if (answer === undefined) {
          setCellState(cell.id, { status: "idle" });
          return currentCells;
        }

        setCellState(cell.id, { status: "completed" });
        const updated = currentCells.map((c) =>
          c.id === cell.id ? { ...cell, answer, isAnswered: true } : c,
        );
        return insertOutputAfterCell(updated, cell.id, makeOutputCell(cell.id, { answer }, 0, []));
      } catch {
        setCellState(cell.id, { status: "error", error: "Question prompt failed" });
        return currentCells;
      }
    },
    [setCellState],
  );

  const runBranchCell = useCallback(
    (cell: BranchCell, currentCells: WorkbookCell[], pass?: number): WorkbookCell[] => {
      setCellState(cell.id, { status: "running" });

      const configErrors = validateBranchCell(cell);
      if (configErrors.length > 0) {
        setCellState(cell.id, { status: "error", error: configErrors.join("; ") });
        return insertOutputAfterCell(
          currentCells,
          cell.id,
          makeOutputCell(cell.id, undefined, 0, configErrors),
        );
      }

      const matchedPath = evaluateBranch(cell, currentCells);
      setCellState(cell.id, { status: "completed" });

      const passLabel = pass != null ? ` (pass ${pass})` : "";
      const messages = matchedPath
        ? [`Matched: ${matchedPath.label || "Unnamed path"}${passLabel}`]
        : [`No path matched${passLabel}`];

      const updated = insertOutputAfterCell(
        currentCells,
        cell.id,
        makeOutputCell(cell.id, undefined, 0, messages),
      );
      return updated.map((c) =>
        c.id === cell.id ? { ...cell, evaluatedPathId: matchedPath?.id } : c,
      );
    },
    [setCellState],
  );

  const dispatchCell = useCallback(
    async (
      cell: WorkbookCell,
      currentCells: WorkbookCell[],
      pass?: number,
    ): Promise<WorkbookCell[]> => {
      const cellIndex = currentCells.findIndex((c) => c.id === cell.id);

      const order = ++execCounterRef.current;
      setExecutionStates((prev) => {
        const existing = prev[cell.id] as CellExecutionState | undefined;
        const prevOrder = existing?.executionOrder ?? [];
        return {
          ...prev,
          [cell.id]: {
            ...existing,
            status: "running" as const,
            executionOrder: [...prevOrder, order],
          },
        };
      });

      switch (cell.type) {
        case "protocol":
          return runProtocolCell(cell, currentCells);
        case "command":
          return runCommandCell(cell, currentCells);
        case "macro":
          return runMacroCell(cell, cellIndex, currentCells);
        case "question":
          return runQuestionCell(cell, currentCells);
        case "branch":
          return runBranchCell(cell, currentCells, pass);
        default:
          return currentCells;
      }
    },
    [runProtocolCell, runCommandCell, runMacroCell, runQuestionCell, runBranchCell],
  );

  // Returns the jump index into `currentCells`, or -1 if no jump.
  const resolveBranchJump = (branchCellId: string, currentCells: WorkbookCell[]): number => {
    const branch = currentCells.find((c) => c.id === branchCellId);
    if (branch?.type !== "branch" || !branch.evaluatedPathId) return -1;
    const matchedPath = branch.paths.find((p) => p.id === branch.evaluatedPathId);
    if (!matchedPath?.gotoCellId) return -1;
    return currentCells.findIndex((c) => c.id === matchedPath.gotoCellId);
  };

  const runCell = useCallback(
    async (cellId: string) => {
      let currentCells = cellsRef.current;
      const cell = currentCells.find((c) => c.id === cellId);
      if (!cell) return;

      currentCells = await dispatchCell(cell, currentCells);
      onCellsChangeRef.current(currentCells);

      if (cell.type === "branch") {
        const jumpIndex = resolveBranchJump(cell.id, currentCells);
        if (jumpIndex !== -1) {
          const visitCounts = new Map<string, number>();
          const MAX_VISITS = 100;

          for (let i = jumpIndex; i < currentCells.length; i++) {
            const c = currentCells[i];
            if (c.type === "output" || c.type === "markdown") continue;

            const count = visitCounts.get(c.id) ?? 0;
            if (count >= MAX_VISITS) continue;
            visitCounts.set(c.id, count + 1);

            currentCells = await dispatchCell(c, currentCells, count + 1);
            onCellsChangeRef.current(currentCells);

            if (c.type === "branch") {
              const nestedJump = resolveBranchJump(c.id, currentCells);
              if (nestedJump !== -1) i = nestedJump - 1;
            }
          }
        }
      }
    },
    [dispatchCell],
  );

  // Extracted so TS does not narrow abortRef.current to its initial value across awaits.
  const shouldAbort = () => abortRef.current;

  const runAll = useCallback(async () => {
    setIsRunningAll(true);
    abortRef.current = false;
    execCounterRef.current = 0;
    setExecutionStates({});

    let currentCells = [...cellsRef.current];
    const visitCounts = new Map<string, number>();
    const MAX_VISITS_PER_CELL = 100;

    for (let i = 0; i < currentCells.length; i++) {
      if (shouldAbort()) break;

      const cell = currentCells[i];

      if (cell.type === "output" || cell.type === "markdown") continue;

      // Cap revisits to avoid infinite loops from branch jumps.
      const count = visitCounts.get(cell.id) ?? 0;
      if (count >= MAX_VISITS_PER_CELL) continue;
      visitCounts.set(cell.id, count + 1);

      currentCells = await dispatchCell(cell, currentCells, count + 1);
      onCellsChangeRef.current(currentCells);

      if (cell.type === "branch") {
        const jumpIndex = resolveBranchJump(cell.id, currentCells);
        if (jumpIndex !== -1) i = jumpIndex - 1;
      }
    }

    setIsRunningAll(false);
  }, [dispatchCell]);

  const stopExecution = useCallback(() => {
    abortRef.current = true;
  }, []);

  const clearOutputs = useCallback(() => {
    const filtered = cellsRef.current.filter((c) => c.type !== "output");
    onCellsChangeRef.current(filtered);
    execCounterRef.current = 0;
    setExecutionStates({});
  }, []);

  const connectDevice = useCallback(() => connect(connectionType), [connect, connectionType]);

  return {
    isConnected,
    isConnecting,
    connectedDevices: connections.map(({ id, label }) => ({ id, label })),
    sensorFamily,
    setSensorFamily,
    connectionType,
    setConnectionType,
    connect: connectDevice,
    disconnect: disconnectAll,
    disconnectDevice,

    executionStates,
    isRunningAll,
    runCell,
    runAll,
    stopExecution,
    clearOutputs,
  };
}
