"use client";

import { useMutation } from "@tanstack/react-query";
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
import { orpc, orpcClient } from "~/lib/orpc";
import { getLiveProtocolCode } from "~/lib/protocol-code-registry";
import { parseApiError } from "~/util/apiError";

import type { SensorFamily } from "@repo/api/domains/protocol/protocol.schema";
import type {
  BranchCell,
  CommandCell,
  MacroCell,
  OutputCell,
  OutputDeviceResult,
  ProtocolCell,
  QuestionCell,
  WorkbookCell,
} from "@repo/api/domains/workbook/workbook-cells.schema";
import {
  buildCellNamespace,
  isOutputDataNormalizationError,
} from "@repo/api/transforms/build-cell-namespace";
import { resolveInlineCommand } from "@repo/api/transforms/command-payload";
import { toDeviceContext } from "@repo/api/transforms/device-context";
import { presentDevice } from "@repo/api/transforms/device-presentation";
import {
  evaluateBranch,
  isDeviceScopedBranch,
  validateBranchCell,
  validateDeviceBranch,
} from "@repo/api/transforms/evaluate-branch";

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
    const result = await orpcClient.protocols.getProtocol({ id: cell.payload.protocolId });
    const code = result.code;
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

function secondaryDeviceLabel(device: IotDeviceConnection): string {
  return (
    device.identity.deviceId ??
    (device.ordinal != null ? `Device #${device.ordinal}` : device.label)
  );
}

function resultDisplayLabel(result: OutputDeviceResult): string {
  const presentation = presentDevice({ name: result.deviceName, family: result.family });
  const primary =
    presentation.provenance === "fallback"
      ? (result.deviceLabel ?? result.deviceId)
      : presentation.primary;
  const secondary = [
    presentation.provenance === "name" ? presentation.productName : null,
    result.deviceLabel,
  ]
    .filter((value): value is string => value != null && value !== primary)
    .filter((value, index, values) => values.indexOf(value) === index);
  return [primary, ...secondary].join(" · ");
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

  const executeMacroMutation = useMutation(orpc.macros.executeMacro.mutationOptions());

  const connectionsRef = useRef(connections);
  connectionsRef.current = connections;
  const executeMacroMutationRef = useRef(executeMacroMutation);
  executeMacroMutationRef.current = executeMacroMutation;

  const setCellState = useCallback(
    (cellId: string, state: Omit<CellExecutionState, "executionOrder">) => {
      setExecutionStates((prev) => {
        const existing = prev[cellId] as CellExecutionState | undefined;
        return { ...prev, [cellId]: { ...state, executionOrder: existing?.executionOrder } };
      });
    },
    [],
  );

  const execCounterRef = useRef(0);

  // Collapse per-device settled outcomes into one output cell. Primary `data`
  // keeps the legacy result shape, while `deviceResults` now carries identity
  // for both single- and multi-device runs.
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
      const results: {
        deviceId: string;
        deviceLabel: string;
        family: SensorFamily;
        deviceName?: string;
        data?: Record<string, unknown>;
        error?: string;
      }[] = devices.map((d, i) => {
        const outcome = settled[i];
        const identity = { family: d.family, deviceName: d.identity.name };
        const deviceLabel = secondaryDeviceLabel(d);
        return outcome.status === "fulfilled"
          ? { deviceId: d.id, deviceLabel, ...identity, data: normalize(outcome.value) }
          : {
              deviceId: d.id,
              deviceLabel,
              ...identity,
              error:
                outcome.reason instanceof Error
                  ? outcome.reason.message
                  : String(outcome.reason ?? fallbackMessage),
            };
      });
      const successes = results.filter((r) => r.error === undefined);
      const failures = results.filter((r) => r.error !== undefined);
      const isMulti = devices.length > 1;
      const messages = isMulti ? failures.map((f) => `${resultDisplayLabel(f)}: ${f.error}`) : [];

      if (successes.length === 0) {
        const message = failures[0]?.error ?? fallbackMessage;
        setCellState(cellId, { status: "error", error: message });
        const errorOutput = {
          ...(isMulti
            ? makeOutputCell(cellId, undefined, executionTime, messages)
            : makeErrorOutputCell(cellId, message, executionTime)),
          deviceResults: results,
        };
        return insertOutputAfterCell(currentCells, cellId, errorOutput);
      }

      // Partial failure stays "completed": the successful devices' data is
      // usable and the failed ones are called out in the output messages.
      setCellState(cellId, { status: "completed" });
      const output = makeOutputCell(cellId, successes[0].data, executionTime, messages);
      return insertOutputAfterCell(currentCells, cellId, { ...output, deviceResults: results });
    },
    [setCellState],
  );

  const runProtocolCell = useCallback(
    async (
      cell: ProtocolCell,
      currentCells: WorkbookCell[],
      deviceSubset?: IotDeviceConnection[],
    ) => {
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
      const devices = deviceSubset ?? connectionsRef.current;
      // Each driver runs with the family the handshake identified; switching
      // the toolbar family must not retarget live drivers.
      const settled = await Promise.allSettled(
        devices.map((d) => executeProtocolWithDriver(d.driver, d.family, protocolCode)),
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
    async (
      cell: CommandCell,
      currentCells: WorkbookCell[],
      deviceSubset?: IotDeviceConnection[],
    ) => {
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

      const devices = deviceSubset ?? connectionsRef.current;
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
  const executeMacroOn = useCallback(
    async (macroId: string, data: Record<string, unknown>, context?: Record<string, unknown>) => {
      let result;
      try {
        result = await executeMacroMutationRef.current.mutateAsync({ id: macroId, data, context });
      } catch (err) {
        // oRPC throws an ORPCError on HTTP errors; surface the server's message.
        throw new Error(parseApiError(err)?.message ?? "Macro execution failed");
      }
      if (!result.success) {
        throw new Error(result.error ?? "Macro execution failed");
      }
      return result.output;
    },
    [],
  );

  // The $device entry a macro run for this connection reads from ctx.
  const deviceContextFor = useCallback((deviceId?: string) => {
    const connections = connectionsRef.current;
    const index = deviceId ? connections.findIndex((c) => c.id === deviceId) : 0;
    const connection = connections.at(Math.max(index, 0));
    return connection ? toDeviceContext(connection.identity, Math.max(index, 0)) : undefined;
  }, []);

  const runMacroCell = useCallback(
    async (cell: MacroCell, cellIndex: number, currentCells: WorkbookCell[]) => {
      const input = findPrecedingOutput(currentCells, cellIndex);
      // A macro can run from ctx alone; error only when there is neither a
      // nearest measurement nor any upstream output to read.
      if (!input) {
        const namespace = buildCellNamespace(currentCells, cellIndex);
        if (Object.keys(namespace.byId).length === 0) {
          setCellState(cell.id, { status: "error", error: "No input data available" });
          return insertOutputAfterCell(
            currentCells,
            cell.id,
            makeErrorOutputCell(
              cell.id,
              "No measurement data available - run a protocol cell first",
            ),
          );
        }
      }

      setCellState(cell.id, { status: "running" });
      const startTime = performance.now();

      // Multi-device input: the macro runs once per device's measurement,
      // serialized; devices whose measurement failed carry their error through.
      const inputResults = input?.deviceResults;
      if (inputResults && inputResults.length > 1) {
        const settled: PromiseSettledResult<unknown>[] = [];
        for (const r of inputResults) {
          try {
            if (r.data == null) {
              throw new Error("No measurement data from this device");
            }
            // Each device's run reads a ctx scoped to ITS results, plus its
            // own $device entry.
            const ns = buildCellNamespace(currentCells, cellIndex, {
              deviceId: r.deviceId,
              device: deviceContextFor(r.deviceId),
            });
            settled.push({
              status: "fulfilled",
              value: await executeMacroOn(
                cell.payload.macroId,
                r.data as Record<string, unknown>,
                ns.ctx,
              ),
            });
          } catch (err) {
            settled.push({ status: "rejected", reason: err });
          }
        }
        const executionTime = performance.now() - startTime;

        const results: OutputDeviceResult[] = inputResults.map((r, i) => {
          const outcome = settled[i];
          const identity = { family: r.family, deviceName: r.deviceName };
          return outcome.status === "fulfilled"
            ? { deviceId: r.deviceId, deviceLabel: r.deviceLabel, ...identity, data: outcome.value }
            : {
                deviceId: r.deviceId,
                deviceLabel: r.deviceLabel,
                ...identity,
                error:
                  outcome.reason instanceof Error
                    ? outcome.reason.message
                    : "Macro execution failed",
              };
        });
        const successes = results.filter((r) => r.error === undefined);
        const failures = results.filter((r) => r.error !== undefined);
        const messages = failures.map((f) => `${resultDisplayLabel(f)}: ${f.error}`);

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
        const ns = buildCellNamespace(currentCells, cellIndex, {
          device: deviceContextFor(),
        });
        const output = await executeMacroOn(
          cell.payload.macroId,
          (input?.data ?? {}) as Record<string, unknown>,
          ns.ctx,
        );
        const executionTime = performance.now() - startTime;
        setCellState(cell.id, { status: "completed" });
        const singleInputIdentity = inputResults?.length === 1 ? inputResults[0] : undefined;
        return insertOutputAfterCell(currentCells, cell.id, {
          ...makeOutputCell(cell.id, output, executionTime, []),
          ...(singleInputIdentity
            ? {
                deviceResults: [
                  {
                    deviceId: singleInputIdentity.deviceId,
                    deviceLabel: singleInputIdentity.deviceLabel,
                    family: singleInputIdentity.family,
                    deviceName: singleInputIdentity.deviceName,
                    data: output,
                  },
                ],
              }
            : {}),
        });
      } catch (err) {
        const executionTime = performance.now() - startTime;
        const message = err instanceof Error ? err.message : "Macro execution failed";
        setCellState(cell.id, { status: "error", error: message });
        const singleInputIdentity = inputResults?.length === 1 ? inputResults[0] : undefined;
        return insertOutputAfterCell(currentCells, cell.id, {
          ...makeErrorOutputCell(cell.id, message, executionTime),
          ...(singleInputIdentity
            ? {
                deviceResults: [
                  {
                    deviceId: singleInputIdentity.deviceId,
                    deviceLabel: singleInputIdentity.deviceLabel,
                    family: singleInputIdentity.family,
                    deviceName: singleInputIdentity.deviceName,
                    error: message,
                  },
                ],
              }
            : {}),
        });
      }
    },
    [setCellState, executeMacroOn, deviceContextFor],
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

  // Target cells a device-scoped branch already executed this run; the linear
  // walk skips each exactly once instead of re-running it.
  const dispatchConsumedRef = useRef(new Set<string>());

  /**
   * Device-scoped branch = dispatcher: every connected device evaluates the
   * branch with ITS identity, devices group by resolved path, and each path's
   * protocol/command target runs against only its group. Devices matching no
   * path are skipped with a message, never an error. No jump: execution
   * continues after the branch, and consumed targets are skipped once.
   */
  const runDeviceDispatchBranch = useCallback(
    async (cell: BranchCell, currentCells: WorkbookCell[]): Promise<WorkbookCell[]> => {
      const connections = connectionsRef.current;
      if (connections.length === 0) {
        setCellState(cell.id, { status: "error", error: "No device connected" });
        return insertOutputAfterCell(
          currentCells,
          cell.id,
          makeErrorOutputCell(cell.id, "No device connected - connect devices to dispatch"),
        );
      }

      const groups = new Map<string, IotDeviceConnection[]>();
      const skipped: IotDeviceConnection[] = [];
      connections.forEach((connection, index) => {
        const path = evaluateBranch(cell, currentCells, {
          device: toDeviceContext(connection.identity, index),
          deviceId: connection.id,
        });
        const target = path?.gotoCellId
          ? currentCells.find((c) => c.id === path.gotoCellId)
          : undefined;
        if (path && target && (target.type === "protocol" || target.type === "command")) {
          const group = groups.get(path.id);
          if (group) group.push(connection);
          else groups.set(path.id, [connection]);
        } else {
          skipped.push(connection);
        }
      });

      let updated = currentCells;
      const messages: string[] = [];
      for (const path of cell.paths) {
        const group = groups.get(path.id);
        if (!group || group.length === 0 || !path.gotoCellId) continue;
        const target = updated.find((c) => c.id === path.gotoCellId);
        if (!target) continue;
        messages.push(`${path.label || "Unnamed path"} -> ${group.map((g) => g.label).join(", ")}`);
        dispatchConsumedRef.current.add(target.id);
        updated =
          target.type === "protocol"
            ? await runProtocolCell(target, updated, group)
            : target.type === "command"
              ? await runCommandCell(target, updated, group)
              : updated;
      }
      for (const s of skipped) {
        messages.push(`${s.label} (${s.family}): no measurement resolved this round`);
      }

      setCellState(cell.id, { status: "completed" });
      updated = insertOutputAfterCell(
        updated,
        cell.id,
        makeOutputCell(cell.id, undefined, 0, messages),
      );
      // A dispatcher matches several paths at once; no single ACTIVE path.
      return updated.map((c) => (c.id === cell.id ? { ...cell, evaluatedPathId: undefined } : c));
    },
    [setCellState, runProtocolCell, runCommandCell],
  );

  const runBranchCell = useCallback(
    async (
      cell: BranchCell,
      currentCells: WorkbookCell[],
      pass?: number,
    ): Promise<WorkbookCell[]> => {
      setCellState(cell.id, { status: "running" });

      const configErrors = [
        ...validateBranchCell(cell),
        ...validateDeviceBranch(cell, currentCells),
      ];
      if (configErrors.length > 0) {
        setCellState(cell.id, { status: "error", error: configErrors.join("; ") });
        return insertOutputAfterCell(
          currentCells,
          cell.id,
          makeOutputCell(cell.id, undefined, 0, configErrors),
        );
      }

      if (isDeviceScopedBranch(cell)) {
        try {
          return await runDeviceDispatchBranch(cell, currentCells);
        } catch (err) {
          if (!isOutputDataNormalizationError(err)) throw err;
          setCellState(cell.id, { status: "error", error: err.message });
          return insertOutputAfterCell(
            currentCells,
            cell.id,
            makeErrorOutputCell(cell.id, err.message),
          );
        }
      }

      let matchedPath: ReturnType<typeof evaluateBranch>;
      try {
        matchedPath = evaluateBranch(cell, currentCells);
      } catch (err) {
        if (!isOutputDataNormalizationError(err)) throw err;
        setCellState(cell.id, { status: "error", error: err.message });
        return insertOutputAfterCell(
          currentCells,
          cell.id,
          makeErrorOutputCell(cell.id, err.message),
        );
      }
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
    [setCellState, runDeviceDispatchBranch],
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

      dispatchConsumedRef.current.clear();
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

            if (dispatchConsumedRef.current.has(c.id)) {
              dispatchConsumedRef.current.delete(c.id);
              continue;
            }

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
    dispatchConsumedRef.current.clear();

    for (let i = 0; i < currentCells.length; i++) {
      if (shouldAbort()) break;

      const cell = currentCells[i];

      if (cell.type === "output" || cell.type === "markdown") continue;

      // A device-scoped branch already ran this target with its device group;
      // skip it exactly once.
      if (dispatchConsumedRef.current.has(cell.id)) {
        dispatchConsumedRef.current.delete(cell.id);
        continue;
      }

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
    connectedDevices: connections.map(({ id, label, ordinal, family, identity }) => ({
      id,
      label,
      ordinal,
      family,
      name: identity.name,
      stableId: identity.deviceId,
    })),
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
