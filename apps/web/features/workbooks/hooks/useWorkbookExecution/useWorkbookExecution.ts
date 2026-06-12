"use client";

import { useIotCommunication } from "@/features/iot/hooks/useIotCommunication/useIotCommunication";
import { useIotProtocolExecution } from "@/features/iot/hooks/useIotProtocolExecution/useIotProtocolExecution";
import { getLiveProtocolCode } from "@/features/protocols/domain/protocol-code-registry";
import type {
  CellExecutionState,
  ExecutionStates,
} from "@/features/workbooks/domain/execution-state";
import {
  applyCellState,
  evaluateBranchCell,
  findPrecedingOutputData,
  foldExecutionError,
  foldExecutionSuccess,
  foldQuestionAnswered,
  hasQuestionText,
  isRunnableCell,
  recordVisit,
  resolveBranchJump,
  stampExecutionStart,
} from "@/features/workbooks/domain/execution-state";
import { tsr } from "@/shared/api/tsr";
import { useCallback, useRef, useState } from "react";

import type { SensorFamily } from "@repo/api/schemas/protocol.schema";
import type {
  BranchCell,
  MacroCell,
  ProtocolCell,
  QuestionCell,
  WorkbookCell,
} from "@repo/api/schemas/workbook-cells.schema";

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

type ConnectionType = "bluetooth" | "serial";

export function useWorkbookExecution({
  cells,
  onCellsChange,
  onPromptQuestion,
}: UseWorkbookExecutionOptions) {
  const [executionStates, setExecutionStates] = useState<ExecutionStates>({});
  const [isRunningAll, setIsRunningAll] = useState(false);
  const [sensorFamily, setSensorFamilyState] = useState<SensorFamily>(() =>
    resolveSensorFamily(cells),
  );
  const [connectionType, setConnectionType] = useState<ConnectionType>("serial");
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

  const { isConnected, isConnecting, deviceInfo, driver, connect, disconnect } =
    useIotCommunication(sensorFamily, connectionType);

  const { executeProtocol } = useIotProtocolExecution(driver, isConnected, sensorFamily);
  const executeMacroMutation = tsr.macros.executeMacro.useMutation();

  const isConnectedRef = useRef(isConnected);
  isConnectedRef.current = isConnected;
  const executeProtocolRef = useRef(executeProtocol);
  executeProtocolRef.current = executeProtocol;
  const executeMacroMutationRef = useRef(executeMacroMutation);
  executeMacroMutationRef.current = executeMacroMutation;

  const setCellState = useCallback(
    (cellId: string, state: Omit<CellExecutionState, "executionOrder">) => {
      setExecutionStates((prev) => applyCellState(prev, cellId, state));
    },
    [],
  );

  const execCounterRef = useRef(0);

  const runProtocolCell = useCallback(
    async (cell: ProtocolCell, currentCells: WorkbookCell[]) => {
      const protocolCode = await getProtocolCode(cell);
      if (!protocolCode) {
        const fold = foldExecutionError(currentCells, cell.id, "Invalid or missing protocol code", {
          outputMessage: "Invalid or missing protocol JSON",
        });
        setCellState(cell.id, fold.state);
        return fold.cells;
      }

      if (!isConnectedRef.current) {
        // The page-level Run handler short-circuits to connect() before this
        // path on direct Run clicks; this branch covers Run all + scripted
        // entry points where we still need a recorded error.
        const fold = foldExecutionError(currentCells, cell.id, "No device connected", {
          outputMessage: "No device connected - connect a device to run this protocol",
        });
        setCellState(cell.id, fold.state);
        return fold.cells;
      }

      setCellState(cell.id, { status: "running" });
      const startTime = performance.now();

      try {
        const data = await executeProtocolRef.current(protocolCode);
        const fold = foldExecutionSuccess(
          currentCells,
          cell.id,
          data as Record<string, unknown>,
          performance.now() - startTime,
        );
        setCellState(cell.id, fold.state);
        return fold.cells;
      } catch (err) {
        const message = err instanceof Error ? err.message : "Execution failed";
        const fold = foldExecutionError(currentCells, cell.id, message, {
          executionTime: performance.now() - startTime,
        });
        setCellState(cell.id, fold.state);
        return fold.cells;
      }
    },
    [setCellState],
  );

  const runMacroCell = useCallback(
    async (cell: MacroCell, cellIndex: number, currentCells: WorkbookCell[]) => {
      const inputData = findPrecedingOutputData(currentCells, cellIndex);
      if (!inputData) {
        const fold = foldExecutionError(currentCells, cell.id, "No input data available", {
          outputMessage: "No measurement data available - run a protocol cell first",
        });
        setCellState(cell.id, fold.state);
        return fold.cells;
      }

      setCellState(cell.id, { status: "running" });
      const startTime = performance.now();

      try {
        const result = await executeMacroMutationRef.current.mutateAsync({
          params: { id: cell.payload.macroId },
          body: { data: inputData },
        });

        const executionTime = performance.now() - startTime;

        if (!result.body.success) {
          const fold = foldExecutionError(
            currentCells,
            cell.id,
            result.body.error ?? "Macro execution failed",
            { executionTime },
          );
          setCellState(cell.id, fold.state);
          return fold.cells;
        }

        const fold = foldExecutionSuccess(currentCells, cell.id, result.body.output, executionTime);
        setCellState(cell.id, fold.state);
        return fold.cells;
      } catch (err) {
        const message = err instanceof Error ? err.message : "Macro execution failed";
        const fold = foldExecutionError(currentCells, cell.id, message, {
          executionTime: performance.now() - startTime,
        });
        setCellState(cell.id, fold.state);
        return fold.cells;
      }
    },
    [setCellState],
  );

  const runQuestionCell = useCallback(
    async (cell: QuestionCell, currentCells: WorkbookCell[]): Promise<WorkbookCell[]> => {
      if (!hasQuestionText(cell)) {
        const fold = foldExecutionError(currentCells, cell.id, "Question text is required", {
          outputMessage: "Question text is required — add a question before running",
        });
        setCellState(cell.id, fold.state);
        return fold.cells;
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

        const fold = foldQuestionAnswered(currentCells, cell, answer);
        setCellState(cell.id, fold.state);
        return fold.cells;
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
      const fold = evaluateBranchCell(cell, currentCells, pass);
      setCellState(cell.id, fold.state);
      return fold.cells;
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
      setExecutionStates((prev) => stampExecutionStart(prev, cell.id, order));

      switch (cell.type) {
        case "protocol":
          return runProtocolCell(cell, currentCells);
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
    [runProtocolCell, runMacroCell, runQuestionCell, runBranchCell],
  );

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
          let visitCounts: Record<string, number> = {};

          for (let i = jumpIndex; i < currentCells.length; i++) {
            const c = currentCells[i];
            if (!isRunnableCell(c)) continue;

            const visit = recordVisit(visitCounts, c.id);
            if (visit.blocked) continue;
            visitCounts = visit.counts;

            currentCells = await dispatchCell(c, currentCells, visit.pass);
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
    let visitCounts: Record<string, number> = {};

    for (let i = 0; i < currentCells.length; i++) {
      if (shouldAbort()) break;

      const cell = currentCells[i];

      if (!isRunnableCell(cell)) continue;

      const visit = recordVisit(visitCounts, cell.id);
      if (visit.blocked) continue;
      visitCounts = visit.counts;

      currentCells = await dispatchCell(cell, currentCells, visit.pass);
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
    isRunningAll,
    runCell,
    runAll,
    stopExecution,
    clearOutputs,
  };
}
