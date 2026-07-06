"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useIotCommunication } from "~/hooks/iot/useIotCommunication/useIotCommunication";
import { useIotProtocolExecution } from "~/hooks/iot/useIotProtocolExecution/useIotProtocolExecution";
import { getLiveProtocolCode } from "~/lib/protocol-code-registry";
import { tsr } from "~/lib/tsr";

import type { SensorFamily } from "@repo/api/schemas/protocol.schema";
import type { QuestionCell, WorkbookCell } from "@repo/api/schemas/workbook-cells.schema";
import type { CellRunStatus, RunnerState, WorkbookRunnerPorts } from "@repo/workbook";
import { carryOverState, effectiveCellRuns, mergeCellsView, WorkbookRunner } from "@repo/workbook";

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

type ConnectionType = "bluetooth" | "serial";

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

/**
 * Thin adapter binding the env-agnostic WorkbookRunner (notebook mode) to the
 * web editor: device driver and backend mutations plug in as runner ports, and
 * runner results fold back into the cell array so persistence keeps working.
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
  const [connectionType, setConnectionType] = useState<ConnectionType>("serial");

  const cellsRef = useRef(cells);
  cellsRef.current = cells;
  const onCellsChangeRef = useRef(onCellsChange);
  onCellsChangeRef.current = onCellsChange;
  const onPromptQuestionRef = useRef(onPromptQuestion);
  onPromptQuestionRef.current = onPromptQuestion;

  const setSensorFamily = useCallback((family: SensorFamily) => {
    setSensorFamilyState(family);
  }, []);

  const { isConnected, isConnecting, deviceInfo, driver, connect, disconnect } =
    useIotCommunication(sensorFamily, connectionType);

  const { executeProtocol } = useIotProtocolExecution(driver, isConnected, sensorFamily);
  const executeMacroMutation = tsr.macros.executeMacro.useMutation();

  const isConnectedRef = useRef(isConnected);
  isConnectedRef.current = isConnected;
  const driverRef = useRef(driver);
  driverRef.current = driver;
  const executeProtocolRef = useRef(executeProtocol);
  executeProtocolRef.current = executeProtocol;
  const executeMacroMutationRef = useRef(executeMacroMutation);
  executeMacroMutationRef.current = executeMacroMutation;
  const sensorFamilyRef = useRef(sensorFamily);
  sensorFamilyRef.current = sensorFamily;

  const ports = useMemo<WorkbookRunnerPorts>(
    () => ({
      macroRunner: {
        run: async (input) => {
          if (input.json == null) {
            throw new Error("No measurement data available - run a protocol cell first");
          }
          // TODO(OJD-1655): pass input.ctx once executeMacro accepts a context field.
          const result = await executeMacroMutationRef.current.mutateAsync({
            params: { id: input.macroId },
            body: { data: input.json as Record<string, unknown> | unknown[] },
          });
          if (!result.body.success) {
            throw new Error(result.body.error ?? "Macro execution failed");
          }
          return result.body.output ?? {};
        },
      },
      commandExecutor: {
        execute: async (input, { signal }) => {
          if (!isConnectedRef.current) {
            throw new Error("No device connected - connect a device to run this protocol");
          }
          const onAbort = () => {
            void driverRef.current?.cancel?.();
          };
          signal.addEventListener("abort", onAbort);
          try {
            if (Array.isArray(input.command)) {
              return await executeProtocolRef.current(input.command as Record<string, unknown>[]);
            }
            // Inline/artifact commands go straight to the driver.
            const activeDriver = driverRef.current;
            if (!activeDriver) throw new Error("Not connected to device");
            const result = await activeDriver.execute(input.command);
            if (!result.success) {
              throw new Error(result.error?.message ?? "Command execution failed");
            }
            return result.data;
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
            const result = await tsr.protocols.getProtocol.query({ params: { id: protocolId } });
            if (result.status !== 200) return null;
            return result.body.code.length > 0 ? result.body.code : null;
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

  const disposeRunner = useCallback(() => {
    unsubscribeRef.current?.();
    unsubscribeRef.current = null;
    runnerRef.current?.dispose();
    runnerRef.current = null;
  }, []);

  useEffect(() => disposeRunner, [disposeRunner]);

  const handleRunnerState = useCallback((state: Readonly<RunnerState>) => {
    setRunnerState(state);
    const latest = cellsRef.current;
    const merged = mergeCellsView(latest, state);
    // mergeCellsView returns `latest` itself when nothing changed.
    if (merged !== latest) onCellsChangeRef.current(merged as WorkbookCell[]);
  }, []);

  const ensureRunner = useCallback((): WorkbookRunner | null => {
    const existing = runnerRef.current;
    const current = cellsRef.current;
    if (existing) {
      const st = existing.getState();
      const busy =
        st.status === "running" ||
        st.status === "cancelling" ||
        (st.status === "awaitingInput" && st.runAllActive);
      const fresh = st.cells === current && st.options.deviceFamily === sensorFamilyRef.current;
      if (busy || fresh) return existing;
    }
    const prev = existing?.getState() ?? null;
    disposeRunner();
    const options = {
      cells: current,
      mode: "notebook",
      deviceFamily: sensorFamilyRef.current,
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
      if (st.status === "running" || st.status === "cancelling") {
        await new Promise<void>((resolve) => {
          const unsubscribe = runner.subscribe(() => {
            unsubscribe();
            resolve();
          });
        });
        continue;
      }
      if (st.status !== "awaitingInput" || st.position.cellId === null) return;
      const cellId = st.position.cellId;
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
      runner.send({ type: "ANSWER", cellId, value: answer });
    }
  }, []);

  const runCell = useCallback(
    async (cellId: string) => {
      const runner = ensureRunner();
      if (!runner) return;
      runner.send({ type: "RUN_CELL", cellId });
      await settle(runner);
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

  return {
    isConnected,
    isConnecting,
    deviceInfo,
    sensorFamily,
    setSensorFamily,
    connectionType,
    setConnectionType,
    connect,
    disconnect,

    executionStates,
    isRunningAll: runnerState?.runAllActive ?? false,
    runCell,
    runAll,
    stopExecution,
    clearOutputs,
  };
}
