"use client";

import { useReportAutosaveStatus } from "@/components/shared/autosave/autosave-status-context";
import { WorkbookEditor } from "@/components/workbook/workbook-editor";
import { useAutosave } from "@/hooks/useAutosave";
import { useWorkbookExecution } from "@/hooks/workbook/useWorkbookExecution/useWorkbookExecution";
import { useWorkbookUpdate } from "@/hooks/workbook/useWorkbookUpdate/useWorkbookUpdate";
import { useCallback, useRef, useState } from "react";
import { parseApiError } from "~/util/apiError";

import { zWorkbookCellArray } from "@repo/api/schemas/workbook-cells.schema";
import type { QuestionCell, WorkbookCell } from "@repo/api/schemas/workbook-cells.schema";
import type { Workbook } from "@repo/api/schemas/workbook.schema";
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
        await updateWorkbook({ params: { id }, body: { cells: next } });
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
    // would reject — edits resume saving once valid.
    isValid: (c) => zWorkbookCellArray.safeParse(c).success,
    save,
    delayMs: AUTO_SAVE_DELAY,
  });

  useReportAutosaveStatus(autosave);

  const handleCellsChange = useCallback((next: WorkbookCell[]) => {
    setCells(next);
  }, []);

  const {
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
  } = useWorkbookExecution({
    cells,
    onCellsChange: handleCellsChange,
    onPromptQuestion: handlePromptQuestion,
  });

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
    <WorkbookEditor
      cells={cells}
      onCellsChange={handleCellsChange}
      readOnly={!isCreator}
      title={name}
      executionStates={executionStates}
      isConnected={isConnected}
      isConnecting={isConnecting}
      deviceInfo={deviceInfo}
      sensorFamily={sensorFamily}
      onSensorFamilyChange={setSensorFamily}
      connectionType={connectionType}
      onConnectionTypeChange={setConnectionType}
      isRunningAll={isRunningAll}
      onConnect={connect}
      onDisconnect={disconnect}
      onRunAll={runAll}
      onStopExecution={stopExecution}
      onClearOutputs={handleClearOutputs}
      onRunCell={handleRunCell}
      promptedQuestionId={promptedQuestionId}
      onQuestionAnswered={handleQuestionAnswered}
    />
  );
}
