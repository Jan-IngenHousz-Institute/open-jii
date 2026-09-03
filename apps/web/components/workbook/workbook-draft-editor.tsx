"use client";

import { useReportAutosaveStatus } from "@/components/shared/autosave/autosave-status-context";
import { WorkbookEditor } from "@/components/workbook/workbook-editor";
import { useAutosave } from "@/hooks/useAutosave";
import { useWorkbookExecution } from "@/hooks/workbook/useWorkbookExecution/useWorkbookExecution";
import { useWorkbookUpdate } from "@/hooks/workbook/useWorkbookUpdate/useWorkbookUpdate";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
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
  canEdit,
  name,
  onSaved,
}: WorkbookDraftEditorProps) {
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

  // Adopt a newer server copy: fork pointers live inside `cells`, so a
  // never-reconciling editor silently un-forks cells it overwrites (OJD-1722).
  const serverKey = useMemo(() => JSON.stringify(initialCells), [initialCells]);
  const localKey = useMemo(() => JSON.stringify(cells), [cells]);
  const seenKeyRef = useRef(serverKey);
  const adoptedCellsRef = useRef<WorkbookCell[] | null>(null);

  useEffect(() => {
    if (serverKey === seenKeyRef.current) return;
    // Advance unconditionally: a copy we decline must not block later ones.
    seenKeyRef.current = serverKey;
    if (serverKey === localKey) return;
    // Unsaved work is local diverging from what autosave last persisted, not
    // from the last copy seen: after a save the two legitimately differ.
    if (localKey !== autosave.savedKey) return;
    adoptedCellsRef.current = initialCells;
    setCells(initialCells);
  }, [serverKey, localKey, initialCells, autosave.savedKey]);

  // Keyed on array identity: a flag would clear before the adopting commit.
  useEffect(() => {
    if (adoptedCellsRef.current === null || cells !== adoptedCellsRef.current) return;
    adoptedCellsRef.current = null;
    autosave.rebase();
  }, [cells, autosave]);

  const handleCellsChange = useCallback((next: WorkbookCell[]) => {
    setCells(next);
  }, []);

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
  } = useWorkbookExecution({
    cells,
    onCellsChange: handleCellsChange,
    onPromptQuestion: handlePromptQuestion,
  });

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
