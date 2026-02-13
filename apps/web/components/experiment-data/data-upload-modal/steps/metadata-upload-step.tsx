"use client";

import * as React from "react";
import { useRef, useState, useEffect } from "react";

import { useTranslation } from "@repo/i18n/client";
import { Button, Label } from "@repo/ui/components";
import { cn } from "@repo/ui/lib/utils";
import { ArrowLeft, ClipboardPaste, FileSpreadsheet, Upload } from "lucide-react";

import {
  MetadataProvider,
  MetadataTable,
  useMetadata,
  type MetadataColumn,
  type MetadataRow,
} from "@/components/metadata-table";
import { parseClipboardText } from "@/components/metadata-table/utils/parse-data";

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
  const handleSave = async (columns: MetadataColumn[], rows: MetadataRow[]) => {
    // TODO: Implement API call to save metadata
    console.log("Saving metadata:", { experimentId, columns, rows });
    onUploadSuccess();
  };

  return (
    <MetadataProvider experimentId={experimentId} onSave={handleSave}>
      <MetadataUploadStepContent onBack={onBack} />
    </MetadataProvider>
  );
}

function MetadataUploadStepContent({ onBack }: { onBack: () => void }) {
  const { t } = useTranslation("experiments");
  const { state, importFromClipboard, importFromFile, save, isSaving, isEditingCell, setData } = useMetadata();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [importError, setImportError] = useState<string | null>(null);
  const [isPasting, setIsPasting] = useState(false);

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
      <div>
        <Label className="text-base font-medium">
          {t("uploadModal.metadata.title")}
        </Label>
        <p className="text-muted-foreground mt-1 text-sm">
          {t("uploadModal.metadata.description")}
        </p>
      </div>

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
                onClick={() => fileInputRef.current?.click()}
              >
                <Upload className="mr-2 h-4 w-4" />
                {t("uploadModal.metadata.replaceData")}
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
        </div>
      )}

      <div className="flex justify-between pt-4">
        <Button variant="outline" onClick={onBack}>
          <ArrowLeft className="mr-2 h-4 w-4" />
          {t("uploadModal.fileUpload.back")}
        </Button>
        <Button onClick={save} disabled={!hasData || isSaving}>
          {isSaving
            ? t("uploadModal.fileUpload.uploading")
            : t("uploadModal.metadata.saveMetadata")}
        </Button>
      </div>
    </div>
  );
}
