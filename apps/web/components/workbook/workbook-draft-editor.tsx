"use client";

import { useReportAutosaveStatus } from "@/components/shared/autosave/autosave-status-context";
import { WorkbookEditor } from "@/components/workbook/workbook-editor";
import { WorkbookExecutableEditProvider } from "@/components/workbook/workbook-entity-saved-context";
import { useAutosave } from "@/hooks/useAutosave";
import {
  useWorkbookExecution,
  workbookDesignSignature,
} from "@/hooks/workbook/useWorkbookExecution/useWorkbookExecution";
import { useWorkbookUpdate } from "@/hooks/workbook/useWorkbookUpdate/useWorkbookUpdate";
import { useCallback, useRef, useState } from "react";
import { parseApiError } from "~/util/apiError";

import { zWorkbookCellArray } from "@repo/api/domains/workbook/workbook-cells.schema";
import type { QuestionCell, WorkbookCell } from "@repo/api/domains/workbook/workbook-cells.schema";
import type { Workbook } from "@repo/api/domains/workbook/workbook.schema";
import { useSession } from "@repo/auth/client";
import { useTranslation } from "@repo/i18n";
import { toast } from "@repo/ui/hooks/use-toast";

const AUTO_SAVE_DELAY = 1500;

interface WorkbookDraftEditorProps {
  id: string;
  initialCells: WorkbookCell[];
  createdBy: string;
  name: string;
  /** Called after each successful autosave. */
  onSaved?: (workbook: Workbook) => void;
}

/**
 * The editable, autosaving workbook editor backed by the live draft
 * (`workbooks.cells`). Mount it only after the draft has loaded so
 * `useAutosave` sees the persisted state as its first value. Shared by the
 * standalone workbook page and the experiment design page's edit mode.
 */
export function WorkbookDraftEditor({
  id,
  initialCells,
  createdBy,
  name,
  onSaved,
}: WorkbookDraftEditorProps) {
  const { data: session } = useSession();
  const { t } = useTranslation(["workbook", "common"]);
  const { mutateAsync: updateWorkbook } = useWorkbookUpdate(id, { onSuccess: onSaved });

  const [cells, setCells] = useState<WorkbookCell[]>(initialCells);
  // Latest cells for synchronous authored-change comparison in the editor
  // callback (before setCells), independent of render timing.
  const cellsRef = useRef(cells);
  cellsRef.current = cells;

  const [promptedQuestionId, setPromptedQuestionId] = useState<string | undefined>();
  const questionResolverRef = useRef<((answer: string | undefined) => void) | null>(null);

  const handlePromptQuestion = useCallback((cell: QuestionCell): Promise<string | undefined> => {
    return new Promise((resolve) => {
      questionResolverRef.current = resolve;
      setPromptedQuestionId(cell.id);
    });
  }, []);

  const handleQuestionAnswered = useCallback((answer: string) => {
    questionResolverRef.current?.(answer || undefined);
    questionResolverRef.current = null;
    setPromptedQuestionId(undefined);
  }, []);

  const save = useCallback(
    async (next: WorkbookCell[]) => {
      try {
        await updateWorkbook({ id, cells: next });
      } catch (err) {
        const message = parseApiError(err)?.message;
        if (message) toast({ description: message, variant: "destructive" });
        throw err;
      }
    },
    [id, updateWorkbook],
  );

  const autosave = useAutosave<WorkbookCell[]>({
    value: cells,
    toKey: (c) => JSON.stringify(c),
    // Skip autosave while cells are transiently invalid (e.g. a half-typed or
    // just-added empty option) so the draft never persists a state the API
    // would reject; edits resume saving once valid.
    isValid: (c) => zWorkbookCellArray.safeParse(c).success,
    save,
    delayMs: AUTO_SAVE_DELAY,
  });

  useReportAutosaveStatus(autosave);

  // Execution-owned commits arrive as pure transforms (field-scoped deltas that
  // the hook computed) applied to the LATEST state, so concurrent completions
  // and a collapse toggled mid-run compose without rollback.
  const handleExecutionCellsChange = useCallback(
    (update: (latest: WorkbookCell[]) => WorkbookCell[]) => {
      setCells(update);
    },
    [],
  );

  const {
    isConnected,
    isConnecting,
    connectedDevices,
    sensorFamily,
    setSensorFamily,
    connectionType,
    setConnectionType,
    connect,
    disconnect,
    disconnectDevice,
    executionStates,
    isRunningAll,
    runCell,
    runAll,
    stopExecution,
    clearOutputs,
    commandPreviews,
    invalidateExecutableDesign,
  } = useWorkbookExecution({
    cells,
    onCellsChange: handleExecutionCellsChange,
    onPromptQuestion: handlePromptQuestion,
    workbookId: id,
  });

  // Authored editor commits: when the non-output design actually changes, bump
  // the generation SYNCHRONOUSLY before setCells so an in-flight producer cannot
  // commit stale output or overwrite the edit. Output/answer/evaluated/collapse
  // changes leave the signature unchanged and pass through without invalidating.
  const handleAuthoredCellsChange = useCallback(
    (next: WorkbookCell[]) => {
      if (workbookDesignSignature(cellsRef.current) !== workbookDesignSignature(next)) {
        invalidateExecutableDesign();
      }
      setCells(next);
    },
    [invalidateExecutableDesign],
  );

  const isCreator = session?.user.id === createdBy;

  // Trigger the same `connect()` the toolbar uses when the user clicks Run on
  // a Protocol or Command cell with no device. Done before any await so the
  // browser's Web Serial / Web Bluetooth picker still sees a live user gesture.
  const handleRunCell = useCallback(
    (cellId: string) => {
      const cell = cells.find((c) => c.id === cellId);
      if ((cell?.type === "protocol" || cell?.type === "command") && !isConnected) {
        void connect();
        return;
      }
      void runCell(cellId);
    },
    [cells, isConnected, connect, runCell],
  );

  const handleClearOutputs = useCallback(() => {
    const count = cells.filter((c) => c.type === "output").length;
    clearOutputs();
    if (count > 0) {
      toast({ description: t("workbooks.outputsCleared", { count }) });
    }
  }, [cells, clearOutputs, t]);

  return (
    <WorkbookExecutableEditProvider onExecutableEdit={invalidateExecutableDesign}>
      <WorkbookEditor
        cells={cells}
        onCellsChange={handleAuthoredCellsChange}
        readOnly={!isCreator}
        title={name}
        executionStates={executionStates}
        commandPreviews={commandPreviews}
        isConnected={isConnected}
        isConnecting={isConnecting}
        connectedDevices={connectedDevices}
        sensorFamily={sensorFamily}
        onSensorFamilyChange={setSensorFamily}
        connectionType={connectionType}
        onConnectionTypeChange={setConnectionType}
        isRunningAll={isRunningAll}
        onConnect={connect}
        onDisconnect={disconnect}
        onDisconnectDevice={disconnectDevice}
        onRunAll={runAll}
        onStopExecution={stopExecution}
        onClearOutputs={handleClearOutputs}
        onRunCell={handleRunCell}
        promptedQuestionId={promptedQuestionId}
        onQuestionAnswered={handleQuestionAnswered}
      />
    </WorkbookExecutableEditProvider>
  );
}
