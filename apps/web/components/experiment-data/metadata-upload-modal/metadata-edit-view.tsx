import { MetadataTable } from "@/components/metadata-table/metadata-table";
import type { MetadataColumn, MetadataRow } from "@/components/metadata-table/types";
import { useExperimentMetadataCreate } from "@/hooks/experiment/useExperimentMetadataCreate/useExperimentMetadataCreate";
import { useExperimentMetadataUpdate } from "@/hooks/experiment/useExperimentMetadataUpdate/useExperimentMetadataUpdate";
import {
  ArrowLeft,
  Check,
  ClipboardPaste,
  FileSpreadsheet,
  Loader2,
  Trash2,
  Upload,
} from "lucide-react";
import { useCallback, useMemo, useState } from "react";
import { Controller, useFormContext } from "react-hook-form";

import type { ExperimentMetadata } from "@repo/api/domains/experiment/experiment.schema";
import { useTranslation } from "@repo/i18n/client";
import { Button } from "@repo/ui/components/button";
import { DialogFooter } from "@repo/ui/components/dialog";
import { Input } from "@repo/ui/components/input";
import { Label } from "@repo/ui/components/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@repo/ui/components/select";
import { cn } from "@repo/ui/lib/utils";

import type { MetadataFormValues } from "./form-helpers";
import { toWirePayload } from "./form-helpers";
import { useMetadataImport } from "./use-metadata-import";

type SaveStatus = "idle" | "saving" | "saved";

export interface QuestionOption {
  id: string;
  name: string;
}

interface MetadataEditViewProps {
  experimentId: string;
  existingRecords: ExperimentMetadata[];
  editingMetadataId: string | null;
  questionOptions: QuestionOption[];
  onBack: () => void;
}

export function MetadataEditView({
  experimentId,
  existingRecords,
  editingMetadataId,
  questionOptions,
  onBack,
}: MetadataEditViewProps) {
  const { t } = useTranslation("experiments");
  const createMutation = useExperimentMetadataCreate();
  const updateMutation = useExperimentMetadataUpdate();
  const { control, register, handleSubmit, watch, setValue, getValues, trigger, formState } =
    useFormContext<MetadataFormValues>();
  const { errors } = formState;

  const columns = watch("columns");
  const rows = watch("rows");
  const identifierColumnId = watch("identifierColumnId");

  const [saveStatus, setSaveStatus] = useState<SaveStatus>("idle");
  const [saveError, setSaveError] = useState<string | null>(null);

  const replaceTableData = useCallback(
    (newColumns: MetadataColumn[], newRows: MetadataRow[]) => {
      setValue("columns", newColumns, { shouldValidate: false });
      setValue("rows", newRows, { shouldValidate: false });
      setValue("identifierColumnId", "", { shouldValidate: false });
      setValue("experimentQuestionId", "", { shouldValidate: false });
    },
    [setValue],
  );

  const {
    fileInputRef,
    importError,
    isPasting,
    isDragging,
    handleFileSelect,
    handleDrop,
    handleDragOver,
    handleDragLeave,
    handlePaste,
  } = useMetadataImport({
    enabled: columns.length === 0,
    onImported: ({ columns: cols, rows: rs, suggestedName }) => {
      if (suggestedName) setValue("name", suggestedName, { shouldValidate: false });
      replaceTableData(cols, rs);
    },
  });

  const updateCell = useCallback(
    (rowId: string, columnId: string, value: string | number | null) => {
      const next = getValues("rows").map((row) =>
        row._id === rowId ? { ...row, [columnId]: value } : row,
      );
      setValue("rows", next, { shouldValidate: false });
    },
    [getValues, setValue],
  );

  const deleteRow = useCallback(
    (rowId: string) => {
      setValue(
        "rows",
        getValues("rows").filter((r) => r._id !== rowId),
        { shouldValidate: false },
      );
    },
    [getValues, setValue],
  );

  const deleteColumn = useCallback(
    (columnId: string) => {
      setValue(
        "columns",
        getValues("columns").filter((c) => c.id !== columnId),
        { shouldValidate: true },
      );
      if (getValues("identifierColumnId") === columnId) {
        setValue("identifierColumnId", "", { shouldValidate: true });
      }
      setValue(
        "rows",
        getValues("rows").map((row) => {
          const { [columnId]: _dropped, ...rest } = row;
          return rest as MetadataRow;
        }),
        { shouldValidate: false },
      );
    },
    [getValues, setValue],
  );

  const renameColumn = useCallback(
    (columnId: string, newName: string) => {
      setValue(
        "columns",
        getValues("columns").map((c) => (c.id === columnId ? { ...c, name: newName } : c)),
        { shouldValidate: true },
      );
    },
    [getValues, setValue],
  );

  const setIdentifierColumn = useCallback(
    (columnId: string | null) => {
      setValue("identifierColumnId", columnId ?? "");
      // Identifier change shifts the question-collision bypass set, so the
      // columns array needs to be re-validated to drop stale errors.
      void trigger(["identifierColumnId", "columns"]);
    },
    [setValue, trigger],
  );

  const onSubmit = async (values: MetadataFormValues) => {
    setSaveStatus("saving");
    setSaveError(null);
    try {
      const body = toWirePayload(values, existingRecords);
      if (editingMetadataId) {
        await updateMutation.mutateAsync({
          params: { id: experimentId, metadataId: editingMetadataId },
          body,
        });
      } else {
        await createMutation.mutateAsync({ params: { id: experimentId }, body });
      }
      setSaveStatus("saved");
      setTimeout(onBack, 1500);
    } catch (error) {
      setSaveError(error instanceof Error ? error.message : "Failed to save metadata");
      setSaveStatus("idle");
    }
  };

  const columnErrors = useMemo(() => {
    if (!errors.columns) return [] as { columnId: string; columnName: string; message: string }[];
    const list: { columnId: string; columnName: string; message: string }[] = [];
    columns.forEach((col, idx) => {
      const fieldErr = errors.columns?.[idx]?.name;
      if (fieldErr?.message) {
        list.push({ columnId: col.id, columnName: col.name, message: fieldErr.message });
      }
    });
    return list;
  }, [columns, errors.columns]);

  const hasData = columns.length > 0;

  return (
    <form
      onSubmit={(e) => {
        void handleSubmit(onSubmit)(e);
      }}
      className="flex min-w-0 flex-col gap-4 pt-4"
    >
      {!hasData ? (
        <ImportDropZone
          isDragging={isDragging}
          isPasting={isPasting}
          onUploadClick={() => fileInputRef.current?.click()}
          onPasteClick={() => void handlePaste()}
          onDrop={handleDrop}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
        />
      ) : (
        <div className="min-w-0 space-y-4">
          <div className="grid gap-2">
            <Label htmlFor="metadata-name">
              {t("uploadModal.metadata.nameLabel", { defaultValue: "Name" })}
            </Label>
            <Input
              id="metadata-name"
              {...register("name")}
              placeholder={t("uploadModal.metadata.namePlaceholder", {
                defaultValue: "e.g. Winter Wheat Plot Map",
              })}
            />
            {errors.name?.message && (
              <p className="text-destructive text-xs">{errors.name.message}</p>
            )}
          </div>

          <div className="flex items-center justify-between">
            <p className="text-muted-foreground text-sm">
              {t("uploadModal.metadata.rowCount", { count: rows.length })}
            </p>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => replaceTableData([], [])}
            >
              <Trash2 className="mr-2 h-4 w-4" />
              {t("uploadModal.metadata.clearData")}
            </Button>
          </div>

          {(columnErrors.length > 0 || errors.columns?.message) && (
            <div className="border-destructive/50 bg-destructive/5 rounded-md border px-3 py-2">
              {errors.columns?.message && (
                <p className="text-destructive text-sm">{errors.columns.message}</p>
              )}
              {columnErrors.length > 0 && (
                <ul className="text-destructive list-disc space-y-0.5 pl-5 text-xs">
                  {columnErrors.map((err) => (
                    <li key={err.columnId}>
                      <span className="font-medium">{err.columnName || "(unnamed)"}</span>:{" "}
                      {err.message}
                    </li>
                  ))}
                </ul>
              )}
            </div>
          )}

          <div className="overflow-x-auto">
            <MetadataTable
              columns={columns}
              rows={rows}
              identifierColumnId={identifierColumnId || null}
              onUpdateCell={updateCell}
              onDeleteRow={deleteRow}
              onDeleteColumn={deleteColumn}
              onRenameColumn={renameColumn}
              onSetIdentifierColumn={setIdentifierColumn}
              pageSize={10}
            />
          </div>
          {errors.identifierColumnId?.message && (
            <p className="text-destructive text-xs">{errors.identifierColumnId.message}</p>
          )}

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
            <Controller
              control={control}
              name="experimentQuestionId"
              render={({ field }) => (
                <Select
                  value={field.value}
                  onValueChange={field.onChange}
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
              )}
            />
            {errors.experimentQuestionId?.message && (
              <p className="text-destructive text-xs">{errors.experimentQuestionId.message}</p>
            )}
          </div>
        </div>
      )}

      <input
        ref={fileInputRef}
        type="file"
        accept=".csv,.tsv,.txt,.xlsx,.xls"
        onChange={handleFileSelect}
        className="hidden"
      />

      {importError && <p className="text-destructive text-sm">{importError}</p>}
      {saveError && <p className="text-destructive text-sm">{saveError}</p>}

      <DialogFooter className="mt-2 flex items-center justify-between gap-2 sm:justify-between">
        <Button type="button" variant="outline" onClick={onBack}>
          <ArrowLeft className="mr-2 h-4 w-4" />
          {existingRecords.length > 0
            ? t("uploadModal.metadata.backToList", { defaultValue: "Back to list" })
            : t("uploadModal.fileUpload.back")}
        </Button>

        {saveStatus === "saving" ? (
          <Button type="button" disabled className="gap-2">
            <Loader2 className="h-4 w-4 animate-spin" />
            {t("uploadModal.metadata.savingMetadata", { defaultValue: "Saving..." })}
          </Button>
        ) : saveStatus === "saved" ? (
          <Button type="button" disabled className="gap-2">
            <Check className="animate-in zoom-in-0 h-4 w-4 duration-300" />
            {t("uploadModal.metadata.saved", { defaultValue: "Saved" })}
          </Button>
        ) : (
          <Button type="submit" disabled={!hasData} className="gap-2">
            {editingMetadataId
              ? t("uploadModal.metadata.updateMetadata", { defaultValue: "Update metadata" })
              : t("uploadModal.metadata.saveMetadata")}
          </Button>
        )}
      </DialogFooter>
    </form>
  );
}

interface ImportDropZoneProps {
  isDragging: boolean;
  isPasting: boolean;
  onUploadClick: () => void;
  onPasteClick: () => void;
  onDrop: (e: React.DragEvent) => void;
  onDragOver: (e: React.DragEvent) => void;
  onDragLeave: (e: React.DragEvent) => void;
}

function ImportDropZone({
  isDragging,
  isPasting,
  onUploadClick,
  onPasteClick,
  onDrop,
  onDragOver,
  onDragLeave,
}: ImportDropZoneProps) {
  const { t } = useTranslation("experiments");
  return (
    <div
      onDrop={onDrop}
      onDragOver={onDragOver}
      onDragLeave={onDragLeave}
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
        <Button type="button" variant="outline" onClick={onUploadClick}>
          <Upload className="mr-2 h-4 w-4" />
          {t("uploadModal.metadata.uploadFile")}
        </Button>
        <Button type="button" variant="outline" onClick={onPasteClick} disabled={isPasting}>
          <ClipboardPaste className="mr-2 h-4 w-4" />
          {isPasting ? t("uploadModal.metadata.pasting") : t("uploadModal.metadata.pasteClipboard")}
        </Button>
      </div>
    </div>
  );
}
