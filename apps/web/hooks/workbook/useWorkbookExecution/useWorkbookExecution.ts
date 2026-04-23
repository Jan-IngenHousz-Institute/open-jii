"use client";

import { useCallback, useRef, useState } from "react";
import { useIotCommunication } from "~/hooks/iot/useIotCommunication/useIotCommunication";
import { useIotProtocolExecution } from "~/hooks/iot/useIotProtocolExecution/useIotProtocolExecution";
import { tsr } from "~/lib/tsr";

import type {
  BranchCell,
  MacroCell,
  OutputCell,
  ProtocolCell,
  QuestionCell,
  SensorFamily,
  WorkbookCell,
} from "@repo/api";
import { evaluateBranch, validateBranchCell } from "@repo/api";

type CellExecutionStatus = "idle" | "running" | "completed" | "error";

interface CellExecutionState {
  status: CellExecutionStatus;
  error?: string;
  /** Jupyter-style execution order. Each run appends the global counter value. */
  executionOrder?: number[];
}

interface UseWorkbookExecutionOptions {
  cells: WorkbookCell[];
  onCellsChange: (cells: WorkbookCell[]) => void;
  /** Called during runAll when a question cell needs an answer. Should resolve with the answer string. */
  onPromptQuestion?: (cell: QuestionCell) => Promise<string | undefined>;
}

/**
 * Resolves the sensor family from cells. Defaults to multispeq.
 */
function resolveSensorFamily(_cells: WorkbookCell[]): SensorFamily {
  return "multispeq";
}

/**
 * Get protocol code from a protocol cell by fetching from the API.
 */
async function getProtocolCode(cell: ProtocolCell): Promise<Record<string, unknown>[] | null> {
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

/**
 * Find the most recent output cell data that precedes the given cell index.
 * This is used as the `json` input for macro execution.
 */
function findPrecedingOutputData(
  cells: WorkbookCell[],
  beforeIndex: number,
): Record<string, unknown> | null {
  for (let i = beforeIndex - 1; i >= 0; i--) {
    const c = cells[i];
    if (c.type === "output" && c.data) {
      return c.data as Record<string, unknown>;
    }
  }
  return null;
}

/** Insert an output cell after a source cell, removing any previous output for it. */
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

type ConnectionType = "bluetooth" | "serial";

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
  const [connectionType, setConnectionType] = useState<ConnectionType>("serial");
  const abortRef = useRef(false);

  // Refs to avoid stale closures in async execution flows
  const cellsRef = useRef(cells);
  cellsRef.current = cells;
  const onCellsChangeRef = useRef(onCellsChange);
  onCellsChangeRef.current = onCellsChange;
  const onPromptQuestionRef = useRef(onPromptQuestion);
  onPromptQuestionRef.current = onPromptQuestion;

  /** Change the sensor family. */
  const setSensorFamily = useCallback((family: SensorFamily) => {
    setSensorFamilyState(family);
  }, []);

  const {
    isConnected,
    isConnecting,
    error: connectionError,
    deviceInfo,
    driver,
    connect,
    disconnect,
  } = useIotCommunication(sensorFamily, connectionType);

  const { executeProtocol } = useIotProtocolExecution(driver, isConnected, sensorFamily);
  const executeMacroMutation = tsr.macros.executeMacro.useMutation();

  // Keep refs for async-safe access
  const isConnectedRef = useRef(isConnected);
  isConnectedRef.current = isConnected;
  const executeProtocolRef = useRef(executeProtocol);
  executeProtocolRef.current = executeProtocol;
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

  /** Global execution counter, incremented each time any cell is dispatched. */
  const execCounterRef = useRef(0);

  // ─── Single-cell runners (pure data transforms, no stale closure risk) ───

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

      if (!isConnectedRef.current) {
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

      try {
        const data = await executeProtocolRef.current(protocolCode);
        const executionTime = performance.now() - startTime;
        setCellState(cell.id, { status: "completed" });
        return insertOutputAfterCell(
          currentCells,
          cell.id,
          makeOutputCell(cell.id, data as Record<string, unknown>, executionTime, []),
        );
      } catch (err) {
        const executionTime = performance.now() - startTime;
        const message = err instanceof Error ? err.message : "Execution failed";
        setCellState(cell.id, { status: "error", error: message });
        return insertOutputAfterCell(
          currentCells,
          cell.id,
          makeErrorOutputCell(cell.id, message, executionTime),
        );
      }
    },
    [setCellState],
  );

  const runMacroCell = useCallback(
    async (cell: MacroCell, cellIndex: number, currentCells: WorkbookCell[]) => {
      const inputData = findPrecedingOutputData(currentCells, cellIndex);
      if (!inputData) {
        setCellState(cell.id, { status: "error", error: "No input data available" });
        return insertOutputAfterCell(
          currentCells,
          cell.id,
          makeErrorOutputCell(cell.id, "No measurement data available - run a protocol cell first"),
        );
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
          const error = result.body.error ?? "Macro execution failed";
          setCellState(cell.id, { status: "error", error });
          return insertOutputAfterCell(
            currentCells,
            cell.id,
            makeErrorOutputCell(cell.id, error, executionTime),
          );
        }

        setCellState(cell.id, { status: "completed" });
        return insertOutputAfterCell(
          currentCells,
          cell.id,
          makeOutputCell(cell.id, result.body.output, executionTime, []),
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
    [setCellState],
  );

  const runQuestionCell = useCallback(
    async (cell: QuestionCell, currentCells: WorkbookCell[]): Promise<WorkbookCell[]> => {
      if (!cell.question.text.trim()) {
        setCellState(cell.id, { status: "error", error: "Question text is required" });
        return insertOutputAfterCell(
          currentCells,
          cell.id,
          makeErrorOutputCell(cell.id, "Question text is required — add a question before running"),
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

  // ─── Shared dispatch: run any cell by type, stamp execution order ───

  const dispatchCell = useCallback(
    async (
      cell: WorkbookCell,
      currentCells: WorkbookCell[],
      pass?: number,
    ): Promise<WorkbookCell[]> => {
      const cellIndex = currentCells.findIndex((c) => c.id === cell.id);

      // Stamp execution order
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

  /**
   * Resolve the gotoCellId jump target for a branch cell after dispatch.
   * Returns the jump index into `currentCells`, or -1 if no jump.
   */
  const resolveBranchJump = (branchCellId: string, currentCells: WorkbookCell[]): number => {
    const branch = currentCells.find((c) => c.id === branchCellId);
    if (branch?.type !== "branch" || !branch.evaluatedPathId) return -1;
    const matchedPath = branch.paths.find((p) => p.id === branch.evaluatedPathId);
    if (!matchedPath?.gotoCellId) return -1;
    return currentCells.findIndex((c) => c.id === matchedPath.gotoCellId);
  };

  // ─── Public API ───

  /** Run a single cell by ID. If a branch jumps, continue executing from the target. */
  const runCell = useCallback(
    async (cellId: string) => {
      let currentCells = cellsRef.current;
      const cell = currentCells.find((c) => c.id === cellId);
      if (!cell) return;

      currentCells = await dispatchCell(cell, currentCells);
      onCellsChangeRef.current(currentCells);

      // If it was a branch with a jump, continue executing from the target
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

            // Nested branch jumps
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

  /** Check if the run-all loop should abort. Extracted to prevent TS narrowing. */
  const shouldAbort = () => abortRef.current;

  /** Run all executable cells sequentially. */
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

      // Skip output cells and non-executable types
      if (cell.type === "output" || cell.type === "markdown") continue;

      // Guard against infinite loops from branch jumps
      const count = visitCounts.get(cell.id) ?? 0;
      if (count >= MAX_VISITS_PER_CELL) continue;
      visitCounts.set(cell.id, count + 1);

      currentCells = await dispatchCell(cell, currentCells, count + 1);
      onCellsChangeRef.current(currentCells);

      // Handle branch jumps
      if (cell.type === "branch") {
        const jumpIndex = resolveBranchJump(cell.id, currentCells);
        if (jumpIndex !== -1) i = jumpIndex - 1;
      }
    }

    setIsRunningAll(false);
  }, [dispatchCell]);

  /** Stop a Run All sequence after the current cell finishes. */
  const stopExecution = useCallback(() => {
    abortRef.current = true;
  }, []);

  /** Remove all output cells. */
  const clearOutputs = useCallback(() => {
    const filtered = cellsRef.current.filter((c) => c.type !== "output");
    onCellsChangeRef.current(filtered);
    execCounterRef.current = 0;
    setExecutionStates({});
  }, []);

  return {
    // Device connection
    isConnected,
    isConnecting,
    connectionError,
    deviceInfo,
    sensorFamily,
    setSensorFamily,
    connectionType,
    setConnectionType,
    connect,
    disconnect,

    // Execution
    executionStates,
    isRunningAll,
    runCell,
    runAll,
    stopExecution,
    clearOutputs,
  };
}
