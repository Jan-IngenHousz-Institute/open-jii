import type {
  MetadataColumn,
  MetadataRow,
} from "@/features/experiments/components/metadata-table/types";
import {
  parseClipboard,
  parseClipboardText,
  parseFile,
} from "@/features/experiments/components/metadata-table/utils/parse-metadata-import";
import { useCallback, useEffect, useRef, useState } from "react";

interface ImportedData {
  columns: MetadataColumn[];
  rows: MetadataRow[];
  /** File basename without extension, when imported from a file. */
  suggestedName?: string;
}

interface UseMetadataImportArgs {
  enabled: boolean;
  onImported: (data: ImportedData) => void;
}

/**
 * Wrap file/drop/clipboard import paths and the document-level paste fallback.
 * Owns transient UI state (`isDragging`, `isPasting`, `importError`).
 */
export function useMetadataImport({ enabled, onImported }: UseMetadataImportArgs) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [importError, setImportError] = useState<string | null>(null);
  const [isPasting, setIsPasting] = useState(false);
  const [isDragging, setIsDragging] = useState(false);

  const handleFileImport = useCallback(
    async (file: File) => {
      try {
        setImportError(null);
        const result = await parseFile(file);
        const suggestedName = file.name.replace(/\.[^.]+$/, "");
        onImported({ ...result, suggestedName });
      } catch (error) {
        setImportError(error instanceof Error ? error.message : "Failed to import file");
      }
    },
    [onImported],
  );

  const handleFileSelect = useCallback(
    async (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (file) await handleFileImport(file);
      if (fileInputRef.current) fileInputRef.current.value = "";
    },
    [handleFileImport],
  );

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

  const handlePaste = useCallback(async () => {
    setImportError(null);
    setIsPasting(true);
    try {
      const result = await parseClipboard();
      onImported(result);
    } catch (error) {
      setImportError(error instanceof Error ? error.message : "Failed to paste from clipboard");
    } finally {
      setIsPasting(false);
    }
  }, [onImported]);

  // Document-level paste fallback for environments without Clipboard API access.
  // Only fires while the table is empty so we don't clobber an in-progress edit.
  useEffect(() => {
    if (!enabled) return;
    const handlePasteEvent = (e: ClipboardEvent) => {
      const text = e.clipboardData?.getData("text/plain");
      if (!text) return;
      try {
        setImportError(null);
        const result = parseClipboardText(text);
        onImported(result);
        e.preventDefault();
      } catch (error) {
        setImportError(error instanceof Error ? error.message : "Failed to paste from clipboard");
      }
    };
    document.addEventListener("paste", handlePasteEvent);
    return () => document.removeEventListener("paste", handlePasteEvent);
  }, [enabled, onImported]);

  return {
    fileInputRef,
    importError,
    setImportError,
    isPasting,
    isDragging,
    handleFileSelect,
    handleDrop,
    handleDragOver,
    handleDragLeave,
    handlePaste,
  };
}
