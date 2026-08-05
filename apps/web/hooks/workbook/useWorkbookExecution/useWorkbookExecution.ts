"use client";

import { useMutation } from "@tanstack/react-query";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { sensorFamilyToDeviceType } from "~/hooks/iot/device-type-mapping";
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
import type { QuestionCell, WorkbookCell } from "@repo/api/domains/workbook/workbook-cells.schema";
import type {
  CellRunStatus,
  DeviceOutcome,
  DeviceRef,
  RunnerState,
  WorkbookRunnerPorts,
} from "@repo/workbook";
import {
  carryOverState,
  effectiveCellRuns,
  mergeCellsView,
  pendingTrackInteractions,
  WorkbookRunner,
} from "@repo/workbook";

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

function toExecutionStatus(status: CellRunStatus): CellExecutionStatus {
  switch (status) {
    case "running":
      return "running";
    case "completed":
      return "completed";
    case "error":
      return "error";
    default:
      // stale / cancelled / interrupted re-arm the cell.
      return "idle";
  }
}

// Normalises any non-object device response into the output cell's data shape.
function toOutputData(data: unknown): Record<string, unknown> {
  if (data !== null && typeof data === "object" && !Array.isArray(data)) {
    return data as Record<string, unknown>;
  }
  return { response: data };
}

function secondaryDeviceLabel(connection: IotDeviceConnection): string {
  return (
    connection.identity.deviceId ??
    (connection.ordinal != null ? `Device #${connection.ordinal}` : connection.label)
  );
}

function toDeviceRef(connection: IotDeviceConnection): DeviceRef {
  return {
    id: connection.id,
    label: secondaryDeviceLabel(connection),
    family: sensorFamilyToDeviceType(connection.family),
    deviceId: connection.identity.deviceId,
    deviceName: connection.identity.name,
    firmwareVersion: connection.identity.firmwareVersion,
    batteryPercent: connection.identity.batteryPercent,
  };
}

/**
 * Thin adapter binding the env-agnostic WorkbookRunner (notebook mode) to the
 * web editor: the device-connection registry and backend mutations plug in as
 * runner ports, and runner results fold back into the cell array so
 * persistence keeps working. Multi-device fan-out, per-device macro runs, and
 * device-scoped dispatch branches all live in the runtime; the ports only
 * execute one effect against the requested device subset.
 *
 * The runner treats cells as an immutable program, so a fresh runner is built
 * lazily at each run entry point when the cell array identity (or the sensor
 * family) changed; outputs, run records and counters carry over by cell id.
 * Cell edits made while a pass is running take effect on the next run.
 */
export function useWorkbookExecution({
  cells,
  onCellsChange,
  onPromptQuestion,
}: UseWorkbookExecutionOptions) {
  const [runnerState, setRunnerState] = useState<Readonly<RunnerState> | null>(null);
  const [promptingCellId, setPromptingCellId] = useState<string | null>(null);
  const [sensorFamily, setSensorFamilyState] = useState<SensorFamily>("multispeq");
  const [connectionType, setConnectionType] = useState<WorkbookConnectionType>("serial");

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
  const sensorFamilyRef = useRef(sensorFamily);
  sensorFamilyRef.current = sensorFamily;

  const ports = useMemo<WorkbookRunnerPorts>(
    () => ({
      macroRunner: {
        run: async (input) => {
          // A macro can run from ctx alone; error only when there is neither a
          // nearest measurement nor any upstream output to read.
          if (input.json == null && Object.keys(input.ctx.byId).length === 0) {
            throw new Error("No measurement data available - run a protocol cell first");
          }
          let result;
          try {
            result = await executeMacroMutationRef.current.mutateAsync({
              id: input.macroId,
              data: input.json ?? {},
              context: input.ctx.ctx,
            });
          } catch (err) {
            // oRPC throws an ORPCError on HTTP errors; surface the server's message.
            throw new Error(parseApiError(err)?.message ?? "Macro execution failed");
          }
          if (!result.success) {
            throw new Error(result.error ?? "Macro execution failed");
          }
          return result.output ?? {};
        },
      },
      commandExecutor: {
        execute: async (input, { signal }) => {
          const all = connectionsRef.current;
          const devices = all.filter((connection) => input.deviceIds.includes(connection.id));
          if (devices.length === 0) {
            throw new Error(
              input.source.kind === "inlineCell"
                ? "No device connected - connect a device to run this command"
                : "No device connected - connect a device to run this protocol",
            );
          }
          // Protocol code runs through the protocol executor; inline commands
          // and macro-constructed console commands go straight to the driver.
          const asProtocol =
            input.source.kind === "protocolCell" ||
            (input.source.kind === "artifact" && input.source.artifact === "protocol");
          const onAbort = () => {
            for (const d of devices) {
              // Cancel is a MultispeQ driver capability, not yet on IDeviceDriver.
              void (d.driver as { cancel?: () => Promise<void> }).cancel?.();
            }
          };
          signal.addEventListener("abort", onAbort);
          try {
            // One effect, every targeted device in parallel; per-device
            // outcomes. Each driver runs with the family the handshake
            // identified, never the toolbar selection.
            const settled = await Promise.allSettled(
              devices.map((d) =>
                asProtocol
                  ? executeProtocolWithDriver(
                      d.driver,
                      d.family,
                      input.command as Record<string, unknown>[],
                    )
                  : executeCommandWithDriver(d.driver, input.command),
              ),
            );
            return devices.map((d, i): DeviceOutcome => {
              const outcome = settled[i];
              const identity = {
                family: d.family,
                deviceName: d.identity.name,
                deviceLabel: secondaryDeviceLabel(d),
              };
              if (outcome.status === "fulfilled") {
                const data = asProtocol
                  ? (outcome.value as Record<string, unknown>)
                  : toOutputData(outcome.value);
                return { deviceId: d.id, ...identity, data };
              }
              return {
                deviceId: d.id,
                ...identity,
                error:
                  outcome.reason instanceof Error
                    ? outcome.reason.message
                    : String(outcome.reason ?? "Execution failed"),
              };
            });
          } finally {
            signal.removeEventListener("abort", onAbort);
          }
        },
      },
      protocolCodeResolver: {
        // Prefer the live editor code so the device runs exactly what is on
        // screen; fall back to the last saved version when no editor is mounted.
        resolveProtocolCode: async (protocolId) => {
          const live = getLiveProtocolCode(protocolId);
          if (live && live.length > 0) return live;
          try {
            const result = await orpcClient.protocols.getProtocol({ id: protocolId });
            return result.code.length > 0 ? result.code : null;
          } catch {
            return null;
          }
        },
      },
    }),
    [],
  );

  const runnerRef = useRef<WorkbookRunner | null>(null);
  const unsubscribeRef = useRef<(() => void) | null>(null);
  const cellsChangeSeqRef = useRef(0);

  const disposeRunner = useCallback(() => {
    unsubscribeRef.current?.();
    unsubscribeRef.current = null;
    runnerRef.current?.dispose();
    runnerRef.current = null;
  }, []);

  useEffect(() => disposeRunner, [disposeRunner]);

  // Keep the runner's device roster in sync with the live connection registry.
  useEffect(() => {
    runnerRef.current?.setDevices(connections.map(toDeviceRef));
  }, [connections]);

  const handleRunnerState = useCallback((state: Readonly<RunnerState>) => {
    setRunnerState(state);
    const latest = cellsRef.current;
    const merged = mergeCellsView(latest, state);
    // mergeCellsView returns `latest` itself when nothing changed.
    if (merged !== latest) {
      cellsChangeSeqRef.current += 1;
      onCellsChangeRef.current(merged);
    }
  }, []);

  const ensureRunner = useCallback((): WorkbookRunner | null => {
    const existing = runnerRef.current;
    const current = cellsRef.current;
    if (existing) {
      const st = existing.getState();
      const busy =
        st.status === "running" ||
        st.status === "cancelling" ||
        (pendingTrackInteractions(st).length > 0 && st.runAllActive);
      const fresh =
        st.cells === current &&
        st.options.deviceFamily === sensorFamilyToDeviceType(sensorFamilyRef.current);
      if (busy || fresh) return existing;
    }
    const prev = existing?.getState() ?? null;
    disposeRunner();
    const options = {
      cells: current,
      mode: "notebook",
      deviceFamily: sensorFamilyToDeviceType(sensorFamilyRef.current),
      devices: connectionsRef.current.map(toDeviceRef),
    } as const;
    let runner: WorkbookRunner;
    try {
      runner = new WorkbookRunner({ ...options, ports }, carryOverState(options, prev));
    } catch (err) {
      console.error("Workbook runner init failed:", err);
      setRunnerState(null);
      return null;
    }
    runnerRef.current = runner;
    unsubscribeRef.current = runner.subscribe(handleRunnerState);
    setRunnerState(runner.getState());
    return runner;
  }, [ports, disposeRunner, handleRunnerState]);

  /**
   * Drive the runner until it settles: wait while running, and when a pass
   * suspends at a question, prompt the user and feed the answer back. A
   * dismissed prompt cancels (ends the pass at that question).
   */
  const settle = useCallback(async (runner: WorkbookRunner) => {
    for (;;) {
      if (runnerRef.current !== runner) return;
      const st = runner.getState();
      // Aggregate `running` may hide a question waiting on another track, so
      // presentation is driven from track-local interactions first.
      const pending = pendingTrackInteractions(st).shift();
      if (!pending) {
        if (st.status !== "running" && st.status !== "cancelling") return;
        await new Promise<void>((resolve) => {
          const unsubscribe = runner.subscribe(() => {
            unsubscribe();
            resolve();
          });
        });
        continue;
      }
      if (pending.interaction.kind !== "question") return;
      const { trackId, interaction } = pending;
      const cellId = interaction.cellId;
      const cell =
        cellsRef.current.find((c) => c.id === cellId) ?? st.cells.find((c) => c.id === cellId);
      if (cell?.type !== "question") return;
      const promptFn = onPromptQuestionRef.current;
      if (!promptFn) {
        runner.send({ type: "CANCEL" });
        return;
      }
      setPromptingCellId(cellId);
      let answer: string | undefined;
      try {
        answer = await promptFn(cell);
      } catch {
        answer = undefined;
      }
      setPromptingCellId(null);
      if (runnerRef.current !== runner) return;
      if (answer === undefined) {
        runner.send({ type: "CANCEL" });
        return;
      }
      runner.send({ type: "ANSWER", trackId, cellId, value: answer });
    }
  }, []);

  const runCell = useCallback(
    async (cellId: string) => {
      const runner = ensureRunner();
      if (!runner) return;
      const beforeChangeSeq = cellsChangeSeqRef.current;
      runner.send({ type: "RUN_CELL", cellId });
      await settle(runner);
      if (runnerRef.current === runner && cellsChangeSeqRef.current === beforeChangeSeq) {
        cellsChangeSeqRef.current += 1;
        onCellsChangeRef.current(cellsRef.current);
      }
    },
    [ensureRunner, settle],
  );

  const runAll = useCallback(async () => {
    const runner = ensureRunner();
    if (!runner) return;
    runner.send({ type: "RUN_ALL" });
    await settle(runner);
  }, [ensureRunner, settle]);

  const stopExecution = useCallback(() => {
    runnerRef.current?.send({ type: "STOP" });
  }, []);

  const clearOutputs = useCallback(() => {
    disposeRunner();
    setRunnerState(null);
    setPromptingCellId(null);
    onCellsChangeRef.current(cellsRef.current.filter((c) => c.type !== "output"));
  }, [disposeRunner]);

  const executionStates = useMemo(() => {
    const states: Record<string, CellExecutionState> = {};
    for (const [id, run] of Object.entries(effectiveCellRuns(runnerState, promptingCellId))) {
      states[id] = {
        status: toExecutionStatus(run.status),
        error: run.error,
        executionOrder: run.executionOrder,
      };
    }
    return states;
  }, [runnerState, promptingCellId]);

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
    isRunningAll: runnerState?.runAllActive ?? false,
    runCell,
    runAll,
    stopExecution,
    clearOutputs,

    /** Live runner state for the Variables / Flow panes; null before any run. */
    runnerState,
  };
}
