"use client";

import { ErrorDisplay } from "@/components/error-display";
import { useWorkbookSaveStatus } from "@/components/workbook-overview/workbook-save-context";
import { WorkbookEditor } from "@/components/workbook/workbook-editor";
import { useWorkbook } from "@/hooks/workbook/useWorkbook/useWorkbook";
import { useWorkbookExecution } from "@/hooks/workbook/useWorkbookExecution/useWorkbookExecution";
import { useWorkbookUpdate } from "@/hooks/workbook/useWorkbookUpdate/useWorkbookUpdate";
import { use, useCallback, useEffect, useRef, useState } from "react";
import { parseApiError } from "~/util/apiError";

import type { QuestionCell, WorkbookCell } from "@repo/api/schemas/workbook-cells.schema";
import { useSession } from "@repo/auth/client";
import { useTranslation } from "@repo/i18n";
import { toast } from "@repo/ui/hooks/use-toast";

interface WorkbookOverviewPageProps {
  params: Promise<{ id: string }>;
}

const AUTO_SAVE_DELAY = 1500;

export default function WorkbookOverviewPage({ params }: WorkbookOverviewPageProps) {
  const { id } = use(params);
  const { data, isLoading, error } = useWorkbook(id);
  const { data: session } = useSession();
  const { t } = useTranslation(["workbook", "common"]);
  const { mutateAsync: updateWorkbook } = useWorkbookUpdate(id);
  const { markDirty, markSaving, markSaved } = useWorkbookSaveStatus();

  const [cells, setCells] = useState<WorkbookCell[]>([]);
  const cellsInitialized = useRef(false);
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pendingCellsRef = useRef<WorkbookCell[] | null>(null);
  const saveCellsRef = useRef<((c: WorkbookCell[]) => Promise<void>) | null>(null);

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

  useEffect(() => {
    if (data && !cellsInitialized.current) {
      setCells(data.cells as WorkbookCell[]);
      cellsInitialized.current = true;
    }
  }, [data]);

  const saveCells = useCallback(
    async (updatedCells: WorkbookCell[]) => {
      try {
        markSaving();
        await updateWorkbook({
          params: { id },
          body: { cells: updatedCells },
        });
        markSaved();
      } catch (err) {
        markSaved();
        const message = parseApiError(err)?.message;
        if (message) {
          toast({ description: message, variant: "destructive" });
        }
      }
    },
    [id, updateWorkbook, markSaving, markSaved],
  );

  useEffect(() => {
    saveCellsRef.current = saveCells;
  }, [saveCells]);

  const handleCellsChange = useCallback(
    (updatedCells: WorkbookCell[]) => {
      setCells(updatedCells);
      markDirty();
      pendingCellsRef.current = updatedCells;
      if (saveTimer.current) clearTimeout(saveTimer.current);
      saveTimer.current = setTimeout(() => {
        pendingCellsRef.current = null;
        void saveCells(updatedCells);
      }, AUTO_SAVE_DELAY);
    },
    [saveCells, markDirty],
  );

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

  useEffect(() => {
    return () => {
      if (saveTimer.current) clearTimeout(saveTimer.current);
      if (pendingCellsRef.current && saveCellsRef.current) {
        void saveCellsRef.current(pendingCellsRef.current);
      }
    };
  }, []);

  if (isLoading) {
    return <div>{t("common.loading")}</div>;
  }

  if (error) {
    return <ErrorDisplay error={error} title={t("workbooks.errorLoading")} />;
  }

  if (!data) {
    return <div>{t("workbooks.notFound")}</div>;
  }

  const workbook = data;
  const isCreator = session?.user.id === workbook.createdBy;

  return (
    <div className="space-y-6">
      <WorkbookEditor
        cells={cells}
        onCellsChange={handleCellsChange}
        readOnly={!isCreator}
        title={workbook.name}
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
        onClearOutputs={clearOutputs}
        onRunCell={runCell}
        promptedQuestionId={promptedQuestionId}
        onQuestionAnswered={handleQuestionAnswered}
      />
    </div>
  );
}
