"use client";

import * as React from "react";
import { useRef, useState, useEffect } from "react";

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
import { ArrowLeft, ClipboardPaste, FileSpreadsheet, Trash2, Upload } from "lucide-react";

import {
  MetadataProvider,
  MetadataTable,
  useMetadata,
  type MetadataColumn,
  type MetadataRow,
} from "@/components/metadata-table";
import { parseClipboardText } from "@/components/metadata-table/utils/parse-metadata-import";
import { useExperimentFlow } from "@/hooks/experiment/useExperimentFlow/useExperimentFlow";

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
  const handleSave = async (
    columns: MetadataColumn[],
    rows: MetadataRow[],
    identifierColumnId: string | null,
    experimentQuestionId: string | null,
  ) => {
    // TODO: Implement API call to save metadata
    console.log("Saving metadata:", { experimentId, columns, rows, identifierColumnId, experimentQuestionId });
    onUploadSuccess();
  };

  return (
    <MetadataProvider experimentId={experimentId} onSave={handleSave}>
      <MetadataUploadStepContent experimentId={experimentId} onBack={onBack} />
    </MetadataProvider>
  );
}

interface QuestionOption {
  id: string;
  name: string;
}

function MetadataUploadStepContent({ experimentId, onBack }: { experimentId: string; onBack: () => void }) {
  const { t } = useTranslation("experiments");
  const { state, importFromClipboard, importFromFile, save, isSaving, isEditingCell, setData, setExperimentQuestionId } = useMetadata();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [importError, setImportError] = useState<string | null>(null);
  const [isPasting, setIsPasting] = useState(false);

  // Fetch experiment flow to get question nodes
  const { data: flowData } = useExperimentFlow(experimentId);

  const questionOptions: QuestionOption[] = React.useMemo(() => {
    const nodes = flowData?.body?.graph?.nodes;
    if (!nodes) return [];
    return nodes
      .filter((node) => node.type === "question")
      .map((node) => ({
        id: node.id,
        name: node.name,
      }));
  }, [flowData]);

  // Prevent dialog from closing when editing a cell
  useEffect(() => {
    if (!isEditingCell) return;

    const handleEscapeCapture = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.stopPropagation();
        e.preventDefault();
      }
    };

    document.addEventListener("keydown", handleEscapeCapture, true);
    return () => document.removeEventListener("keydown", handleEscapeCapture, true);
  }, [isEditingCell]);

  // Handle paste events as fallback for clipboard API
  useEffect(() => {
    const handlePasteEvent = (e: ClipboardEvent) => {
      // Only handle if we don't have data yet and not editing a cell
      if (state.columns.length > 0 || isEditingCell) return;
      
      const text = e.clipboardData?.getData("text/plain");
      if (text) {
        try {
          setImportError(null);
          const { columns, rows } = parseClipboardText(text);
          setData(columns, rows);
          e.preventDefault();
        } catch (error) {
          setImportError(
            error instanceof Error ? error.message : "Failed to paste from clipboard"
          );
        }
      }
    };

    document.addEventListener("paste", handlePasteEvent);
    return () => document.removeEventListener("paste", handlePasteEvent);
  }, [state.columns.length, isEditingCell, setData]);

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      try {
        setImportError(null);
        await importFromFile(file);
      } catch (error) {
        setImportError(
          error instanceof Error ? error.message : "Failed to import file"
        );
      }
    }
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  const handlePaste = async () => {
    setImportError(null);
    setIsPasting(true);
    try {
      await importFromClipboard();
    } catch (error) {
      setImportError(
        error instanceof Error ? error.message : "Failed to paste from clipboard"
      );
    } finally {
      setIsPasting(false);
    }
  };

  const hasData = state.columns.length > 0;

  return (
    <div className="space-y-6 max-full overflow-x-scroll">
      {!hasData ? (
        <div className="space-y-4">
          <div
            className={cn(
              "flex flex-col items-center justify-center gap-4 rounded-lg border-2 border-dashed p-8",
              "hover:border-primary/50 hover:bg-muted/50 transition-colors"
            )}
          >
            <FileSpreadsheet className="text-muted-foreground h-12 w-12" />
            <div className="text-center">
              <p className="font-medium">
                {t("uploadModal.metadata.importPrompt")}
              </p>
              <p className="text-muted-foreground mt-1 text-sm">
                {t("uploadModal.metadata.supportedFormats")}
              </p>
              <p className="text-muted-foreground mt-1 text-xs">
                {t("uploadModal.metadata.pasteHint", {
                  shortcut: navigator?.platform?.includes("Mac") ? "⌘V" : "Ctrl+V",
                })}
              </p>
            </div>
            <div className="flex gap-3">
              <Button
                variant="outline"
                onClick={() => fileInputRef.current?.click()}
              >
                <Upload className="mr-2 h-4 w-4" />
                {t("uploadModal.metadata.uploadFile")}
              </Button>
              <Button variant="outline" onClick={handlePaste} disabled={isPasting}>
                <ClipboardPaste className="mr-2 h-4 w-4" />
                {isPasting ? t("uploadModal.metadata.pasting") : t("uploadModal.metadata.pasteClipboard")}
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

          {importError && (
            <p className="text-destructive text-sm">{importError}</p>
          )}
        </div>
      ) : (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <p className="text-muted-foreground text-sm">
              {t("uploadModal.metadata.rowCount", { count: state.rows.length })}
            </p>
            <div className="flex gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setData([], [])}
              >
                <Trash2 className="mr-2 h-4 w-4" />
                {t("uploadModal.metadata.clearData")}
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

          <MetadataTable pageSize={10} />

          <div className="grid gap-2">
            <Label htmlFor="experiment-question">
              {t("uploadModal.metadata.experimentQuestionLabel", {
                defaultValue: "Identifier column from experiment question",
              })}
            </Label>
            <p className="text-muted-foreground text-xs">
              {questionOptions.length > 0
                ? t("uploadModal.metadata.experimentQuestionHint", {
                    defaultValue: "Select the experiment question whose answers should match the metadata identifier column (e.g., a plot question).",
                  })
                : t("uploadModal.metadata.experimentQuestionNoQuestions", {
                    defaultValue: "No questions found. Add question nodes to the experiment flow first.",
                  })}
            </p>
            <Select
              value={state.experimentQuestionId ?? ""}
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
        <Button onClick={save} disabled={!hasData || isSaving || !state.identifierColumnId || !state.experimentQuestionId}>
          {isSaving
            ? t("uploadModal.fileUpload.uploading")
            : t("uploadModal.metadata.saveMetadata")}
        </Button>
      </div>
    </div>
  );
}
