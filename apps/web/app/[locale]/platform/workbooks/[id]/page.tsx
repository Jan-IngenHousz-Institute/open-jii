"use client";

import { WorkbookEditor } from "@/features/workbooks/components/workbook-editor";
import { useWorkbook } from "@/features/workbooks/hooks/useWorkbook/useWorkbook";
import { useWorkbookExecution } from "@/features/workbooks/hooks/useWorkbookExecution/useWorkbookExecution";
import { useWorkbookUpdate } from "@/features/workbooks/hooks/useWorkbookUpdate/useWorkbookUpdate";
import { parseApiError } from "@/shared/api/apiError";
import { useAutosave } from "@/shared/hooks/useAutosave";
import { useReportAutosaveStatus } from "@/shared/ui/autosave/autosave-status-context";
import { ErrorDisplay } from "@/shared/ui/error-display";
import { use, useCallback, useRef, useState } from "react";

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
  const { t } = useTranslation(["workbook", "common"]);

  if (isLoading) {
    return <div>{t("common.loading")}</div>;
  }
  if (error) {
    return <ErrorDisplay error={error} title={t("workbooks.errorLoading")} />;
  }
  if (!data) {
    return <div>{t("workbooks.notFound")}</div>;
  }

  // Mount the editor only after data loads so `useAutosave` sees the
  // persisted state as its first value.
  return (
    <WorkbookEditorWithAutosave
      id={id}
      initialCells={data.cells as WorkbookCell[]}
      createdBy={data.createdBy}
      name={data.name}
    />
  );
}

function WorkbookEditorWithAutosave({
  id,
  initialCells,
  createdBy,
  name,
}: {
  id: string;
  initialCells: WorkbookCell[];
  createdBy: string;
  name: string;
}) {
  const { data: session } = useSession();
  const { t } = useTranslation(["workbook", "common"]);
  const { mutateAsync: updateWorkbook } = useWorkbookUpdate(id);

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
  // a Protocol cell with no device. Done before any await so the browser's
  // Web Serial / Web Bluetooth picker still sees a live user gesture.
  const handleRunCell = useCallback(
    (cellId: string) => {
      const cell = cells.find((c) => c.id === cellId);
      if (cell?.type === "protocol" && !isConnected) {
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
    <div className="space-y-6">
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
    </div>
  );
}
