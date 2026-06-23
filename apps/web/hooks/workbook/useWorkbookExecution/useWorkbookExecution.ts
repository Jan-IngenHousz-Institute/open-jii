"use client";

import { useCallback, useRef, useState } from "react";
import { useIotCommunication } from "~/hooks/iot/useIotCommunication/useIotCommunication";
import { useIotProtocolExecution } from "~/hooks/iot/useIotProtocolExecution/useIotProtocolExecution";
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

  const { executeProtocol, executeCommand } = useIotProtocolExecution(
    driver,
    isConnected,
    sensorFamily,
  );
  const executeMacroMutation = tsr.macros.executeMacro.useMutation();

  const isConnectedRef = useRef(isConnected);
  isConnectedRef.current = isConnected;
  const executeProtocolRef = useRef(executeProtocol);
  executeProtocolRef.current = executeProtocol;
  const executeCommandRef = useRef(executeCommand);
  executeCommandRef.current = executeCommand;
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

  // Normalises any non-object device response into the output cell's data shape.
  const toOutputData = (data: unknown): Record<string, unknown> => {
    if (data !== null && typeof data === "object" && !Array.isArray(data)) {
      return data as Record<string, unknown>;
    }
    return { response: data };
  };

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

      if (!isConnectedRef.current) {
        setCellState(cell.id, { status: "error", error: "No device connected" });
        return insertOutputAfterCell(
          currentCells,
          cell.id,
          makeErrorOutputCell(cell.id, "No device connected - connect a device to run this command"),
        );
      }

      setCellState(cell.id, { status: "running" });
      const startTime = performance.now();

      try {
        const data = await executeCommandRef.current(command);
        const executionTime = performance.now() - startTime;
        setCellState(cell.id, { status: "completed" });
        return insertOutputAfterCell(
          currentCells,
          cell.id,
          makeOutputCell(cell.id, toOutputData(data), executionTime, []),
        );
      } catch (err) {
        const executionTime = performance.now() - startTime;
        const message = err instanceof Error ? err.message : "Command execution failed";
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
