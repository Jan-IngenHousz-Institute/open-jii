"use client";

import { MetadataTable } from "@/components/metadata-table/metadata-table";
import type { MetadataColumn, MetadataRow } from "@/components/metadata-table/types";
import {
  parseClipboard,
  parseClipboardText,
  parseFile,
} from "@/components/metadata-table/utils/parse-metadata-import";
import { useExperimentFlow } from "@/hooks/experiment/useExperimentFlow/useExperimentFlow";
import { useExperimentMetadata } from "@/hooks/experiment/useExperimentMetadata/useExperimentMetadata";
import { useExperimentMetadataCreate } from "@/hooks/experiment/useExperimentMetadataCreate/useExperimentMetadataCreate";
import { useExperimentMetadataDelete } from "@/hooks/experiment/useExperimentMetadataDelete/useExperimentMetadataDelete";
import { useExperimentMetadataUpdate } from "@/hooks/experiment/useExperimentMetadataUpdate/useExperimentMetadataUpdate";
import {
  ArrowLeft,
  Calendar,
  Check,
  ClipboardPaste,
  FileSpreadsheet,
  KeyRound,
  Loader2,
  Pencil,
  Plus,
  Rows3,
  TableProperties,
  Trash2,
  Upload,
} from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import type { ExperimentMetadata } from "@repo/api/schemas/experiment.schema";
import { useTranslation } from "@repo/i18n/client";
import { Button } from "@repo/ui/components/button";
import { DialogFooter } from "@repo/ui/components/dialog";
import { Input } from "@repo/ui/components/input";
import { Label } from "@repo/ui/components/label";
import { ScrollArea } from "@repo/ui/components/scroll-area";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@repo/ui/components/select";
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

type SaveStatus = "idle" | "saving" | "saved";

// ---------------------------------------------------------------------------
// MetadataCard – one record in the list view (inspired by ExportCard)
// ---------------------------------------------------------------------------
type DeleteStatus = "idle" | "deleting" | "deleted";

function MetadataCard({
  name,
  identifierColumnId,
  rowCount,
  columnNames,
  updatedAt,
  onEdit,
  onDelete,
  deleteStatus,
}: {
  name: string | undefined;
  identifierColumnId: string | undefined;
  rowCount: number;
  columnNames: string[];
  updatedAt: string;
  onEdit: () => void;
  onDelete: () => void;
  deleteStatus: DeleteStatus;
}) {
  const { t } = useTranslation("experiments");
  const dateStr = new Date(updatedAt).toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });

  return (
    <div
      className={cn(
        "flex items-center gap-3 rounded-lg border border-l-4 border-l-emerald-500 bg-white px-3 py-2.5 transition-all duration-500 dark:border-gray-700 dark:border-l-emerald-500 dark:bg-gray-800",
        deleteStatus === "deleted" &&
          "max-h-0 scale-95 overflow-hidden border-transparent !border-l-transparent py-0 opacity-0",
      )}
      style={deleteStatus !== "deleted" ? { maxHeight: 200 } : undefined}
    >
      <div className="shrink-0 rounded-md bg-gray-100 p-1.5 dark:bg-gray-700">
        <TableProperties className="h-4 w-4 text-gray-500 dark:text-gray-400" />
      </div>

      <div className="flex min-w-0 flex-1 flex-col gap-1.5">
        <p className="truncate text-sm font-semibold text-gray-900 dark:text-gray-100">
          {name ?? "Untitled metadata"}
        </p>
        {columnNames.length > 0 && (
          <p className="truncate text-xs text-gray-500 dark:text-gray-400">
            {columnNames.length <= 5
              ? columnNames.join(", ")
              : t("uploadModal.metadata.columnsTruncated", {
                  columns: columnNames.slice(0, 4).join(", "),
                  count: columnNames.length - 4,
                })}
          </p>
        )}

        <div className="flex flex-wrap items-center gap-3 text-xs text-gray-500 dark:text-gray-400">
          <span className="inline-flex items-center gap-1">
            <Rows3 className="h-3 w-3" />
            {rowCount} row{rowCount !== 1 ? "s" : ""}
          </span>
          {identifierColumnId && (
            <span className="inline-flex items-center gap-1">
              <KeyRound className="h-3 w-3" />
              {identifierColumnId}
            </span>
          )}
          <span className="inline-flex items-center gap-1">
            <Calendar className="h-3 w-3" />
            {dateStr}
          </span>
        </div>
      </div>

      <div className="flex shrink-0 gap-1">
        <Button
          variant="ghost"
          size="icon"
          className="h-8 w-8"
          onClick={onEdit}
          disabled={deleteStatus !== "idle"}
        >
          <Pencil className="h-4 w-4 text-gray-500 dark:text-gray-400" />
        </Button>
        <Button
          variant="ghost"
          size="icon"
          className="h-8 w-8"
          onClick={onDelete}
          disabled={deleteStatus !== "idle"}
        >
          {deleteStatus === "deleted" ? (
            <Check className="animate-in zoom-in-0 h-4 w-4 text-emerald-500 duration-300" />
          ) : deleteStatus === "deleting" ? (
            <Loader2 className="h-4 w-4 animate-spin text-gray-400" />
          ) : (
            <Trash2 className="text-destructive h-4 w-4" />
          )}
        </Button>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// MetadataUploadStep
// ---------------------------------------------------------------------------
interface MetadataUploadStepProps {
  experimentId: string;
  onClose: () => void;
}

export function MetadataUploadStep({ experimentId, onClose }: MetadataUploadStepProps) {
  const { t } = useTranslation("experiments");
  const createMutation = useExperimentMetadataCreate();
  const updateMutation = useExperimentMetadataUpdate();
  const deleteMutation = useExperimentMetadataDelete();
  const { data: existingMetadataResponse } = useExperimentMetadata(experimentId);
  const existingRecords = useMemo(
    () => existingMetadataResponse?.body ?? [],
    [existingMetadataResponse?.body],
  );

  const fileInputRef = useRef<HTMLInputElement>(null);
  const [importError, setImportError] = useState<string | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [isPasting, setIsPasting] = useState(false);
  const [saveStatus, setSaveStatus] = useState<SaveStatus>("idle");
  const [isDragging, setIsDragging] = useState(false);
  const [isDeleting, setIsDeleting] = useState<Record<string, DeleteStatus>>({});
  // Keep snapshots of deleted records so the card stays in the DOM during exit animation
  const [exitingRecords, setExitingRecords] = useState<Record<string, ExperimentMetadata>>({});

  // "list" = show existing records, "edit" = editing table
  const [mode, setMode] = useState<"list" | "edit">("list");
  // When editing an existing record, store its metadataId
  const [editingMetadataId, setEditingMetadataId] = useState<string | null>(null);

  // Table state
  const [columns, setColumns] = useState<MetadataColumn[]>([]);
  const [rows, setRows] = useState<MetadataRow[]>([]);
  const [identifierColumnId, setIdentifierColumnId] = useState<string | null>(null);
  const [experimentQuestionId, setExperimentQuestionId] = useState<string | null>(null);
  const [metadataName, setMetadataName] = useState("");

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
    setMode("edit");
  }, []);

  const startNewUpload = useCallback(() => {
    setColumns([]);
    setRows([]);
    setIdentifierColumnId(null);
    setExperimentQuestionId(null);
    setEditingMetadataId(null);
    setMetadataName("");
    setSaveError(null);
    setImportError(null);
    setMode("edit");
  }, []);

  const startEditing = useCallback(
    (metadataId: string) => {
      const record = existingRecords.find((r) => r.metadataId === metadataId);
      if (!record) return;
      const meta = record.metadata as {
        name?: string;
        columns?: MetadataColumn[];
        rows?: MetadataRow[];
        identifierColumnId?: string;
        experimentQuestionId?: string;
      };
      setColumns(meta.columns ?? []);
      setRows(meta.rows ?? []);
      setIdentifierColumnId(meta.identifierColumnId ?? null);
      setExperimentQuestionId(meta.experimentQuestionId ?? null);
      setMetadataName(meta.name ?? "");
      setEditingMetadataId(metadataId);
      setSaveError(null);
      setImportError(null);
      setMode("edit");
    },
    [existingRecords],
  );

  const handleDelete = useCallback(
    async (metadataId: string) => {
      // Snapshot the record so it stays rendered during the exit animation
      const record = existingRecords.find((r) => r.metadataId === metadataId);
      if (record) {
        setExitingRecords((prev) => ({ ...prev, [metadataId]: record }));
      }
      setIsDeleting((prev) => ({ ...prev, [metadataId]: "deleting" }));
      try {
        await deleteMutation.mutateAsync({
          params: { id: experimentId, metadataId },
        });
        // Show checkmark
        setIsDeleting((prev) => ({ ...prev, [metadataId]: "deleted" }));
        // Wait for CSS collapse transition to finish, then clean up
        await new Promise((r) => setTimeout(r, 600));
        setExitingRecords((prev) => {
          const next = { ...prev };
          delete next[metadataId];
          return next;
        });
        setIsDeleting((prev) => {
          const next = { ...prev };
          delete next[metadataId];
          return next;
        });
      } catch {
        setExitingRecords((prev) => {
          const next = { ...prev };
          delete next[metadataId];
          return next;
        });
        setIsDeleting((prev) => {
          const next = { ...prev };
          delete next[metadataId];
          return next;
        });
      }
    },
    [deleteMutation, experimentId, existingRecords],
  );

  const backToList = useCallback(() => {
    setColumns([]);
    setRows([]);
    setEditingMetadataId(null);
    setMetadataName("");
    setSaveError(null);
    setImportError(null);
    setSaveStatus("idle");
    setMode("list");
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
        // Auto-fill name from filename (without extension)
        const nameWithoutExt = file.name.replace(/\.[^.]+$/, "");
        setMetadataName(nameWithoutExt);
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
      if (e.dataTransfer.files.length > 0) {
        void handleFileImport(e.dataTransfer.files[0]);
      }
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
    setSaveStatus("saving");
    setSaveError(null);
    try {
      // Remap col_X keys to real column names once at save time so the
      // stored blob (and downstream pipeline) uses human-readable keys.
      const colIdToName = new Map(columns.map((c) => [c.id, c.name]));
      const savedRows = rows.map((row) => {
        const mapped: MetadataRow = { _id: row._id };
        for (const [key, value] of Object.entries(row)) {
          if (key === "_id") continue;
          mapped[colIdToName.get(key) ?? key] = value;
        }
        return mapped;
      });
      const savedColumns = columns.map((c) => ({ ...c, id: c.name }));
      const savedIdentifierColumnId = identifierColumnId
        ? (colIdToName.get(identifierColumnId) ?? identifierColumnId)
        : null;

      // Auto-name untitled metadata
      let finalName = metadataName.trim();
      if (!finalName) {
        const untitledCount = existingRecords.filter((r) => {
          const n = (r.metadata as { name?: string }).name ?? "";
          return /^Untitled Metadata(\s\d+)?$/.test(n);
        }).length;
        finalName =
          untitledCount === 0 ? "Untitled Metadata" : `Untitled Metadata ${untitledCount + 1}`;
      }

      const metadataBody = {
        metadata: {
          name: finalName,
          columns: savedColumns,
          rows: savedRows,
          identifierColumnId: savedIdentifierColumnId,
          experimentQuestionId,
        },
      };

      if (editingMetadataId) {
        await updateMutation.mutateAsync({
          params: { id: experimentId, metadataId: editingMetadataId },
          body: metadataBody,
        });
      } else {
        await createMutation.mutateAsync({
          params: { id: experimentId },
          body: metadataBody,
        });
      }

      setSaveStatus("saved");
      setTimeout(() => {
        backToList();
      }, 1500);
    } catch (error) {
      setSaveError(error instanceof Error ? error.message : "Failed to save metadata");
      setSaveStatus("idle");
    }
  };

  const hasData = columns.length > 0;
  const showList = mode === "list";

  // Merge existing records with exiting snapshots so deleted cards stay in the DOM
  const displayRecords = useMemo(() => {
    const ids = new Set(existingRecords.map((r) => r.metadataId));
    const extras = Object.values(exitingRecords).filter((r) => !ids.has(r.metadataId));
    return [...existingRecords, ...extras];
  }, [existingRecords, exitingRecords]);

  // -------------------------------------------------------------------------
  // List view – show existing records + "Add new" button
  // -------------------------------------------------------------------------
  if (showList) {
    return (
      <div className="flex flex-col gap-4 pt-4">
        {existingRecords.length === 0 && Object.keys(exitingRecords).length === 0 ? (
          <div className="flex flex-col items-center justify-center rounded-lg border bg-gray-50 py-8 dark:bg-gray-900">
            <div className="bg-muted mb-3 flex h-16 w-16 items-center justify-center rounded-full">
              <FileSpreadsheet className="text-muted-foreground h-8 w-8" />
            </div>
            <p className="text-muted-foreground text-center text-sm">
              {t("uploadModal.metadata.noMetadata", {
                defaultValue: "No metadata uploaded yet.",
              })}
            </p>
          </div>
        ) : (
          <>
            <p className="text-sm text-gray-600 dark:text-gray-400">
              {existingRecords.length} metadata record
              {existingRecords.length !== 1 ? "s" : ""}
            </p>
            <ScrollArea className="max-h-[320px]">
              <div className="space-y-2">
                {displayRecords.map((record) => {
                  const meta = record.metadata as {
                    name?: string;
                    columns?: MetadataColumn[];
                    rows?: MetadataRow[];
                    identifierColumnId?: string;
                    experimentQuestionId?: string;
                  };
                  return (
                    <MetadataCard
                      key={record.metadataId}
                      name={meta.name}
                      identifierColumnId={meta.identifierColumnId}
                      rowCount={meta.rows?.length ?? 0}
                      columnNames={(meta.columns ?? []).map((c) => c.name).filter(Boolean)}
                      updatedAt={record.updatedAt}
                      onEdit={() => startEditing(record.metadataId)}
                      onDelete={() => handleDelete(record.metadataId)}
                      deleteStatus={isDeleting[record.metadataId] ?? "idle"}
                    />
                  );
                })}
              </div>
            </ScrollArea>
          </>
        )}

        <DialogFooter className="mt-2 flex items-center justify-between gap-2 sm:justify-between">
          <Button variant="outline" onClick={onClose}>
            <ArrowLeft className="mr-2 h-4 w-4" />
            {t("uploadModal.fileUpload.back")}
          </Button>
          <Button onClick={startNewUpload} className="gap-2">
            <Plus className="h-4 w-4" />
            {t("uploadModal.metadata.addNew", { defaultValue: "Add new" })}
          </Button>
        </DialogFooter>
      </div>
    );
  }

  // -------------------------------------------------------------------------
  // Edit view – import + edit table + save
  // -------------------------------------------------------------------------
  return (
    <div className="flex min-w-0 flex-col gap-4 pt-4">
      {!hasData ? (
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
      ) : (
        <div className="min-w-0 space-y-4">
          <div className="grid gap-2">
            <Label htmlFor="metadata-name">
              {t("uploadModal.metadata.nameLabel", { defaultValue: "Name" })}
            </Label>
            <Input
              id="metadata-name"
              value={metadataName}
              onChange={(e) => setMetadataName(e.target.value)}
              placeholder={t("uploadModal.metadata.namePlaceholder", {
                defaultValue: "e.g. Winter Wheat Plot Map",
              })}
            />
          </div>

          <div className="flex items-center justify-between">
            <p className="text-muted-foreground text-sm">
              {t("uploadModal.metadata.rowCount", { count: rows.length })}
            </p>
            <Button variant="outline" size="sm" onClick={() => setData([], [])}>
              <Trash2 className="mr-2 h-4 w-4" />
              {t("uploadModal.metadata.clearData")}
            </Button>
          </div>

          <div className="overflow-x-auto">
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
          </div>

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
        <Button variant="outline" onClick={existingRecords.length > 0 ? backToList : onClose}>
          <ArrowLeft className="mr-2 h-4 w-4" />
          {existingRecords.length > 0
            ? t("uploadModal.metadata.backToList", { defaultValue: "Back to list" })
            : t("uploadModal.fileUpload.back")}
        </Button>

        {saveStatus === "saving" ? (
          <Button disabled className="gap-2">
            <Loader2 className="h-4 w-4 animate-spin" />
            {t("uploadModal.metadata.savingMetadata", { defaultValue: "Saving..." })}
          </Button>
        ) : saveStatus === "saved" ? (
          <Button disabled className="gap-2">
            <Check className="animate-in zoom-in-0 h-4 w-4 duration-300" />
            {t("uploadModal.metadata.saved", { defaultValue: "Saved" })}
          </Button>
        ) : (
          <Button
            onClick={handleSave}
            disabled={!hasData || !identifierColumnId || !experimentQuestionId}
            className="gap-2"
          >
            {editingMetadataId
              ? t("uploadModal.metadata.updateMetadata", { defaultValue: "Update metadata" })
              : t("uploadModal.metadata.saveMetadata")}
          </Button>
        )}
      </DialogFooter>
    </div>
  );
}
