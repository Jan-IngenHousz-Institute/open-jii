"use client";

import { MetadataTable } from "@/components/metadata-table";
import type { MetadataColumn, MetadataRow } from "@/components/metadata-table";
import {
  parseClipboard,
  parseClipboardText,
  parseFile,
} from "@/components/metadata-table/utils/parse-metadata-import";
import { useExperimentFlow } from "@/hooks/experiment/useExperimentFlow/useExperimentFlow";
import { useExperimentMetadataCreate } from "@/hooks/experiment/useExperimentMetadataCreate/useExperimentMetadataCreate";
import { ArrowLeft, ClipboardPaste, FileSpreadsheet, Trash2, Upload } from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { useTranslation } from "@repo/i18n/client";
import {
  Button,
  Label,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@repo/ui/components";
import { cn } from "@repo/ui/lib/utils";

/**
 * Sanitize a question label to match the pipeline's `questions_data` key format.
 * Must stay in sync with `sanitize_label` in centrum_pipeline.py.
 */
function sanitizeQuestionLabel(label: string): string {
  if (!label) return "question_empty";

  let s = label.toLowerCase();
  s = s.replace(/[ ,;{}()\n\t=.]+/g, "_");
  s = s.replace(/^_+|_+$/g, "");
  s = s.replace(/_+/g, "_");

  if (!s || /^\d/.test(s)) {
    s = `question_${s}`;
  }

  return s;
}

interface MetadataUploadStepProps {
  experimentId: string;
  onBack: () => void;
  onUploadSuccess: () => void;
}

export function MetadataUploadStep({
  experimentId,
  onBack,
  onUploadSuccess,
}: MetadataUploadStepProps) {
  const { t } = useTranslation("experiments");
  const createMutation = useExperimentMetadataCreate();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [importError, setImportError] = useState<string | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [isPasting, setIsPasting] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isDragging, setIsDragging] = useState(false);

  // Table state
  const [columns, setColumns] = useState<MetadataColumn[]>([]);
  const [rows, setRows] = useState<MetadataRow[]>([]);
  const [identifierColumnId, setIdentifierColumnId] = useState<string | null>(null);
  const [experimentQuestionId, setExperimentQuestionId] = useState<string | null>(null);

  // Fetch experiment flow to get question nodes
  const { data: flowData } = useExperimentFlow(experimentId);

  const questionOptions = useMemo(() => {
    const nodes = flowData?.body.graph.nodes;
    if (!nodes) return [];
    return nodes
      .filter((node: { type: string }) => node.type === "question")
      .map((node: { id: string; name: string }) => ({
        id: sanitizeQuestionLabel(node.name),
        name: node.name,
      }));
  }, [flowData]);

  const setData = useCallback((newColumns: MetadataColumn[], newRows: MetadataRow[]) => {
    setColumns(newColumns);
    setRows(newRows);
    setIdentifierColumnId(null);
    setExperimentQuestionId(null);
  }, []);

  const updateCell = useCallback(
    (rowId: string, columnId: string, value: string | number | null) => {
      setRows((prev) =>
        prev.map((row) => (row._id === rowId ? { ...row, [columnId]: value } : row)),
      );
    },
    [],
  );

  const deleteRow = useCallback((rowId: string) => {
    setRows((prev) => prev.filter((row) => row._id !== rowId));
  }, []);

  const deleteColumn = useCallback((columnId: string) => {
    setColumns((prev) => prev.filter((col) => col.id !== columnId));
    setIdentifierColumnId((prev) => (prev === columnId ? null : prev));
    setRows((prev) =>
      prev.map((row) => {
        const { [columnId]: _, ...rest } = row;
        return rest as MetadataRow;
      }),
    );
  }, []);

  const renameColumn = useCallback((columnId: string, newName: string) => {
    setColumns((prev) =>
      prev.map((col) => (col.id === columnId ? { ...col, name: newName } : col)),
    );
  }, []);

  // Handle paste events as fallback for clipboard API
  useEffect(() => {
    const handlePasteEvent = (e: ClipboardEvent) => {
      if (columns.length > 0) return;

      const text = e.clipboardData?.getData("text/plain");
      if (text) {
        try {
          setImportError(null);
          const result = parseClipboardText(text);
          setData(result.columns, result.rows);
          e.preventDefault();
        } catch (error) {
          setImportError(error instanceof Error ? error.message : "Failed to paste from clipboard");
        }
      }
    };

    document.addEventListener("paste", handlePasteEvent);
    return () => document.removeEventListener("paste", handlePasteEvent);
  }, [columns.length, setData]);

  const handleFileImport = useCallback(
    async (file: File) => {
      try {
        setImportError(null);
        const result = await parseFile(file);
        setData(result.columns, result.rows);
      } catch (error) {
        setImportError(error instanceof Error ? error.message : "Failed to import file");
      }
    },
    [setData],
  );

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) await handleFileImport(file);
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setIsDragging(false);
      const file = e.dataTransfer.files[0];
      if (file) void handleFileImport(file);
    },
    [handleFileImport],
  );

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  }, []);

  const handlePaste = async () => {
    setImportError(null);
    setIsPasting(true);
    try {
      const result = await parseClipboard();
      setData(result.columns, result.rows);
    } catch (error) {
      setImportError(error instanceof Error ? error.message : "Failed to paste from clipboard");
    } finally {
      setIsPasting(false);
    }
  };

  const handleSave = async () => {
    setIsSaving(true);
    setSaveError(null);
    try {
      await createMutation.mutateAsync({
        params: { id: experimentId },
        body: {
          metadata: {
            columns,
            rows,
            identifierColumnId,
            experimentQuestionId,
          },
        },
      });
      onUploadSuccess();
    } catch (error) {
      setSaveError(error instanceof Error ? error.message : "Failed to save metadata");
    } finally {
      setIsSaving(false);
    }
  };

  const hasData = columns.length > 0;

  return (
    <div className="max-w-full space-y-6 overflow-x-scroll">
      {!hasData ? (
        <div className="space-y-4">
          <div
            onDrop={handleDrop}
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            className={cn(
              "flex flex-col items-center justify-center gap-4 rounded-lg border-2 border-dashed p-8",
              "hover:border-primary/50 hover:bg-muted/50 transition-colors",
              isDragging && "border-primary bg-muted/50",
            )}
          >
            <FileSpreadsheet className="text-muted-foreground h-12 w-12" />
            <div className="text-center">
              <p className="font-medium">{t("uploadModal.metadata.importPrompt")}</p>
              <p className="text-muted-foreground mt-1 text-sm">
                {t("uploadModal.metadata.supportedFormats")}
              </p>
              <p className="text-muted-foreground mt-1 text-xs">
                {t("uploadModal.metadata.pasteHint", {
                  shortcut: navigator.platform.includes("Mac") ? "⌘V" : "Ctrl+V",
                })}
              </p>
            </div>
            <div className="flex gap-3">
              <Button variant="outline" onClick={() => fileInputRef.current?.click()}>
                <Upload className="mr-2 h-4 w-4" />
                {t("uploadModal.metadata.uploadFile")}
              </Button>
              <Button variant="outline" onClick={handlePaste} disabled={isPasting}>
                <ClipboardPaste className="mr-2 h-4 w-4" />
                {isPasting
                  ? t("uploadModal.metadata.pasting")
                  : t("uploadModal.metadata.pasteClipboard")}
              </Button>
            </div>
          </div>

          <input
            ref={fileInputRef}
            type="file"
            accept=".csv,.tsv,.txt,.xlsx,.xls"
            onChange={handleFileSelect}
            className="hidden"
          />

          {importError && <p className="text-destructive text-sm">{importError}</p>}
        </div>
      ) : (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <p className="text-muted-foreground text-sm">
              {t("uploadModal.metadata.rowCount", { count: rows.length })}
            </p>
            <div className="flex gap-2">
              <Button variant="outline" size="sm" onClick={() => setData([], [])}>
                <Trash2 className="mr-2 h-4 w-4" />
                {t("uploadModal.metadata.clearData")}
              </Button>
            </div>
          </div>

          <MetadataTable
            columns={columns}
            rows={rows}
            identifierColumnId={identifierColumnId}
            onUpdateCell={updateCell}
            onDeleteRow={deleteRow}
            onDeleteColumn={deleteColumn}
            onRenameColumn={renameColumn}
            onSetIdentifierColumn={setIdentifierColumnId}
            pageSize={10}
          />

          <div className="grid gap-2">
            <Label htmlFor="experiment-question">
              {t("uploadModal.metadata.experimentQuestionLabel", {
                defaultValue: "Identifier column from experiment question",
              })}
            </Label>
            <p className="text-muted-foreground text-xs">
              {questionOptions.length > 0
                ? t("uploadModal.metadata.experimentQuestionHint", {
                    defaultValue:
                      "Select the experiment question whose answers should match the metadata identifier column (e.g., a plot question).",
                  })
                : t("uploadModal.metadata.experimentQuestionNoQuestions", {
                    defaultValue:
                      "No questions found. Add question nodes to the experiment flow first.",
                  })}
            </p>
            <Select
              value={experimentQuestionId ?? ""}
              onValueChange={(val) => setExperimentQuestionId(val || null)}
              disabled={questionOptions.length === 0}
            >
              <SelectTrigger id="experiment-question">
                <SelectValue
                  placeholder={
                    questionOptions.length === 0
                      ? t("uploadModal.metadata.experimentQuestionNoQuestionsPlaceholder", {
                          defaultValue: "No questions available",
                        })
                      : t("uploadModal.metadata.experimentQuestionPlaceholder", {
                          defaultValue: "Select a question",
                        })
                  }
                />
              </SelectTrigger>
              <SelectContent>
                {questionOptions.map((q) => (
                  <SelectItem key={q.id} value={q.id}>
                    {q.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
      )}

      <div className="flex justify-between pt-4">
        <Button variant="outline" onClick={onBack}>
          <ArrowLeft className="mr-2 h-4 w-4" />
          {t("uploadModal.fileUpload.back")}
        </Button>
        <Button
          onClick={handleSave}
          disabled={!hasData || isSaving || !identifierColumnId || !experimentQuestionId}
        >
          {isSaving
            ? t("uploadModal.metadata.savingMetadata", { defaultValue: "Saving..." })
            : t("uploadModal.metadata.saveMetadata")}
        </Button>
      </div>

      {saveError && <p className="text-destructive text-sm">{saveError}</p>}
    </div>
  );
}
