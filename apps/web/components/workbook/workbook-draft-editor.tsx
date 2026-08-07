"use client";

import { useReportAutosaveStatus } from "@/components/shared/autosave/autosave-status-context";
import { WorkbookEditor } from "@/components/workbook/workbook-editor";
import { useAutosave } from "@/hooks/useAutosave";
import { useWorkbookExecution } from "@/hooks/workbook/useWorkbookExecution/useWorkbookExecution";
import { useWorkbookUpdate } from "@/hooks/workbook/useWorkbookUpdate/useWorkbookUpdate";
import { useCallback, useEffect, useRef, useState } from "react";
import { parseApiError } from "~/util/apiError";

import { zWorkbookCellArray } from "@repo/api/domains/workbook/workbook-cells.schema";
import type { QuestionCell, WorkbookCell } from "@repo/api/domains/workbook/workbook-cells.schema";
import type { Workbook } from "@repo/api/domains/workbook/workbook.schema";
import { useTranslation } from "@repo/i18n";
import { toast } from "@repo/ui/hooks/use-toast";

const AUTO_SAVE_DELAY = 1500;

interface WorkbookDraftEditorProps {
  id: string;
  initialCells: WorkbookCell[];
  /** `can(update)` from the detail response — a "Can edit" grantee edits too. */
  canEdit: boolean;
  /** Controlled draft value when autosave is owned by a parent surface. */
  cells?: WorkbookCell[];
  name: string;
  /** Called after each successful autosave. */
  onSaved?: (workbook: Workbook) => void;
  /** Mirrors live local edits so sibling editing surfaces can share one draft. */
  onCellsChange?: (cells: WorkbookCell[]) => void;
  /** Disable this editor's local autosave when a shared parent owns persistence. */
  autosaveEnabled?: boolean;
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
  canEdit,
  cells: controlledCells,
  name,
  onSaved,
  onCellsChange,
  autosaveEnabled = true,
}: WorkbookDraftEditorProps) {
  const { t } = useTranslation(["workbook", "common"]);
  const { mutateAsync: updateWorkbook } = useWorkbookUpdate(id, { onSuccess: onSaved });

  const [localCells, setLocalCells] = useState<WorkbookCell[]>(initialCells);
  const cells = controlledCells ?? localCells;

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
    enabled: autosaveEnabled,
  });

  useReportAutosaveStatus(autosave, autosaveEnabled);

  const handleCellsChange = useCallback(
    (next: WorkbookCell[]) => {
      if (!controlledCells) setLocalCells(next);
      onCellsChange?.(next);
    },
    [controlledCells, onCellsChange],
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
    lastRunCompletion,
    isRunningAll,
    runCell,
    runAll,
    stopExecution,
    clearOutputs,
  } = useWorkbookExecution({
    cells,
    onCellsChange: handleCellsChange,
    onPromptQuestion: handlePromptQuestion,
  });

  useEffect(() => {
    if (lastRunCompletion?.status !== "partial") return;
    toast({
      description: t("workbooks.partialRunCompletion"),
    });
  }, [lastRunCompletion, t]);

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
    <WorkbookEditor
      cells={cells}
      onCellsChange={handleCellsChange}
      readOnly={!canEdit}
      title={name}
      executionStates={executionStates}
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
  );
}
